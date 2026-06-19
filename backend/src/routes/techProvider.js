const express = require('express');
const axios = require('axios');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const WhatsAppAccount = require('../repositories/whatsappAccount');
const WebhookEvent = require('../repositories/WebhookEvent');
const { decryptSensitiveValue } = require('../utils/crypto');

const router = express.Router();
const GRAPH_VERSION = process.env.WHATSAPP_API_VERSION || 'v19.0';

// Helper: get decrypted access token from active account
async function getAccessToken(userId) {
  const account = await WhatsAppAccount.findOne({ userId, isActive: true });
  if (!account) throw new AppError('No connected WhatsApp account found. Please connect first.', 404);
  const token = decryptSensitiveValue(account.accessTokenEncrypted);
  return { token, account };
}

async function graphGet(path, token, params = {}) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}${path}`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
}

// ── WABAs ─────────────────────────────────────────────────────────────────────

router.get(
  '/wabas',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { token, account } = await getAccessToken(req.user._id);
    const wabaId = account.wabaId || account.businessAccountId;
    if (!wabaId) return res.json({ success: true, wabas: [] });

    // Fetch WABA details
    const data = await graphGet(`/${wabaId}`, token, {
      fields: 'id,name,currency,timezone_id,message_template_namespace,on_behalf_of_business_info,primary_funding_id,purchase_order_number,status',
    });

    // Fetch phone numbers for this WABA
    let phones = [];
    try {
      const phonesData = await graphGet(`/${wabaId}/phone_numbers`, token, {
        fields: 'id,display_phone_number,verified_name,quality_rating,status,platform_type,throughput,webhook_configuration',
      });
      phones = phonesData?.data || [];
    } catch (_) {}

    res.json({ success: true, wabas: [{ ...data, phone_numbers: phones }] });
  })
);

router.get(
  '/wabas/:wabaId/phone-numbers',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { token } = await getAccessToken(req.user._id);
    const data = await graphGet(`/${req.params.wabaId}/phone_numbers`, token, {
      fields: 'id,display_phone_number,verified_name,quality_rating,status,platform_type,throughput',
    });
    res.json({ success: true, phones: data?.data || [] });
  })
);

router.post(
  '/wabas/:wabaId/subscribe',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { token } = await getAccessToken(req.user._id);
    const data = await axios.post(
      `https://graph.facebook.com/${GRAPH_VERSION}/${req.params.wabaId}/subscribed_apps`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    await WhatsAppAccount.updateOne(
      { userId: req.user._id, isActive: true },
      { $set: { webhookSubscribed: true } }
    );
    res.json({ success: true, data: data.data });
  })
);

// ── Business Assets ───────────────────────────────────────────────────────────

router.get(
  '/assets',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { token, account } = await getAccessToken(req.user._id);
    const businessId = account.businessAccountId || account.wabaId;
    if (!businessId) return res.json({ success: true, assets: {} });

    const fields = [
      'owned_pages{id,name,category,fan_count,link,picture}',
      'owned_ad_accounts{id,name,currency,account_status}',
      'owned_product_catalogs{id,name}',
      'owned_instagram_accounts{id,username,profile_picture_url,followers_count}',
    ].join(',');

    let assets = {};
    try {
      const data = await graphGet(`/${businessId}`, token, { fields });
      assets = {
        pages: data.owned_pages?.data || [],
        adAccounts: data.owned_ad_accounts?.data || [],
        catalogs: data.owned_product_catalogs?.data || [],
        instagramAccounts: data.owned_instagram_accounts?.data || [],
      };
    } catch (err) {
      // Return empty if scope not granted
      assets = { pages: [], adAccounts: [], catalogs: [], instagramAccounts: [] };
    }

    res.json({ success: true, assets });
  })
);

// ── Webhook Events (stored by webhook handler) ────────────────────────────────

router.get(
  '/webhook-events',
  requireAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const events = await WebhookEvent.find({ userId: req.user._id })
      .sort({ receivedAt: -1 })
      .limit(limit)
      .lean();
    res.json({ success: true, events });
  })
);

router.delete(
  '/webhook-events',
  requireAuth,
  asyncHandler(async (req, res) => {
    await WebhookEvent.deleteMany({ userId: req.user._id });
    res.json({ success: true });
  })
);

// ── Templates (paid messaging) ────────────────────────────────────────────────

router.get(
  '/templates',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { token, account } = await getAccessToken(req.user._id);
    const wabaId = account.wabaId || account.businessAccountId;
    if (!wabaId) return res.json({ success: true, templates: [] });

    const data = await graphGet(`/${wabaId}/message_templates`, token, {
      fields: 'id,name,status,category,language,components',
      limit: 100,
    });
    res.json({ success: true, templates: data?.data || [] });
  })
);

router.post(
  '/send-template',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { token, account } = await getAccessToken(req.user._id);
    const { to, templateName, languageCode = 'en_US', components = [] } = req.body;
    if (!to || !templateName) throw new AppError('to and templateName are required', 400);

    const payload = {
      messaging_product: 'whatsapp',
      to: String(to).replace(/\D/g, ''),
      type: 'template',
      template: { name: templateName, language: { code: languageCode }, components },
    };

    const res2 = await axios.post(
      `https://graph.facebook.com/${GRAPH_VERSION}/${account.phoneNumberId}/messages`,
      payload,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    res.json({ success: true, data: res2.data });
  })
);

module.exports = router;
