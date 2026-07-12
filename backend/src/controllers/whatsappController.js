const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const axios = require('axios');
const crypto = require('crypto');
const Message = require('../repositories/Message');
const Contact = require('../repositories/contact');
const AutoReply = require('../repositories/AutoReply');
const CampaignMessageStatus = require('../repositories/CampaignMessageStatus');
const WhatsAppAccount = require('../repositories/whatsappAccount');
const WebhookDestination = require('../models/WebhookDestination');
const { emitNewMessage } = require('../socket');
const { resolveAutoReplyAction, resolveReplyDelayMs, getCatalogFields } = require('../middleware/autoReply');
const logger = require('../utils/logger');
const { getWebhookVerifyToken } = require('../config/graphApi');
const {
  uploadWhatsAppMediaToCloudinary,
  uploadBufferToCloudinary,
} = require('../services/whatsappMediaService');
const {
  checkWhatsAppHealth,
  classifyWhatsAppApiError,
  validateWhatsAppConfig,
} = require('../services/whatsappHealthService');
const { encryptSensitiveValue, decryptSensitiveValue } = require('../utils/crypto');
const { validateManualWhatsAppCredentials } = require('../services/whatsappCredentialValidationService');
const {
  resolveCurrentWhatsAppAccount,
  sanitizeAccount,
  loadActiveWhatsAppAccountForUser,
  loadWhatsAppAccountByPhoneNumberId,
  loadWhatsAppAccountFromWebhookIdentifiers,
  assertPhoneNumberAvailable,
} = require('../services/whatsappAccountService');
const { ensureTenantForUser } = require('../services/tenantService');
const { enqueueBroadcastRecipients, waitForJobResults } = require('../queues/whatsappSendQueue');
const teamService = require('../services/teamService');
const conversationAssignmentService = require('../services/conversationAssignmentService');
const Workflow = require('../repositories/Workflow');
const { resolveMatchingWorkflow } = require('../services/workflowService');
const { recordAuditEvent } = require('../services/auditLogService');
const { getGraphApiVersion } = require('../config/graphApi');

const normalizePhone = (v) => String(v || '').replace(/\D/g, '');
const RESOLVED_API_VERSION = getGraphApiVersion();

const upsertAndActivateAccountForUser = async ({ userId, phoneNumberId, setPayload }) => {
  await assertPhoneNumberAvailable({ phoneNumberId, userId });
  await WhatsAppAccount.updateMany({ userId, isActive: true }, { $set: { isActive: false } });

  // Best-effort — a tenant/billing entity is metadata for future
  // multi-seat/billing features, not required for the connect flow to work,
  // so a failure here must never block a customer from actually connecting
  // their WhatsApp number.
  let tenantId = null;
  try {
    tenantId = await ensureTenantForUser(userId);
  } catch (error) {
    logger.error('[tenant] Failed to provision tenant for user', userId, error.message);
  }

  try {
    const account = await WhatsAppAccount.findOneAndUpdate(
      { userId, phoneNumberId: String(phoneNumberId) },
      {
        $set: {
          userId,
          phoneNumberId: String(phoneNumberId),
          ...setPayload,
          ...(tenantId ? { tenantId } : {}),
          isActive: true,
          numberClaimed: true,
        },
      },
      { upsert: true, new: true }
    );

    return account;
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError('This WhatsApp number is already connected to a different account.', 409);
    }
    throw error;
  }
};

const ensureWhatsAppMessagingConfig = (config) => {
  const validated = validateWhatsAppConfig(config || {});
  if (!validated.ok) throw new AppError('Missing WhatsApp configuration', 400);
  return validated;
};

const normalizeWhatsAppApiError = (error, fallbackMessage = 'WhatsApp API request failed') => {
  const normalized = classifyWhatsAppApiError(error);
  const statusCode = normalized.code === 'INVALID_CONFIG' ? 400 : normalized.code === 'TOKEN_EXPIRED' ? 401 : 502;

  const sanitizedMessage =
    normalized.code === 'TOKEN_EXPIRED'
      ? 'WhatsApp authorization failed'
      : normalized.code === 'INVALID_CONFIG'
      ? 'Missing WhatsApp configuration'
      : fallbackMessage;

  return new AppError(sanitizedMessage, statusCode);
};

const callWhatsAppMessagesApi = async (payload, accountContext, { fallbackMessage } = {}) => {
  const { accessToken, graphVersion, phoneNumberId } = ensureWhatsAppMessagingConfig(accountContext);

  try {
    const response = await axios.post(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    return response.data;
  } catch (error) {
    throw normalizeWhatsAppApiError(error, fallbackMessage || 'Failed to send WhatsApp message');
  }
};

const saveAndEmitMessage = async (payload) => {
  if (payload.messageId) {
    const existing = await Message.findOne({
      messageId: payload.messageId,
      ...(payload.whatsappAccountId ? { whatsappAccountId: payload.whatsappAccountId } : {}),
    }).lean();
    if (existing) return { message: existing, isDuplicate: true };
  }

  const savedMessage = await Message.create(payload);
  emitNewMessage(savedMessage.toObject());
  return { message: savedMessage, isDuplicate: false };
};

const dispatchTextMessage = async ({ accountContext, userId, to, body, campaignId = '' }) => {
  const normalizedTo = normalizePhone(to);
  if (!normalizedTo) throw new AppError('Invalid recipient number', 400);

  const data = await callWhatsAppMessagesApi(
    {
      messaging_product: 'whatsapp',
      to: normalizedTo,
      type: 'text',
      text: { body },
    },
    accountContext,
    { fallbackMessage: 'Failed to send WhatsApp text message' }
  );

  const messageId = data?.messages?.[0]?.id || '';
  await saveAndEmitMessage({
    userId,
    whatsappAccountId: accountContext?.account?._id,
    fromMe: true,
    from: accountContext.phoneNumberId || '',
    to: normalizedTo,
    message: body,
    body,
    text: body,
    timestamp: new Date(),
    time: new Date(),
    status: 'sent',
    direction: 'outgoing',
    type: 'text',
    messageId,
  });

  if (campaignId && messageId) {
    await CampaignMessageStatus.updateOne(
      {
        userId,
        whatsappAccountId: accountContext?.account?._id,
        messageId,
        status: 'sent',
      },
      {
        $setOnInsert: {
          userId,
          whatsappAccountId: accountContext?.account?._id,
          messageId,
          status: 'sent',
          timestamp: new Date(),
          campaignId,
        },
      },
      { upsert: true }
    );
  }

  return data;
};

const dispatchTemplateMessage = async ({ accountContext, userId, to, templateName, language = 'en_US', components = [], campaignId = '' }) => {
  const normalizedTo = normalizePhone(to);
  if (!normalizedTo) throw new AppError('Invalid recipient number', 400);

  const data = await callWhatsAppMessagesApi(
    {
      messaging_product: 'whatsapp',
      to: normalizedTo,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components,
      },
    },
    accountContext,
    { fallbackMessage: 'Failed to send WhatsApp template message' }
  );

  const messageId = data?.messages?.[0]?.id || '';
  await saveAndEmitMessage({
    userId,
    whatsappAccountId: accountContext?.account?._id,
    fromMe: true,
    from: accountContext.phoneNumberId || '',
    to: normalizedTo,
    message: templateName,
    body: templateName,
    text: templateName,
    timestamp: new Date(),
    time: new Date(),
    status: 'sent',
    direction: 'outgoing',
    type: 'template',
    messageId,
  });

  if (campaignId && messageId) {
    await CampaignMessageStatus.updateOne(
      {
        userId,
        whatsappAccountId: accountContext?.account?._id,
        messageId,
        status: 'sent',
      },
      {
        $setOnInsert: {
          userId,
          whatsappAccountId: accountContext?.account?._id,
          messageId,
          status: 'sent',
          timestamp: new Date(),
          campaignId,
        },
      },
      { upsert: true }
    );
  }

  return data;
};

const dispatchMediaMessage = async ({ accountContext, userId, to, type, link, caption = '', filename = '' }) => {
  const normalizedTo = normalizePhone(to);
  if (!normalizedTo) throw new AppError('Invalid recipient number', 400);

  const payload = {
    messaging_product: 'whatsapp',
    to: normalizedTo,
    type,
    [type]: {
      link,
      ...(caption ? { caption } : {}),
      ...(filename && type === 'document' ? { filename } : {}),
    },
  };

  const data = await callWhatsAppMessagesApi(payload, accountContext, {
    fallbackMessage: 'Failed to send WhatsApp media message',
  });

  const messageId = data?.messages?.[0]?.id || '';
  await saveAndEmitMessage({
    userId,
    whatsappAccountId: accountContext?.account?._id,
    fromMe: true,
    from: accountContext.phoneNumberId || '',
    to: normalizedTo,
    message: caption || link,
    body: caption || link,
    text: caption || '',
    mediaUrl: link,
    caption,
    filename,
    timestamp: new Date(),
    time: new Date(),
    status: 'sent',
    direction: 'outgoing',
    type,
    messageId,
  });

  return data;
};

// App-level Meta webhook config (one shared value for the whole deployment,
// not per-user) — shown to admins so they don't have to hunt through Render
// env vars to configure Meta's App Dashboard webhook fields.
const getMetaWebhookConfig = asyncHandler(async (req, res) => {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'https';
  const host = req.get('host');

  return res.status(200).json({
    success: true,
    data: {
      callbackUrl: `${protocol}://${host}/webhook`,
      verifyToken: getWebhookVerifyToken(),
      appId: process.env.META_APP_ID || '',
    },
  });
});

const getConnectConfig = asyncHandler(async (_req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      appId: process.env.META_APP_ID || '',
      configId: process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '',
      apiVersion: RESOLVED_API_VERSION,
    },
  });
});

const exchangeMetaToken = asyncHandler(async (req, res) => {
  const {
    accessToken,
    phoneNumberId,
    wabaId,
    businessId,
    businessAccountId,
    displayName,
    displayPhoneNumber,
    verifiedName,
    tokenType,
    expiresIn,
    metadata,
  } = req.body || {};

  if (!accessToken || !phoneNumberId) {
    throw new AppError('accessToken and phoneNumberId are required', 400);
  }

  if (!wabaId && !businessId && !businessAccountId) {
    throw new AppError('businessAccountId or wabaId is required', 400);
  }

  const account = await upsertAndActivateAccountForUser({
    userId: req.user?.id,
    phoneNumberId,
    setPayload: {
      connectionMode: 'embedded_signup',
      wabaId: String(wabaId || ''),
      businessAccountId: String(businessAccountId || businessId || ''),
      displayPhoneNumber: String(displayPhoneNumber || displayName || phoneNumberId),
      verifiedName: String(verifiedName || ''),
      accessTokenEncrypted: encryptSensitiveValue(String(accessToken)),
      tokenType: String(tokenType || 'Bearer'),
      tokenExpiresAt: expiresIn ? new Date(Date.now() + Number(expiresIn) * 1000) : null,
      status: 'active',
      webhookSubscribed: true,
      connectedAt: new Date(),
      lastSyncAt: new Date(),
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    },
  });

  return res.status(200).json({ success: true, data: sanitizeAccount(account) });
});

// Subscribes the app's webhook to a WABA so Meta actually starts sending
// message/status events for it — a WABA connected via Embedded Signup does
// not receive webhooks until the app is added to its subscribed_apps list.
// Best-effort: a failure here shouldn't fail the whole connect flow, since
// the account is otherwise fully usable for sending.
const subscribeAppToWaba = async ({ wabaId, accessToken }) => {
  try {
    await axios.post(
      `https://graph.facebook.com/${RESOLVED_API_VERSION}/${wabaId}/subscribed_apps`,
      {},
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 15000 }
    );
    return true;
  } catch (error) {
    logger.warn('[embedded-signup] Failed to subscribe app to WABA', wabaId, error?.response?.data || error.message);
    return false;
  }
};

// Completes Meta's WhatsApp Embedded Signup flow: the frontend gets an
// authorization `code` from FB.login and separately captures `wabaId`/
// `phoneNumberId` (and optionally `businessId`) from the WA_EMBEDDED_SIGNUP
// postMessage events Meta's JS SDK popup sends — Meta does not return those
// identifiers from FB.login itself. This exchanges that code for a real
// access token server-side (client secret never touches the browser), then
// resolves phone number details and auto-subscribes the webhook.
// Meta's IDs (WABA, phone number, business) are always numeric strings —
// rejecting anything else here before it reaches a Graph API call or a DB
// write catches a malformed/tampered postMessage payload early.
const isMetaNumericId = (value) => /^\d+$/.test(String(value || ''));

const completeEmbeddedSignup = asyncHandler(async (req, res) => {
  const { code, wabaId, phoneNumberId, businessId } = req.body || {};

  if (!code) throw new AppError('code is required', 400);
  if (!wabaId || !isMetaNumericId(wabaId)) throw new AppError('wabaId must be a valid Meta WABA ID', 400);
  if (!phoneNumberId || !isMetaNumericId(phoneNumberId)) throw new AppError('phoneNumberId must be a valid Meta phone number ID', 400);
  if (businessId && !isMetaNumericId(businessId)) throw new AppError('businessId must be a valid Meta business ID', 400);

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new AppError('Meta app credentials are not configured on the server', 500);

  let shortLivedToken;
  try {
    const tokenRes = await axios.get(`https://graph.facebook.com/${RESOLVED_API_VERSION}/oauth/access_token`, {
      params: { client_id: appId, client_secret: appSecret, code },
      timeout: 15000,
    });
    shortLivedToken = tokenRes.data?.access_token;
  } catch (error) {
    throw normalizeWhatsAppApiError(error, 'Failed to exchange the Meta authorization code for an access token');
  }
  if (!shortLivedToken) throw new AppError('Meta did not return an access token for this authorization code', 502);

  // Exchange for a long-lived token (~60 days) so the customer isn't forced
  // to redo Embedded Signup every time the short-lived token expires. Not
  // fatal if it fails — fall back to the short-lived token.
  let accessToken = shortLivedToken;
  let expiresIn = null;
  try {
    const longLivedRes = await axios.get(`https://graph.facebook.com/${RESOLVED_API_VERSION}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortLivedToken,
      },
      timeout: 15000,
    });
    accessToken = longLivedRes.data?.access_token || shortLivedToken;
    expiresIn = longLivedRes.data?.expires_in || null;
  } catch (error) {
    logger.warn('[embedded-signup] Long-lived token exchange failed, using short-lived token:', error.message);
  }

  let phoneDetails = {};
  try {
    const phoneRes = await axios.get(`https://graph.facebook.com/${RESOLVED_API_VERSION}/${phoneNumberId}`, {
      params: { fields: 'display_phone_number,verified_name' },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000,
    });
    phoneDetails = phoneRes.data || {};
  } catch (error) {
    logger.warn('[embedded-signup] Failed to fetch phone number details:', error?.response?.data || error.message);
  }

  const webhookSubscribed = await subscribeAppToWaba({ wabaId, accessToken });

  const account = await upsertAndActivateAccountForUser({
    userId: req.user?.id,
    phoneNumberId: String(phoneNumberId),
    setPayload: {
      connectionMode: 'embedded_signup',
      wabaId: String(wabaId),
      businessAccountId: String(businessId || ''),
      displayPhoneNumber: String(phoneDetails.display_phone_number || phoneNumberId),
      verifiedName: String(phoneDetails.verified_name || ''),
      accessTokenEncrypted: encryptSensitiveValue(String(accessToken)),
      tokenType: 'Bearer',
      tokenExpiresAt: expiresIn ? new Date(Date.now() + Number(expiresIn) * 1000) : null,
      status: 'active',
      webhookSubscribed,
      connectedAt: new Date(),
      lastSyncAt: new Date(),
    },
  });

  recordAuditEvent({ req, action: 'whatsapp_account.connect', resource: 'whatsapp_account', resourceId: account._id, metadata: { connectionMode: 'embedded_signup', phoneNumberId } });
  return res.status(200).json({ success: true, data: sanitizeAccount(account) });
});

const manualConnect = asyncHandler(async (req, res) => {
  const {
    accessToken,
    phoneNumberId,
    businessAccountId,
    wabaId,
    displayPhoneNumber,
    verifiedName,
    tokenType,
    expiresIn,
    accountName,
    label,
  } = req.body || {};

  if (!accessToken || !phoneNumberId || (!businessAccountId && !wabaId)) {
    throw new AppError('accessToken, phoneNumberId and businessAccountId or wabaId are required', 400);
  }

  const validated = await validateManualWhatsAppCredentials({
    accessToken,
    phoneNumberId,
    businessAccountId,
    wabaId,
  });

  const normalizedPhoneNumberId = String(validated.phoneNumberId || phoneNumberId);
  const resolvedWabaId = String(validated.wabaId || wabaId || '');

  // Same auto-subscription the Embedded Signup path does — a manually
  // pasted token is otherwise just as capable of sending/receiving, but
  // previously never got the app subscribed to its WABA's webhooks.
  const webhookSubscribed = resolvedWabaId
    ? await subscribeAppToWaba({ wabaId: resolvedWabaId, accessToken })
    : false;

  const account = await upsertAndActivateAccountForUser({
    userId: req.user?.id,
    phoneNumberId: normalizedPhoneNumberId,
    setPayload: {
      connectionMode: 'manual',
      wabaId: resolvedWabaId,
      businessAccountId: String(validated.businessAccountId || businessAccountId || ''),
      displayPhoneNumber: String(validated.displayPhoneNumber || displayPhoneNumber || normalizedPhoneNumberId),
      verifiedName: String(validated.verifiedName || verifiedName || ''),
      accessTokenEncrypted: encryptSensitiveValue(String(accessToken)),
      tokenType: String(tokenType || validated.tokenType || 'Bearer'),
      tokenExpiresAt: expiresIn ? new Date(Date.now() + Number(expiresIn) * 1000) : null,
      appScopedMetaUserId: String(validated.appScopedMetaUserId || ''),
      status: 'active',
      webhookSubscribed,
      connectedAt: new Date(),
      lastSyncAt: new Date(),
      metadata: {
        ...(validated.metadata || {}),
        accountName: String(accountName || label || ''),
      },
    },
  });

  recordAuditEvent({ req, action: 'whatsapp_account.connect', resource: 'whatsapp_account', resourceId: account._id, metadata: { connectionMode: 'manual', phoneNumberId: normalizedPhoneNumberId } });
  return res.status(200).json({ success: true, data: sanitizeAccount(account) });
});

const listAccounts = asyncHandler(async (req, res) => {
  const accounts = await WhatsAppAccount.find({ userId: req.user?.id }).sort({ createdAt: -1 }).lean();
  return res.status(200).json({ success: true, data: accounts.map(sanitizeAccount) });
});

const getAccount = asyncHandler(async (req, res) => {
  const active = await loadActiveWhatsAppAccountForUser(req.user?.id, { requireAccount: false });
  if (!active) {
    return res.status(200).json({ success: true, data: null });
  }

  if (active.source === 'legacy-env') {
    return res.status(200).json({
      success: true,
      data: {
        source: 'legacy-env',
        phoneNumberId: active.phoneNumberId || '',
        displayPhoneNumber: active.displayPhoneNumber || '',
        wabaId: active.wabaId || '',
        businessAccountId: active.businessAccountId || '',
        status: active.status || 'active',
      },
    });
  }

  return res.status(200).json({ success: true, data: sanitizeAccount(active.account) });
});

const activateAccount = asyncHandler(async (req, res) => {
  const account = await WhatsAppAccount.findOne({ _id: req.params.id, userId: req.user?.id });
  if (!account) throw new AppError('Account not found', 404);

  const wasDisconnected = account.status === 'disconnected';
  if (wasDisconnected) {
    // Reconnecting may re-claim a number someone else picked up in the meantime.
    await assertPhoneNumberAvailable({ phoneNumberId: account.phoneNumberId, userId: req.user?.id, excludeAccountId: account._id });
  }

  // Deactivate every other account first, then atomically flip the target
  // on via a single findOneAndUpdate. This isn't a full multi-document
  // transaction (this app also has to run against a plain standalone
  // MongoDB with no replica set, where transactions aren't available), but
  // it closes the "lost update" gap the previous read-then-.save() pattern
  // had: the response now always reflects the actually-persisted state of
  // the target account, rather than a JS-side object a concurrent
  // activation request could have silently overwritten between the read
  // and the save. The partial unique index on {userId, isActive:true}
  // still guarantees the database itself never holds two active accounts
  // for one user at once.
  await WhatsAppAccount.updateMany({ userId: req.user?.id, _id: { $ne: account._id } }, { $set: { isActive: false } });

  let updated;
  try {
    updated = await WhatsAppAccount.findOneAndUpdate(
      { _id: account._id, userId: req.user?.id },
      {
        $set: {
          isActive: true,
          numberClaimed: true,
          ...(wasDisconnected ? { status: 'active' } : {}),
        },
      },
      { new: true }
    );
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError('This WhatsApp number is already connected to a different account.', 409);
    }
    throw error;
  }

  if (!updated) throw new AppError('Account not found', 404);

  return res.status(200).json({ success: true, data: sanitizeAccount(updated) });
});

const getStatus = asyncHandler(async (req, res) => {
  const accountContext = await resolveCurrentWhatsAppAccount(req);
  const health = await checkWhatsAppHealth(accountContext);
  const accounts = await WhatsAppAccount.find({ userId: req.user?.id }).select('_id phoneNumberId displayPhoneNumber verifiedName status isActive').lean();

  return res.status(200).json({
    success: true,
    status: health.isConnected ? 'connected' : 'disconnected',
    data: accounts.map((account) => ({
      ...sanitizeAccount(account),
      displayName: account.displayPhoneNumber || account.phoneNumberId,
    })),
  });
});

const deleteAccount = asyncHandler(async (req, res) => {
  const existing = await WhatsAppAccount.findOne({ _id: req.params.id, userId: req.user?.id });
  if (!existing) throw new AppError('Account not found', 404);

  const wasActive = Boolean(existing.isActive);
  existing.status = 'disconnected';
  existing.isActive = false;
  existing.numberClaimed = false;
  await existing.save();

  if (wasActive) {
    const fallbackAccount = await WhatsAppAccount.findOne({
      userId: req.user?.id,
      _id: { $ne: existing._id },
      status: { $ne: 'disconnected' },
    }).sort({ updatedAt: -1 });

    if (fallbackAccount) {
      fallbackAccount.isActive = true;
      await fallbackAccount.save();
    }
  }

  recordAuditEvent({ req, action: 'whatsapp_account.delete', resource: 'whatsapp_account', resourceId: existing._id, metadata: { phoneNumberId: existing.phoneNumberId } });
  return res.status(200).json({ success: true, message: 'Account removed' });
});

const disconnectAccount = asyncHandler(async (req, res) => {
  const existing = await WhatsAppAccount.findOne({ _id: req.params.id, userId: req.user?.id });
  if (!existing) throw new AppError('Account not found', 404);

  existing.status = 'disconnected';
  existing.isActive = false;
  existing.webhookSubscribed = false;
  existing.numberClaimed = false;
  await existing.save();

  recordAuditEvent({ req, action: 'whatsapp_account.disconnect', resource: 'whatsapp_account', resourceId: existing._id, metadata: { phoneNumberId: existing.phoneNumberId } });
  return res.status(200).json({ success: true, data: sanitizeAccount(existing) });
});

const revalidateAccount = asyncHandler(async (req, res) => {
  const existing = await WhatsAppAccount.findOne({ _id: req.params.id, userId: req.user?.id });
  if (!existing) throw new AppError('Account not found', 404);

  const accountContext = {
    accessToken: decryptSensitiveValue(existing.accessTokenEncrypted),
    phoneNumberId: String(existing.phoneNumberId || ''),
    graphVersion: RESOLVED_API_VERSION,
  };
  const health = await checkWhatsAppHealth(accountContext);

  existing.status = health.isConnected ? 'active' : 'error';
  existing.lastSyncAt = new Date();
  await existing.save();

  return res.status(200).json({
    success: true,
    data: sanitizeAccount(existing),
    validation: health,
  });
});

// Meta's own guidance for BSPs is a Business-owned System User token
// (generated manually in Meta Business Manager, typically set to never
// expire) rather than a token tied to an individual admin's personal
// login. There's no API to auto-generate one — the admin pastes a token
// they already generated in Business Manager, and this verifies it
// actually works before switching the account over to it.
const setSystemUserToken = asyncHandler(async (req, res) => {
  const existing = await WhatsAppAccount.findOne({ _id: req.params.id, userId: req.user?.id });
  if (!existing) throw new AppError('Account not found', 404);

  const accessToken = String(req.body?.accessToken || '').trim();
  const systemUserId = String(req.body?.systemUserId || '').trim();
  if (!accessToken) throw new AppError('accessToken is required', 400);

  const health = await checkWhatsAppHealth({
    accessToken,
    phoneNumberId: existing.phoneNumberId,
    graphVersion: RESOLVED_API_VERSION,
  });
  if (!health.isConnected) {
    throw new AppError('Could not verify this token against the connected phone number', 400);
  }

  existing.accessTokenEncrypted = encryptSensitiveValue(accessToken);
  existing.tokenSource = 'system_user';
  existing.systemUserId = systemUserId;
  // Clearing this also removes the account from tokenRefreshService's
  // re-exchange candidates (belt-and-suspenders alongside its own
  // tokenSource filter) — System User tokens aren't refreshed that way.
  existing.tokenExpiresAt = null;
  existing.status = 'active';
  await existing.save();

  recordAuditEvent({ req, action: 'whatsapp_account.system_user_token_set', resource: 'whatsapp_account', resourceId: existing._id });

  return res.status(200).json({ success: true, data: sanitizeAccount(existing) });
});

const updateManualAccount = asyncHandler(async (req, res) => {
  const existing = await WhatsAppAccount.findOne({ _id: req.params.id, userId: req.user?.id });
  if (!existing) throw new AppError('Account not found', 404);
  if (existing.connectionMode !== 'manual') {
    throw new AppError('Only manual accounts can be updated here', 400);
  }

  const {
    accessToken,
    phoneNumberId,
    businessAccountId,
    wabaId,
    displayPhoneNumber,
    verifiedName,
    accountName,
    label,
  } = req.body || {};

  const resolvedAccessToken =
    String(accessToken || '').trim() ||
    (existing.accessTokenEncrypted ? decryptSensitiveValue(existing.accessTokenEncrypted) : '');
  const resolvedPhoneNumberId = String(phoneNumberId || existing.phoneNumberId || '').trim();
  const resolvedBusinessAccountId = String(businessAccountId || existing.businessAccountId || '').trim();
  const resolvedWabaId = String(wabaId || existing.wabaId || '').trim();

  if (!resolvedAccessToken || !resolvedPhoneNumberId || (!resolvedBusinessAccountId && !resolvedWabaId)) {
    throw new AppError('accessToken, phoneNumberId and businessAccountId or wabaId are required', 400);
  }

  const validated = await validateManualWhatsAppCredentials({
    accessToken: resolvedAccessToken,
    phoneNumberId: resolvedPhoneNumberId,
    businessAccountId: resolvedBusinessAccountId,
    wabaId: resolvedWabaId,
  });

  const newPhoneNumberId = String(validated.phoneNumberId || resolvedPhoneNumberId);
  if (newPhoneNumberId !== existing.phoneNumberId) {
    await assertPhoneNumberAvailable({ phoneNumberId: newPhoneNumberId, userId: req.user?.id, excludeAccountId: existing._id });
  }

  existing.phoneNumberId = newPhoneNumberId;
  existing.businessAccountId = String(validated.businessAccountId || resolvedBusinessAccountId);
  existing.wabaId = String(validated.wabaId || resolvedWabaId);
  existing.displayPhoneNumber = String(validated.displayPhoneNumber || displayPhoneNumber || existing.displayPhoneNumber || existing.phoneNumberId);
  existing.verifiedName = String(validated.verifiedName || verifiedName || existing.verifiedName || '');
  existing.accessTokenEncrypted = encryptSensitiveValue(resolvedAccessToken);
  existing.appScopedMetaUserId = String(validated.appScopedMetaUserId || existing.appScopedMetaUserId || '');
  existing.status = 'active';
  existing.numberClaimed = true;
  existing.lastSyncAt = new Date();
  existing.metadata = {
    ...(existing.metadata || {}),
    ...(validated.metadata || {}),
    accountName: String(accountName || label || existing.metadata?.accountName || ''),
  };

  try {
    await existing.save();
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError('This WhatsApp number is already connected to a different account.', 409);
    }
    throw error;
  }

  return res.status(200).json({ success: true, data: sanitizeAccount(existing) });
});

const sendText = asyncHandler(async (req, res) => {
  const { to, text, body, message } = req.body || {};
  const resolvedText = String(text || body || message || '').trim();
  if (!to || !resolvedText) throw new AppError('to and text are required', 400);
  const accountContext = await resolveCurrentWhatsAppAccount(req);
  const data = await dispatchTextMessage({ accountContext, userId: req.user?.id, to, body: resolvedText });
  return res.status(200).json({ success: true, data });
});

const sendTemplate = asyncHandler(async (req, res) => {
  const {
    to,
    templateName,
    template_name,
    language = 'en_US',
    components = [],
    Components = [],
  } = req.body || {};
  const resolvedTemplate = String(templateName || template_name || '').trim();
  if (!to || !resolvedTemplate) throw new AppError('to and templateName are required', 400);

  const normalizedComponents = Array.isArray(components)
    ? components
    : Array.isArray(Components)
    ? Components
    : [];

  const accountContext = await resolveCurrentWhatsAppAccount(req);
  const data = await dispatchTemplateMessage({
    accountContext,
    userId: req.user?.id,
    to,
    templateName: resolvedTemplate,
    language,
    components: normalizedComponents,
  });

  return res.status(200).json({ success: true, data });
});

const sendMedia = asyncHandler(async (req, res) => {
  const { to, type, caption } = req.body || {};
  if (!to || !type) throw new AppError('to and type are required', 400);
  const accountContext = await resolveCurrentWhatsAppAccount(req);

  if (req.file) {
    const uploaded = await uploadBufferToCloudinary({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype || '',
      folder: 'whatsapp_media',
    });

    const data = await dispatchMediaMessage({
      accountContext,
      userId: req.user?.id,
      to,
      type,
      link: uploaded.secure_url,
      caption: caption || '',
      filename: req.file.originalname || '',
    });

    return res.status(200).json({ success: true, data });
  }

  const link = req.body?.link || req.body?.mediaUrl || req.body?.imageUrl || req.body?.documentUrl || '';
  if (!link) throw new AppError('file or media link is required', 400);

  const data = await dispatchMediaMessage({
    accountContext,
    userId: req.user?.id,
    to,
    type,
    link,
    caption: caption || '',
    filename: req.body?.filename || '',
  });

  return res.status(200).json({ success: true, data });
});

const sendMessage = asyncHandler(async (req, res) => {
  const { type } = req.body || {};
  if (type === 'text') return sendText(req, res);
  if (type === 'template') return sendTemplate(req, res);
  if (['image', 'video', 'audio', 'document'].includes(String(type || '').toLowerCase())) return sendMedia(req, res);
  throw new AppError('Unsupported type. Use text, template, image, video, audio, document', 400);
});

const sendBroadcast = asyncHandler(async (req, res) => {
  const {
    recipients = [],
    contacts = [],
    messageType = 'text',
    text = '',
    body = '',
    templateName = '',
    language = 'en_US',
    components = [],
    campaignId,
  } = req.body || {};

  const incomingRecipients = Array.isArray(recipients) && recipients.length ? recipients : contacts;
  const normalizedRecipients = incomingRecipients
    .map((item) => (typeof item === 'string' ? item : item?.phone || item?.mobile || item?.number || ''))
    .map((item) => normalizePhone(item))
    .filter(Boolean);

  const uniqueRecipients = [...new Set(normalizedRecipients)];
  if (!uniqueRecipients.length) throw new AppError('recipients must be a non-empty array', 400);

  const resolvedBody = String(text || body || '').trim();
  if (String(messageType).toLowerCase() === 'text' && !resolvedBody) throw new AppError('Text message body is required', 400);
  if (String(messageType).toLowerCase() === 'template' && !String(templateName || '').trim()) throw new AppError('templateName is required', 400);

  const accountContext = await resolveCurrentWhatsAppAccount(req);
  const accountId = accountContext?.account?._id;
  if (!accountId) throw new AppError('A connected WhatsApp account is required to send a broadcast', 400);

  const finalCampaignId = String(campaignId || `campaign_${Date.now()}`);

  // Queued instead of sent in a blocking loop: each recipient gets its own
  // BullMQ job with automatic retry/backoff, and the batch survives a
  // process restart mid-send. Waiting for the batch to finish here (rather
  // than returning immediately) keeps this endpoint's response shape
  // unchanged — the frontend (BulkSender.jsx) reads response.data.results
  // synchronously — while still gaining retry/durability underneath.
  const jobs = await enqueueBroadcastRecipients({
    accountId,
    userId: req.user?.id,
    recipients: uniqueRecipients,
    messageType: String(messageType).toLowerCase(),
    body: resolvedBody,
    templateName,
    language,
    components,
    campaignId: finalCampaignId,
  });
  const results = await waitForJobResults(jobs);

  return res.status(200).json({
    success: true,
    campaignId: finalCampaignId,
    total: uniqueRecipients.length,
    sent: results.filter((item) => item.success).length,
    failed: results.filter((item) => !item.success).length,
    results,
  });
});

const normalizeCatalogRows = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((row) => (row && typeof row === 'object' ? row : null))
    .filter(Boolean)
    .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key || '').trim(), value == null ? '' : String(value).trim()])))
    .filter((row) => Object.values(row).some((value) => String(value || '').trim()));

const normalizeAutoReplyPayload = (payload = {}) => {
  const ruleType = String(payload.ruleType || 'keyword').toLowerCase();
  const replyType = String(payload.replyType || payload.replyMode || 'text').toLowerCase();

  return {
    ...payload,
    ruleType,
    replyType,
    reply: String(payload.reply || (replyType === 'template' ? payload.templateName : payload.replyText) || '').trim(),
    templateLanguage: String(payload.templateLanguage || payload.language || 'en_US').trim() || 'en_US',
    isActive:
      typeof payload.isActive === 'boolean'
        ? payload.isActive
        : typeof payload.active === 'boolean'
        ? payload.active
        : true,
    catalogRows: ruleType === 'product_catalog' ? normalizeCatalogRows(payload.catalogRows) : [],
    catalogConfig: ruleType === 'product_catalog' ? buildCatalogConfigFromPayload(payload) : undefined,
  };
};

const createAutoReplyRule = asyncHandler(async (req, res) => {
  const accountContext = await resolveCurrentWhatsAppAccount(req, { requireAccount: false });
  const normalizedPayload = normalizeAutoReplyPayload(req.body || {});
  const rule = await AutoReply.create({
    ...normalizedPayload,
    userId: req.user?.id,
    whatsappAccountId: accountContext?.account?._id,
  });
  return res.status(201).json({ success: true, data: rule });
});

const updateAutoReplyRule = asyncHandler(async (req, res) => {
  const accountContext = await resolveCurrentWhatsAppAccount(req, { requireAccount: false });
  const normalizedPayload = normalizeAutoReplyPayload(req.body || {});
  const baseFilter = {
    _id: req.params.id,
    $or: [
      { userId: req.user?.id, ...(accountContext?.account?._id ? { whatsappAccountId: accountContext.account._id } : {}) },
      { userId: { $exists: false } },
      { userId: null },
    ],
  };
  const rule = await AutoReply.findOneAndUpdate(baseFilter, {
    ...normalizedPayload,
    userId: req.user?.id,
    whatsappAccountId: accountContext?.account?._id,
  }, { new: true });
  if (!rule) throw new AppError('Auto reply rule not found', 404);
  return res.status(200).json({ success: true, data: rule });
});

const deleteAutoReplyRule = asyncHandler(async (req, res) => {
  const accountContext = await resolveCurrentWhatsAppAccount(req, { requireAccount: false });
  const deleted = await AutoReply.findOneAndDelete({
    _id: req.params.id,
    $or: [
      { userId: req.user?.id, ...(accountContext?.account?._id ? { whatsappAccountId: accountContext.account._id } : {}) },
      { userId: { $exists: false } },
      { userId: null },
    ],
  });
  if (!deleted) throw new AppError('Auto reply rule not found', 404);
  return res.status(200).json({ success: true, message: 'Rule deleted' });
});

const toggleAutoReplyRule = asyncHandler(async (req, res) => {
  const accountContext = await resolveCurrentWhatsAppAccount(req, { requireAccount: false });
  const current = await AutoReply.findOne({
    _id: req.params.id,
    userId: req.user?.id,
    ...(accountContext?.account?._id ? { whatsappAccountId: accountContext.account._id } : {}),
  });
  if (!current) throw new AppError('Auto reply rule not found', 404);
  current.isActive = !current.isActive;
  await current.save();
  return res.status(200).json({ success: true, data: current });
});

const getAutoReplyRules = asyncHandler(async (req, res) => {
  const accountContext = await resolveCurrentWhatsAppAccount(req, { requireAccount: false });
  const scopedFilter = {
    userId: req.user?.id,
    ...(accountContext?.account?._id ? { whatsappAccountId: accountContext.account._id } : {}),
  };

  let data = await AutoReply.find(scopedFilter).sort({ createdAt: -1 }).lean();

  if (!data.length) {
    data = await AutoReply.find({
      $or: [
        { userId: { $exists: false } },
        { userId: null },
        { userId: '' },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  return res.status(200).json({ success: true, data });
});

const normalizeWorkflowPayload = (payload = {}) => ({
  name: String(payload.name || '').trim(),
  keyword: String(payload.keyword || '').trim(),
  matchType: ['exact', 'contains', 'starts_with'].includes(String(payload.matchType || '').toLowerCase())
    ? String(payload.matchType).toLowerCase()
    : 'contains',
  isActive: typeof payload.isActive === 'boolean' ? payload.isActive : true,
  steps: (Array.isArray(payload.steps) ? payload.steps : [])
    .map((step) => ({
      delaySeconds: Math.min(3600, Math.max(0, Number(step?.delaySeconds) || 0)),
      replyType: String(step?.replyType || 'text').toLowerCase() === 'template' ? 'template' : 'text',
      reply: String(step?.reply || '').trim(),
      templateLanguage: String(step?.templateLanguage || 'en_US').trim() || 'en_US',
    }))
    .filter((step) => step.reply),
});

const createWorkflow = asyncHandler(async (req, res) => {
  const accountContext = await resolveCurrentWhatsAppAccount(req, { requireAccount: false });
  const payload = normalizeWorkflowPayload(req.body || {});
  if (!payload.name) throw new AppError('Workflow name is required', 400);
  if (!payload.keyword) throw new AppError('Trigger keyword is required', 400);
  if (!payload.steps.length) throw new AppError('At least one step is required', 400);

  const workflow = await Workflow.create({
    ...payload,
    userId: req.user?.id,
    whatsappAccountId: accountContext?.account?._id,
  });
  return res.status(201).json({ success: true, data: workflow });
});

const updateWorkflow = asyncHandler(async (req, res) => {
  const payload = normalizeWorkflowPayload(req.body || {});
  if (!payload.name) throw new AppError('Workflow name is required', 400);
  if (!payload.keyword) throw new AppError('Trigger keyword is required', 400);
  if (!payload.steps.length) throw new AppError('At least one step is required', 400);

  const workflow = await Workflow.findOneAndUpdate(
    { _id: req.params.id, userId: req.user?.id },
    payload,
    { new: true, runValidators: true }
  );
  if (!workflow) throw new AppError('Workflow not found', 404);
  return res.status(200).json({ success: true, data: workflow });
});

const deleteWorkflow = asyncHandler(async (req, res) => {
  const deleted = await Workflow.findOneAndDelete({ _id: req.params.id, userId: req.user?.id });
  if (!deleted) throw new AppError('Workflow not found', 404);
  return res.status(200).json({ success: true });
});

const toggleWorkflow = asyncHandler(async (req, res) => {
  const workflow = await Workflow.findOne({ _id: req.params.id, userId: req.user?.id });
  if (!workflow) throw new AppError('Workflow not found', 404);
  workflow.isActive = !workflow.isActive;
  await workflow.save();
  return res.status(200).json({ success: true, data: workflow });
});

const getWorkflows = asyncHandler(async (req, res) => {
  const accountContext = await resolveCurrentWhatsAppAccount(req, { requireAccount: false });
  const filter = {
    userId: req.user?.id,
    ...(accountContext?.account?._id ? { whatsappAccountId: accountContext.account._id } : {}),
  };
  const data = await Workflow.find(filter).sort({ createdAt: -1 }).lean();
  return res.status(200).json({ success: true, data });
});

// Runs a matched workflow's steps in order, each after its own delay
// (cumulative from trigger time) — same fire-and-forget setTimeout
// reliability model AutoReply already uses; not durable across a process
// restart mid-sequence, consistent with existing behavior rather than a
// regression. A BullMQ-backed delayed-job version is a reasonable
// follow-up if steps need to survive restarts.
const runWorkflowSteps = (workflow, matchedAccount, payload) => {
  let cumulativeDelayMs = 0;
  for (const step of workflow.steps) {
    cumulativeDelayMs += Math.max(0, Number(step.delaySeconds) || 0) * 1000;
    const stepDelayMs = cumulativeDelayMs;

    setTimeout(async () => {
      try {
        const accountContext = await loadWhatsAppAccountByPhoneNumberId(payload.phoneNumberId);
        if (step.replyType === 'template') {
          await dispatchTemplateMessage({
            accountContext,
            userId: matchedAccount.userId,
            to: payload.from,
            templateName: step.reply,
            language: step.templateLanguage || 'en_US',
            components: [],
          });
        } else {
          await dispatchTextMessage({
            accountContext,
            userId: matchedAccount.userId,
            to: payload.from,
            body: step.reply,
          });
        }
      } catch (error) {
        logger.error('[whatsapp] workflow step failed:', error.message);
      }
    }, stepDelayMs);
  }
};

const normalizeContactPayload = (payload = {}) => ({
  phone:    normalizePhone(payload.phone || payload.mobile || payload.number),
  name:     String(payload.name || payload.fullName || '').trim(),
  email:    String(payload.email || '').trim(),
  city:     String(payload.city || '').trim(),
  state:    String(payload.state || '').trim(),
  company:  String(payload.company || '').trim(),
  notes:    String(payload.notes || '').trim(),
  category: String(payload.category || '').trim(),
  tags: Array.isArray(payload.tags)
    ? payload.tags.map(t => String(t).trim()).filter(Boolean)
    : String(payload.tags || '').split(',').map(t => String(t).trim()).filter(Boolean),
  assignedAgent: String(payload.assignedAgent || '').trim(),
  customFields:
    payload.customFields && typeof payload.customFields === 'object' && !Array.isArray(payload.customFields)
      ? payload.customFields
      : {},
});

const buildScopedContactFilter = (req, accountContext) => ({
  $or: [
    { userId: req.user?.id, ...(accountContext?.account?._id ? { whatsappAccountId: accountContext.account._id } : {}) },
    { userId: { $exists: false } },
    { userId: null },
  ],
});

const getContacts = asyncHandler(async (req, res) => {
  const accountContext = await resolveCurrentWhatsAppAccount(req, { requireAccount: false });
  const search   = String(req.query.search   || '').trim();
  const category = String(req.query.category || '').trim();
  const tag      = String(req.query.tag      || '').trim();
  const page     = Math.max(1, parseInt(req.query.page)  || 1);
  const limit    = Math.min(5000, Math.max(1, parseInt(req.query.limit) || 50));
  const skip     = (page - 1) * limit;

  const scope = buildScopedContactFilter(req, accountContext);
  const filter = {
    ...scope,
    ...(search   ? { $or: [{ name: { $regex: search, $options: 'i' } }, { phone: { $regex: normalizePhone(search), $options: 'i' } }] } : {}),
    ...(category ? { category } : {}),
    ...(tag      ? { tags: tag } : {}),
  };

  const [data, total, categories] = await Promise.all([
    Contact.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    Contact.countDocuments(filter),
    Contact.distinct('category', scope).then(cats => cats.filter(Boolean).sort()),
  ]);

  return res.status(200).json({
    success: true, data, total, page, limit,
    pages: Math.ceil(total / limit),
    categories,
  });
});

// Fire-and-forget fan-out of a contact lifecycle event to every active
// WebhookDestination on this account — the same self-service, HMAC-signed
// mechanism already used for inbound messages (forwardToWebhookDestinations,
// below). This is the "CRM connector": rather than build a bespoke
// integration for one vendor, any external CRM (via Zapier, Make, or a
// custom receiver) can subscribe to contact.upserted/contact.deleted events
// through the same webhook destinations a user already manages.
const notifyContactWebhooks = (accountId, event, contact) => {
  if (!accountId) return;
  forwardToWebhookDestinations(accountId, { event, contact }).catch((err) =>
    logger.error('[crm-webhook] contact event fan-out failed:', err.message)
  );
};

const createContact = asyncHandler(async (req, res) => {
  const accountContext = await resolveCurrentWhatsAppAccount(req, { requireAccount: false });
  const payload = normalizeContactPayload(req.body || {});
  if (!payload.phone) throw new AppError('Phone is required', 400);
  const data = await Contact.findOneAndUpdate(
    { userId: req.user?.id, phone: payload.phone },
    { $set: { ...payload, userId: req.user?.id, whatsappAccountId: accountContext?.account?._id || null } },
    { upsert: true, new: true }
  );
  notifyContactWebhooks(accountContext?.account?._id, 'contact.upserted', data);
  return res.status(201).json({ success: true, data });
});

const updateContact = asyncHandler(async (req, res) => {
  const accountContext = await resolveCurrentWhatsAppAccount(req, { requireAccount: false });
  const payload  = normalizeContactPayload(req.body || {});
  const existing = await Contact.findOne({ _id: req.params.id, ...buildScopedContactFilter(req, accountContext) });
  if (!existing) throw new AppError('Contact not found', 404);
  if (payload.phone) existing.phone = payload.phone;
  Object.assign(existing, {
    name: payload.name, email: payload.email, city: payload.city, state: payload.state,
    company: payload.company, notes: payload.notes, category: payload.category,
    tags: payload.tags, assignedAgent: payload.assignedAgent, customFields: payload.customFields,
  });
  await existing.save();
  notifyContactWebhooks(accountContext?.account?._id, 'contact.upserted', existing);
  return res.status(200).json({ success: true, data: existing });
});

const deleteContact = asyncHandler(async (req, res) => {
  const accountContext = await resolveCurrentWhatsAppAccount(req, { requireAccount: false });
  const deleted = await Contact.findOneAndDelete({ _id: req.params.id, ...buildScopedContactFilter(req, accountContext) });
  if (!deleted) throw new AppError('Contact not found', 404);
  notifyContactWebhooks(accountContext?.account?._id, 'contact.deleted', { _id: deleted._id, phone: deleted.phone });
  return res.status(200).json({ success: true });
});

const bulkUpdateContacts = asyncHandler(async (req, res) => {
  const { ids, category, tags } = req.body;
  if (!Array.isArray(ids) || !ids.length) throw new AppError('ids must be a non-empty array', 400);
  const accountContext = await resolveCurrentWhatsAppAccount(req, { requireAccount: false });
  const scopeFilter   = buildScopedContactFilter(req, accountContext);
  const update = {};
  if (category !== undefined) update.category = String(category || '').trim();
  if (Array.isArray(tags))    update.tags = tags.map(t => String(t).trim()).filter(Boolean);
  if (!Object.keys(update).length) throw new AppError('Provide category or tags to update', 400);
  const result = await Contact.updateMany({ _id: { $in: ids }, ...scopeFilter }, { $set: update });
  return res.status(200).json({ success: true, modified: result.modifiedCount });
});

const importContacts = asyncHandler(async (req, res) => {
  const accountContext = await resolveCurrentWhatsAppAccount(req, { requireAccount: false });
  const rows = Array.isArray(req.body?.contacts) ? req.body.contacts : [];
  if (!rows.length) throw new AppError('contacts must be a non-empty array', 400);

  const userId = req.user?.id;
  const waId   = accountContext?.account?._id || null;
  const ops    = [];
  let skipped  = 0;

  for (const row of rows) {
    const payload = normalizeContactPayload(row);
    if (!payload.phone) { skipped++; continue; }
    ops.push({
      updateOne: {
        filter: { userId, phone: payload.phone },
        update: { $set: { ...payload, userId, whatsappAccountId: waId } },
        upsert: true,
      },
    });
  }

  if (!ops.length) return res.status(200).json({ success: true, imported: 0, failed: skipped, errors: [] });

  try {
    const result = await Contact.bulkWrite(ops, { ordered: false });
    const imported = (result.upsertedCount || 0) + (result.modifiedCount || 0) + (result.matchedCount || 0);
    return res.status(200).json({ success: true, imported, failed: skipped, errors: [] });
  } catch (err) {
    // bulkWrite with ordered:false returns a BulkWriteError with partial results
    const result = err.result || {};
    const imported = (result.nUpserted || 0) + (result.nModified || 0);
    const writeErrors = (err.writeErrors || []).slice(0, 20).map(e => ({
      phone: ops[e.index]?.updateOne?.filter?.phone,
      error: e.errmsg || e.message,
    }));
    return res.status(200).json({ success: true, imported, failed: skipped + (err.writeErrors?.length || 0), errors: writeErrors });
  }
});

const buildCatalogConfigFromPayload = (payload = {}) => {
  const catalogConfig = payload.catalogConfig && typeof payload.catalogConfig === 'object' ? payload.catalogConfig : {};
  return {
    menuTitle: String(catalogConfig.menuTitle || payload.menuTitle || 'Product Price Finder').trim(),
    menuIntro: String(catalogConfig.menuIntro || payload.menuIntro || 'Choose product options to get the latest price.').trim(),
    selectionFields: Array.isArray(catalogConfig.selectionFields) ? catalogConfig.selectionFields.map((field) => String(field || '').trim()).filter(Boolean) : getCatalogFields(payload),
  };
};

const getTemplates = asyncHandler(async (req, res) => {
  const accountContext = await resolveCurrentWhatsAppAccount(req);
  const wabaId = String(accountContext.wabaId || accountContext.businessAccountId || '').trim();
  const accessToken = String(accountContext.accessToken || '').trim();
  if (!accessToken || !wabaId) throw new AppError('Missing WhatsApp credentials', 400);

  try {
    const response = await axios.get(
      `https://graph.facebook.com/${RESOLVED_API_VERSION}/${wabaId}/message_templates`,
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 15000 }
    );

    return res.status(200).json({ success: true, templates: Array.isArray(response?.data?.data) ? response.data.data : [] });
  } catch (error) {
    throw normalizeWhatsAppApiError(error, 'Failed to load WhatsApp templates');
  }
});

const TEMPLATE_NAME_PATTERN = /^[a-z0-9_]{1,512}$/;
const TEMPLATE_CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];

// Meta requires an example value for every {{n}} variable in a text
// component ("example.body_text"/"example.header_text") — without it,
// templates with variables are auto-rejected (reviewers/automation have no
// real content to evaluate the template against). Variables must also be
// numbered 1..N with no gaps.
const extractVariableNumbers = (text) =>
  Array.from(new Set(Array.from(String(text || '').matchAll(/\{\{(\d+)\}\}/g), (m) => Number(m[1])))).sort((a, b) => a - b);

const validateVariablesHaveExamples = (text, examples, label) => {
  const variableNumbers = extractVariableNumbers(text);
  if (!variableNumbers.length) return null;

  const isSequential = variableNumbers.every((n, i) => n === i + 1);
  if (!isSequential) throw new AppError(`${label} variables must be numbered {{1}}, {{2}}, ... with no gaps`, 400);

  const resolvedExamples = (Array.isArray(examples) ? examples : []).map((v) => String(v || '').trim());
  if (resolvedExamples.length !== variableNumbers.length || resolvedExamples.some((v) => !v)) {
    throw new AppError(`Provide an example value for each ${label} variable ({{1}}..{{${variableNumbers.length}}})`, 400);
  }
  return resolvedExamples;
};

const createTemplate = asyncHandler(async (req, res) => {
  const {
    name,
    category,
    language = 'en_US',
    header = '',
    headerExample = '',
    body,
    bodyExamples = [],
    footer = '',
  } = req.body || {};

  const resolvedName = String(name || '').trim().toLowerCase();
  const resolvedCategory = String(category || '').trim().toUpperCase();
  const resolvedBody = String(body || '').trim();

  if (!TEMPLATE_NAME_PATTERN.test(resolvedName)) {
    throw new AppError('Template name must use only lowercase letters, numbers, and underscores', 400);
  }
  if (!TEMPLATE_CATEGORIES.includes(resolvedCategory)) {
    throw new AppError(`category must be one of ${TEMPLATE_CATEGORIES.join(', ')}`, 400);
  }
  if (!resolvedBody) throw new AppError('body is required', 400);

  const resolvedBodyExamples = validateVariablesHaveExamples(resolvedBody, bodyExamples, 'body');
  const bodyComponent = { type: 'BODY', text: resolvedBody };
  if (resolvedBodyExamples) bodyComponent.example = { body_text: [resolvedBodyExamples] };
  const components = [bodyComponent];

  const resolvedHeader = String(header || '').trim();
  if (resolvedHeader) {
    const resolvedHeaderExamples = validateVariablesHaveExamples(resolvedHeader, [headerExample], 'header');
    const headerComponent = { type: 'HEADER', format: 'TEXT', text: resolvedHeader };
    if (resolvedHeaderExamples) headerComponent.example = { header_text: resolvedHeaderExamples };
    components.push(headerComponent);
  }
  const resolvedFooter = String(footer || '').trim();
  if (resolvedFooter) components.push({ type: 'FOOTER', text: resolvedFooter });

  const accountContext = await resolveCurrentWhatsAppAccount(req);
  const wabaId = String(accountContext.wabaId || accountContext.businessAccountId || '').trim();
  const accessToken = String(accountContext.accessToken || '').trim();
  if (!accessToken || !wabaId) throw new AppError('Missing WhatsApp credentials', 400);

  try {
    const response = await axios.post(
      `https://graph.facebook.com/${RESOLVED_API_VERSION}/${wabaId}/message_templates`,
      { name: resolvedName, category: resolvedCategory, language, components },
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, timeout: 15000 }
    );

    recordAuditEvent({ req, action: 'whatsapp_template.create', resource: 'whatsapp_template', metadata: { name: resolvedName, category: resolvedCategory } });
    return res.status(201).json({ success: true, data: response?.data });
  } catch (error) {
    throw normalizeWhatsAppApiError(error, 'Failed to create WhatsApp template');
  }
});

const getMessages = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const accountContext = await resolveCurrentWhatsAppAccount(req, { requireAccount: false });
  const ownershipClauses = [{ userId: req.user?.id }];
  if (accountContext?.account?._id) ownershipClauses.push({ whatsappAccountId: accountContext.account._id });
  const filter = ownershipClauses.length === 1 ? ownershipClauses[0] : { $or: ownershipClauses };

  const [data, total] = await Promise.all([
    Message.find(filter).sort({ timestamp: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    Message.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    data,
    pagination: { page, limit, total, hasMore: skip + data.length < total },
  });
});

const getConversations = asyncHandler(async (req, res) => {
  const accountContext = await resolveCurrentWhatsAppAccount(req, { requireAccount: false });
  const ownershipClauses = [{ userId: req.user?.id }];
  if (accountContext?.account?._id) ownershipClauses.push({ whatsappAccountId: accountContext.account._id });
  const matchStage = ownershipClauses.length === 1 ? ownershipClauses[0] : { $or: ownershipClauses };

  const conversations = await Message.aggregate([
    { $match: matchStage },
    {
      $addFields: {
        chatKey: {
          $cond: [{ $eq: ['$direction', 'incoming'] }, '$from', '$to'],
        },
      },
    },
    { $sort: { timestamp: -1, createdAt: -1 } },
    {
      $group: {
        _id: '$chatKey',
        lastMessage: { $first: '$message' },
        lastTimestamp: { $first: '$timestamp' },
        direction: { $first: '$direction' },
      },
    },
    { $sort: { lastTimestamp: -1 } },
  ]);

  const phones = conversations.map((item) => normalizePhone(item._id)).filter(Boolean);
  const contacts = await Contact.find({ phone: { $in: phones } }).lean();
  const contactMap = new Map(contacts.map((c) => [c.phone, c]));
  const assignments = accountContext?.account?._id
    ? await conversationAssignmentService.getAssignmentsForAccount(accountContext.account._id)
    : new Map();

  let data = conversations.map((item) => {
    const phone = normalizePhone(item._id);
    const contact = contactMap.get(phone);
    return {
      phone,
      name: contact?.name || phone,
      lastMessage: item.lastMessage,
      lastTimestamp: item.lastTimestamp,
      direction: item.direction,
      assignedToUserId: assignments.get(phone) || null,
    };
  });

  const assignedToFilter = String(req.query.assignedTo || '').trim();
  if (assignedToFilter === 'me') {
    data = data.filter((item) => item.assignedToUserId === String(req.user?.id));
  } else if (assignedToFilter === 'unassigned') {
    data = data.filter((item) => !item.assignedToUserId);
  } else if (assignedToFilter) {
    data = data.filter((item) => item.assignedToUserId === assignedToFilter);
  }

  return res.status(200).json({ success: true, data });
});

const assignConversation = asyncHandler(async (req, res) => {
  const accountContext = await resolveCurrentWhatsAppAccount(req);
  const phone = normalizePhone(req.params.phone);
  if (!phone) throw new AppError('A valid phone number is required', 400);

  const assignedToUserId = req.body?.userId ? String(req.body.userId) : null;
  if (assignedToUserId) {
    const account = accountContext.account;
    const isOwner = String(account.userId) === assignedToUserId;
    const isTeamMember = (account.teamMemberIds || []).some((id) => String(id) === assignedToUserId);
    if (!isOwner && !isTeamMember) {
      throw new AppError('Can only assign to the account owner or a team member', 400);
    }
  }

  const assignment = await conversationAssignmentService.setAssignment({
    whatsappAccountId: accountContext.account._id,
    contactPhone: phone,
    assignedToUserId,
  });

  return res.status(200).json({ success: true, data: { phone, assignedToUserId: assignment.assignedToUserId } });
});

const getTeamMembers = asyncHandler(async (req, res) => {
  const account = await WhatsAppAccount.findOne({ _id: req.params.id, userId: req.user?.id });
  if (!account) throw new AppError('Account not found', 404);
  const members = await teamService.listTeamMembers(account);
  return res.status(200).json({
    success: true,
    data: members.map((m) => ({ id: m._id, name: m.name, mobile: m.mobile, email: m.email })),
  });
});

const addTeamMemberHandler = asyncHandler(async (req, res) => {
  const member = await teamService.addTeamMember({
    accountId: req.params.id,
    ownerUserId: req.user?.id,
    mobile: req.body?.mobile,
  });
  recordAuditEvent({ req, action: 'team_member.add', resource: 'whatsapp_account', resourceId: req.params.id, metadata: { memberUserId: member._id } });
  return res.status(201).json({ success: true, data: { id: member._id, name: member.name, mobile: member.mobile, email: member.email } });
});

const removeTeamMemberHandler = asyncHandler(async (req, res) => {
  await teamService.removeTeamMember({
    accountId: req.params.id,
    ownerUserId: req.user?.id,
    memberUserId: req.params.memberId,
  });
  recordAuditEvent({ req, action: 'team_member.remove', resource: 'whatsapp_account', resourceId: req.params.id, metadata: { memberUserId: req.params.memberId } });
  return res.status(200).json({ success: true });
});

const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = getWebhookVerifyToken();

  if (!verifyToken) {
    logger.error('[WhatsApp] WHATSAPP_WEBHOOK_VERIFY_TOKEN not configured — rejecting verification');
    return res.sendStatus(403);
  }
  if (mode === 'subscribe' && token === verifyToken) return res.status(200).send(challenge);
  return res.sendStatus(403);
};

const parseIncoming = (msg = {}) => {
  const type = String(msg.type || 'text').toLowerCase();
  if (type === 'text') return { type, message: String(msg.text?.body || ''), mediaId: '' };
  if (['image', 'video', 'audio', 'sticker', 'document'].includes(type)) {
    const mediaNode = msg[type] || {};
    return {
      type,
      message: String(mediaNode.caption || mediaNode.id || ''),
      mediaId: String(mediaNode.id || ''),
    };
  }
  if (type === 'interactive') {
    const iType = msg.interactive?.type;
    let interactiveId = '';
    let text = '';
    if (iType === 'button_reply') {
      interactiveId = msg.interactive.button_reply?.id || '';
      text = msg.interactive.button_reply?.title || '';
    } else if (iType === 'list_reply') {
      interactiveId = msg.interactive.list_reply?.id || '';
      text = msg.interactive.list_reply?.title || '';
    } else {
      interactiveId = JSON.stringify(msg.interactive || {});
    }
    return { type, message: text || interactiveId, mediaId: '', interactiveId };
  }
  if (type === 'button') {
    // Legacy quick-reply button tap (older template format, distinct from
    // the "interactive" button_reply/list_reply message type above).
    const interactiveId = msg.button?.payload || '';
    return { type, message: msg.button?.text || interactiveId, mediaId: '', interactiveId };
  }
  return null;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Free-tier destinations (Render, etc.) commonly spin down when idle, so the
// first delivery attempt can hit a cold-start 429/503/timeout even though the
// service is otherwise fine. Retry a couple of times with backoff before
// recording a real failure.
const WEBHOOK_FORWARD_RETRY_DELAYS_MS = [5000, 15000];

async function postToWebhookDestination(dest, payload, body, signature) {
  let lastError = null;
  for (let attempt = 0; attempt <= WEBHOOK_FORWARD_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await axios.post(dest.url, payload, {
        timeout: 8000,
        headers: {
          'Content-Type': 'application/json',
          'X-Metabsp-Event': 'message.received',
          'X-Metabsp-Signature-256': signature,
        },
      });
      return { ok: true };
    } catch (err) {
      lastError = err;
      const delay = WEBHOOK_FORWARD_RETRY_DELAYS_MS[attempt];
      if (delay === undefined) break;
      logger.warn(`[webhook-destinations] attempt ${attempt + 1} failed for ${dest.url} (${err.message}), retrying in ${delay}ms`);
      await sleep(delay);
    }
  }
  return { ok: false, error: lastError };
}

// Self-service multi-project webhook fan-out: every active WebhookDestination
// registered against the matched WhatsApp account gets the parsed message
// payload, HMAC-signed with that destination's own secret so the receiving
// project can verify authenticity without needing Meta's app secret.
async function forwardToWebhookDestinations(whatsappAccountId, payload) {
  const destinations = await WebhookDestination.find({ whatsappAccountId, isActive: true }).lean();
  if (!destinations.length) return;

  const body = JSON.stringify(payload);

  await Promise.allSettled(
    destinations.map(async (dest) => {
      const signature = 'sha256=' + crypto.createHmac('sha256', dest.secret).update(body).digest('hex');
      const result = await postToWebhookDestination(dest, payload, body, signature);

      if (result.ok) {
        await WebhookDestination.updateOne(
          { _id: dest._id },
          { $set: { lastAttemptAt: new Date(), lastStatus: 'success', lastError: '' } }
        );
      } else {
        logger.error('[webhook-destinations] forward failed after retries:', dest.url, result.error?.message);
        await WebhookDestination.updateOne(
          { _id: dest._id },
          { $set: { lastAttemptAt: new Date(), lastStatus: 'failed', lastError: result.error?.message || 'Unknown error' } }
        );
      }
    })
  );
}

const receiveWebhook = (req, res) => {
  try {
    const enforceSignature = String(process.env.WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE).toLowerCase() !== 'false';
    const appSecret = String(process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET || '');

    if (enforceSignature) {
      if (!appSecret) {
        logger.error('[WhatsApp] META_APP_SECRET not configured — rejecting webhook');
        return res.status(403).send('Webhook signature verification not configured');
      }
      const signature = String(req.headers['x-hub-signature-256'] || '');
      if (!signature.startsWith('sha256=') || !req.rawBody) return res.status(403).send('Invalid signature');

      const expected =
        'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');

      const isValid = (() => {
        try {
          return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
        } catch (_error) {
          return false;
        }
      })();

      if (!isValid) return res.status(403).send('Invalid signature');
    }

    // The same Meta App/webhook URL can be subscribed to other products
    // (Page, Instagram) sharing this one endpoint — acknowledge and ignore
    // anything that isn't a WhatsApp payload rather than attempting to
    // parse a differently-shaped entry/changes/value as WhatsApp data.
    const payloadObject = String(req.body?.object || '');
    if (payloadObject && payloadObject !== 'whatsapp_business_account') {
      return res.status(200).json({ received: true, ignored: true });
    }

    const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];
    const incoming = [];
    const statuses = [];

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value || {};
        const metadata = value?.metadata || {};
        const phoneNumberId = String(metadata.phone_number_id || '');
        const wabaId = String(value?.messaging_product === 'whatsapp' ? value?.metadata?.waba_id || entry?.id || '' : entry?.id || '');
        const businessAccountId = String(value?.business_account_id || '');

        if (Array.isArray(value?.statuses)) {
          for (const status of value.statuses) {
            statuses.push({ ...status, phoneNumberId, wabaId, businessAccountId });
          }
        }

        for (const msg of Array.isArray(value?.messages) ? value.messages : []) {
          const parsed = parseIncoming(msg);
          if (!parsed) continue;

          incoming.push({
            phoneNumberId,
            fromMe: false,
            from: String(msg.from || ''),
            to: String(metadata?.display_phone_number || metadata?.phone_number_id || ''),
            message: parsed.message,
            body: parsed.message,
            text: parsed.type === 'text' ? parsed.message : '',
            timestamp: new Date(Number(msg.timestamp || Date.now() / 1000) * 1000),
            time: new Date(Number(msg.timestamp || Date.now() / 1000) * 1000),
            status: 'received',
            direction: 'incoming',
            messageId: String(msg.id || ''),
            type: parsed.type,
            mediaId: parsed.mediaId,
            interactiveId: parsed.interactiveId || '',
            wabaId,
            businessAccountId,
          });
        }
      }
    }

    res.status(200).json({ received: true });

    setImmediate(async () => {
      try {
      for (const statusEvent of statuses) {
        const messageId = String(statusEvent?.id || '');
        const status = String(statusEvent?.status || '').toLowerCase();
        const phoneNumberId = String(statusEvent?.phoneNumberId || '');
        if (!messageId || !['sent', 'delivered', 'read', 'failed'].includes(status)) continue;

        if (status === 'failed') {
          logger.error(
            '[WhatsApp][webhook] Delivery FAILED for message',
            messageId,
            'to',
            statusEvent?.recipient_id,
            'errors:',
            JSON.stringify(statusEvent?.errors || [])
          );
        } else {
          logger.info(`[WhatsApp][webhook] Message ${messageId} status -> ${status}`);
        }

        const matchedAccountContext = await loadWhatsAppAccountFromWebhookIdentifiers(
          {
            phoneNumberId,
            wabaId: statusEvent?.wabaId,
            businessAccountId: statusEvent?.businessAccountId,
          },
          { requireAccount: false }
        );
        const matchedAccount = matchedAccountContext?.account || null;
        const timestamp = new Date(Number(statusEvent?.timestamp || Date.now() / 1000) * 1000);
        const campaignId = String(statusEvent?.conversation?.id || '');

        await CampaignMessageStatus.updateOne(
          {
            userId: matchedAccount?.userId,
            whatsappAccountId: matchedAccount?._id,
            messageId,
            status,
          },
          {
            $setOnInsert: {
              userId: matchedAccount?.userId,
              whatsappAccountId: matchedAccount?._id,
              messageId,
              status,
              timestamp,
              campaignId,
            },
          },
          { upsert: true }
        );

        await Message.updateOne(
          {
            messageId,
            ...(matchedAccount?._id ? { whatsappAccountId: matchedAccount._id } : {}),
          },
          { $set: { status, timestamp, time: timestamp } }
        );
      }

      for (const payload of incoming) {
        const matchedAccountContext = await loadWhatsAppAccountFromWebhookIdentifiers(
          {
            phoneNumberId: payload.phoneNumberId,
            wabaId: payload.wabaId,
            businessAccountId: payload.businessAccountId,
            displayPhoneNumber: payload.to,
          },
          { requireAccount: false }
        );
        const matchedAccount = matchedAccountContext?.account || null;

        const withOwnership = {
          ...payload,
          userId: matchedAccount?.userId,
          whatsappAccountId: matchedAccount?._id,
        };

        const { message, isDuplicate } = await saveAndEmitMessage(withOwnership);

        const phone = normalizePhone(payload.from);
        if (phone) {
          try {
            await Contact.findOneAndUpdate(
              { phone },
              {
                $setOnInsert: {
                  phone,
                  name: '',
                  userId: matchedAccount?.userId || null,
                  whatsappAccountId: matchedAccount?._id || null,
                },
                $set: {
                  lastMessage: payload.message,
                  lastSeen: payload.timestamp,
                  'conversation.lastCustomerMessageAt': payload.timestamp,
                  'conversation.windowOpen': true,
                },
              },
              { upsert: true }
            );
          } catch (contactErr) {
            logger.error('[whatsapp] contact upsert failed:', contactErr.message);
          }
        }

        if (!isDuplicate && payload.mediaId && matchedAccount?.accessTokenEncrypted) {
          let accountContext;
          try {
            accountContext = await loadWhatsAppAccountByPhoneNumberId(payload.phoneNumberId, { requireAccount: false });
          } catch (_error) {
            accountContext = null;
          }

          if (accountContext?.accessToken) {
            uploadWhatsAppMediaToCloudinary({
              mediaId: payload.mediaId,
              accessToken: accountContext.accessToken,
              graphVersion: RESOLVED_API_VERSION,
            })
              .then((uploaded) =>
                Message.findByIdAndUpdate(message._id, {
                  $set: { mediaUrl: uploaded.mediaUrl, mimeType: uploaded.mimeType },
                })
              )
              .catch((error) => logger.error('[whatsapp] media processing failed', error.message));
          }
        }

        if (!isDuplicate && payload.type === 'text' && matchedAccount?._id && matchedAccount?.userId) {
          const phone = normalizePhone(payload.from);
          const contactDoc = phone ? await Contact.findOne({ phone }) : null;

          const matchedWorkflow = await resolveMatchingWorkflow(payload.message, {
            userId: matchedAccount.userId,
            whatsappAccountId: matchedAccount._id,
          });

          if (matchedWorkflow) {
            runWorkflowSteps(matchedWorkflow, matchedAccount, payload);
          }

          const matchedRule = matchedWorkflow
            ? null
            : await resolveAutoReplyAction({
                incomingText: payload.message,
                filters: {
                  userId: matchedAccount.userId,
                  whatsappAccountId: matchedAccount._id,
                },
                contactDoc,
              });

          if (matchedRule) {
            const delay = resolveReplyDelayMs(matchedRule);
            setTimeout(async () => {
              try {
                const accountContext = await loadWhatsAppAccountByPhoneNumberId(payload.phoneNumberId);
                if (matchedRule.replyType === 'template') {
                  await dispatchTemplateMessage({
                    accountContext,
                    userId: matchedAccount.userId,
                    to: payload.from,
                    templateName: matchedRule.reply,
                    language: matchedRule.templateLanguage || 'en_US',
                    components: [],
                  });
                } else {
                  await dispatchTextMessage({
                    accountContext,
                    userId: matchedAccount.userId,
                    to: payload.from,
                    body: matchedRule.reply,
                  });
                }
              } catch (error) {
                logger.error('[whatsapp] auto reply failed:', error.message);
              }
            }, delay);
          }
        }

        if (matchedAccount?._id) {
          forwardToWebhookDestinations(matchedAccount._id, payload).catch((err) =>
            logger.error('[whatsapp] webhook destination fan-out failed:', err.message)
          );
        }

        if (matchedAccount?._id) {
          await WhatsAppAccount.updateOne(
            { _id: matchedAccount._id },
            { $set: { lastWebhookAt: new Date(), lastSyncAt: new Date(), webhookSubscribed: true, status: 'active' } }
          );
        }
      }

      } catch (asyncErr) {
        logger.error('[whatsapp] webhook async processing error:', asyncErr);
      }
    });
  } catch (error) {
    logger.error('[whatsapp] webhook error:', error);
    return res.status(200).json({ received: true });
  }
};

const getAnalytics = asyncHandler(async (req, res) => {
  const accountContext = await resolveCurrentWhatsAppAccount(req);
  const filter = {
    userId: req.user?.id,
    ...(accountContext?.account?._id ? { whatsappAccountId: accountContext.account._id } : {}),
  };

  const [sent, delivered, read, failed] = await Promise.all([
    CampaignMessageStatus.distinct('messageId', { ...filter, status: 'sent' }),
    CampaignMessageStatus.distinct('messageId', { ...filter, status: 'delivered' }),
    CampaignMessageStatus.distinct('messageId', { ...filter, status: 'read' }),
    CampaignMessageStatus.distinct('messageId', { ...filter, status: 'failed' }),
  ]);

  const totalSent = sent.length;
  const pct = (count) => (totalSent > 0 ? Number(((count / totalSent) * 100).toFixed(2)) : 0);

  return res.status(200).json({
    success: true,
    data: {
      totalSent,
      deliveredPercentage: pct(delivered.length),
      readPercentage: pct(read.length),
      failedPercentage: pct(failed.length),
    },
  });
});

// ── Account Settings (feature flags stored in metadata) ───────────────────────
// Webhook forwarding is now self-service, multi-destination — see
// routes/webhookDestinations.js — not a single callbackUrl here.
const SETTINGS_KEYS = ['analyticsEnabled', 'autoReplyEnabled', 'webhookHealthAlerts', 'defaultCountryCode', 'timezone'];

const getSettings = asyncHandler(async (req, res) => {
  const account = await WhatsAppAccount.findOne({ userId: req.user.id, isActive: true }).lean();
  const meta = account?.metadata || {};
  return res.json({
    success: true,
    data: {
      analyticsEnabled:    meta.analyticsEnabled    ?? true,
      autoReplyEnabled:    meta.autoReplyEnabled    ?? true,
      webhookHealthAlerts: meta.webhookHealthAlerts ?? false,
      defaultCountryCode:  meta.defaultCountryCode  ?? '+1',
      timezone:            meta.timezone            ?? 'UTC',
    },
  });
});

const saveSettings = asyncHandler(async (req, res) => {
  const metaFields = Object.fromEntries(
    SETTINGS_KEYS.filter(k => k in req.body).map(k => [k, req.body[k]])
  );

  const metaUpdate = Object.fromEntries(
    Object.entries(metaFields).map(([k, v]) => [`metadata.${k}`, v])
  );

  if (Object.keys(metaUpdate).length) {
    await WhatsAppAccount.updateOne(
      { userId: req.user.id, isActive: true },
      { $set: metaUpdate }
    );
  }

  return res.json({ success: true, message: 'Settings saved.' });
});

// ── API Key management ────────────────────────────────────────────────────────
const ApiKey = require('../../bulk/models/ApiKey');

const listApiKeys = asyncHandler(async (req, res) => {
  const keys = await ApiKey.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
  res.json({
    success: true,
    keys: keys.map(k => ({
      id: k._id, name: k.name, key: k.key,
      isActive: k.isActive, lastUsedAt: k.lastUsedAt, createdAt: k.createdAt,
    })),
  });
});

const createApiKey = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const apiKey = await ApiKey.generate(req.user.id, name || 'Default');
  recordAuditEvent({ req, action: 'api_key.create', resource: 'api_key', resourceId: apiKey._id, metadata: { name: apiKey.name } });
  res.status(201).json({ success: true, key: apiKey.key, name: apiKey.name, id: apiKey._id });
});

const revokeApiKey = asyncHandler(async (req, res) => {
  await ApiKey.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { isActive: false }
  );
  recordAuditEvent({ req, action: 'api_key.revoke', resource: 'api_key', resourceId: req.params.id });
  res.json({ success: true });
});

module.exports = {
  // Message-dispatch primitives, exported for src/queues/whatsappSendWorker.js
  // to reuse rather than duplicate the Graph API call/error-normalization
  // logic that already lives here.
  dispatchTextMessage,
  dispatchTemplateMessage,
  dispatchMediaMessage,
  getMetaWebhookConfig,
  getConnectConfig,
  exchangeMetaToken,
  completeConnection: completeEmbeddedSignup,
  manualConnect,
  listAccounts,
  getAccount,
  activateAccount,
  getStatus,
  deleteAccount,
  disconnectAccount,
  revalidateAccount,
  setSystemUserToken,
  updateManualAccount,
  sendText,
  sendTemplate,
  sendMedia,
  sendMessage,
  sendBroadcast,
  createAutoReplyRule,
  updateAutoReplyRule,
  deleteAutoReplyRule,
  toggleAutoReplyRule,
  getAutoReplyRules,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  toggleWorkflow,
  getWorkflows,
  getContacts,
  createContact,
  updateContact,
  deleteContact,
  bulkUpdateContacts,
  importContacts,
  getTemplates,
  createTemplate,
  getMessages,
  getConversations,
  assignConversation,
  getTeamMembers,
  addTeamMember: addTeamMemberHandler,
  removeTeamMember: removeTeamMemberHandler,
  verifyWebhook,
  receiveWebhook,
  getAnalytics,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  getSettings,
  saveSettings,
};
