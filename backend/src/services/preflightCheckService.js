// Pre-flight configuration checks for the WhatsApp Cloud API integration.
//
// These exist because the most damaging misconfigurations in this product are
// silent. In particular (see docs/meta-tech-provider/COEXISTENCE.md): if the
// Meta app is not subscribed to the `history`, `smb_message_echoes` and
// `smb_app_state_sync` webhook fields, a Coexistence number still onboards
// successfully — and then never delivers chat history, WhatsApp-Business-app
// messages, or contacts. Nothing errors. The customer just sees a stale inbox.
//
// Two different Graph API facts are needed, and they are NOT the same check:
//
//   1. WEBHOOK FIELDS are subscribed at the *app* level (App Dashboard →
//      WhatsApp → Configuration → Webhook fields). They are read back with
//      GET /{app-id}/subscriptions using an app access token. This is the
//      authoritative source for "is `history` subscribed at all".
//
//   2. WABA SUBSCRIPTION is per-customer: GET /{waba-id}/subscribed_apps
//      confirms this app is attached to that WABA. subscribeAppToWaba() does
//      this at connect time, but it is necessary and not sufficient — an app
//      subscribed to a WABA with the fields unticked still receives nothing.
//
// Check 1 is cheap (one call) and runs at boot. Check 2 costs one call per
// active WABA, so it runs only on the admin endpoint.
//
// Everything here is read-only: no Graph write is ever issued, and a failure
// degrades to an 'unknown' result rather than throwing into the caller.

const axios = require('axios');
const WhatsAppAccount = require('../repositories/whatsappAccount');
const { decryptSensitiveValue } = require('../utils/crypto');
const { getGraphApiVersion } = require('../config/graphApi');
const logger = require('../utils/logger');

// `messages` is required by every deployment; the other three are required
// only when Coexistence is on, but are reported either way so the gap is
// visible before the flag is flipped rather than after.
const BASE_WEBHOOK_FIELDS = ['messages'];
const COEXISTENCE_WEBHOOK_FIELDS = ['history', 'smb_message_echoes', 'smb_app_state_sync'];
const ALL_WEBHOOK_FIELDS = [...BASE_WEBHOOK_FIELDS, ...COEXISTENCE_WEBHOOK_FIELDS];

const GRAPH_TIMEOUT_MS = 15000;

// Mirrors getConnectConfig in controllers/whatsappController.js. Kept as its
// own function so the check and the popup can never disagree about what
// "enabled" means.
const isCoexistenceEnabled = () =>
  String(process.env.META_ENABLE_COEXISTENCE ?? 'true').toLowerCase() !== 'false';

const severityRank = { ok: 0, info: 1, warn: 2, error: 3 };
const worstSeverity = (results) =>
  results.reduce((worst, r) => (severityRank[r.severity] > severityRank[worst] ? r.severity : worst), 'ok');

/**
 * GET /{app-id}/subscriptions — which webhook fields this Meta app is actually
 * subscribed to for the `whatsapp_business_account` object.
 *
 * Uses an app access token (`{app-id}|{app-secret}`), so it needs no customer
 * token and works even with zero accounts connected.
 */
const fetchAppWebhookFields = async ({
  appId = process.env.META_APP_ID,
  appSecret = process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET,
  graphVersion = getGraphApiVersion(),
} = {}) => {
  if (!appId || !appSecret) {
    return {
      status: 'unknown',
      reason: 'META_APP_ID and META_APP_SECRET must both be set to read webhook field subscriptions',
      fields: [],
    };
  }

  try {
    const res = await axios.get(`https://graph.facebook.com/${graphVersion}/${appId}/subscriptions`, {
      params: { access_token: `${appId}|${appSecret}` },
      timeout: GRAPH_TIMEOUT_MS,
    });

    const entries = Array.isArray(res.data?.data) ? res.data.data : [];
    const whatsapp = entries.find((e) => String(e?.object || '') === 'whatsapp_business_account');

    if (!whatsapp) {
      return {
        status: 'not_subscribed',
        reason: 'This app has no whatsapp_business_account webhook subscription at all',
        fields: [],
      };
    }

    // Meta returns fields as objects ({name, version}) on current versions and
    // has used bare strings before — accept both.
    const fields = (Array.isArray(whatsapp.fields) ? whatsapp.fields : [])
      .map((f) => (typeof f === 'string' ? f : String(f?.name || '')))
      .filter(Boolean);

    return {
      status: 'ok',
      fields,
      callbackUrl: String(whatsapp.callback_url || ''),
      active: whatsapp.active !== false,
    };
  } catch (error) {
    return {
      status: 'unknown',
      reason: error?.response?.data?.error?.message || error.message,
      fields: [],
    };
  }
};

/**
 * GET /{waba-id}/subscribed_apps — is this app attached to that customer's WABA.
 */
const fetchWabaSubscription = async ({ wabaId, accessToken, appId = process.env.META_APP_ID, graphVersion = getGraphApiVersion() }) => {
  try {
    const res = await axios.get(`https://graph.facebook.com/${graphVersion}/${wabaId}/subscribed_apps`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: GRAPH_TIMEOUT_MS,
    });

    const apps = Array.isArray(res.data?.data) ? res.data.data : [];
    const ids = apps.map((a) => String(a?.whatsapp_business_api_data?.id || a?.id || '')).filter(Boolean);

    // With no app id configured we can still report how many apps are
    // attached, just not whether one of them is us.
    if (!appId) return { status: 'unknown', reason: 'META_APP_ID is not set', subscribedAppIds: ids };

    return { status: ids.includes(String(appId)) ? 'ok' : 'not_subscribed', subscribedAppIds: ids };
  } catch (error) {
    return {
      status: 'unknown',
      reason: error?.response?.data?.error?.message || error.message,
      subscribedAppIds: [],
    };
  }
};

// ── Individual checks ────────────────────────────────────────────────────────

const checkWebhookFields = (fieldResult, { coexistenceEnabled }) => {
  const required = coexistenceEnabled ? ALL_WEBHOOK_FIELDS : BASE_WEBHOOK_FIELDS;

  if (fieldResult.status !== 'ok') {
    return {
      id: 'webhook_fields',
      severity: fieldResult.status === 'not_subscribed' ? 'error' : 'warn',
      summary:
        fieldResult.status === 'not_subscribed'
          ? 'The Meta app has no whatsapp_business_account webhook subscription — no WhatsApp events will ever arrive'
          : `Could not read webhook field subscriptions: ${fieldResult.reason}`,
      required,
      subscribed: [],
      missing: required,
    };
  }

  const subscribed = fieldResult.fields;
  const missing = required.filter((f) => !subscribed.includes(f));
  const missingCoexistenceWhileOff = coexistenceEnabled
    ? []
    : COEXISTENCE_WEBHOOK_FIELDS.filter((f) => !subscribed.includes(f));

  if (missing.length) {
    const missingCoexistence = missing.filter((f) => COEXISTENCE_WEBHOOK_FIELDS.includes(f));
    return {
      id: 'webhook_fields',
      severity: 'error',
      summary: missingCoexistence.length
        ? `Coexistence is ENABLED but ${missingCoexistence.join(', ')} ${missingCoexistence.length === 1 ? 'is' : 'are'} not subscribed — coexistence numbers will onboard and then silently drop history/echo/contact traffic. Subscribe the fields in the Meta App Dashboard or set META_ENABLE_COEXISTENCE=false.`
        : `Required webhook field(s) not subscribed: ${missing.join(', ')}`,
      required,
      subscribed,
      missing,
      callbackUrl: fieldResult.callbackUrl,
    };
  }

  return {
    id: 'webhook_fields',
    severity: fieldResult.active === false ? 'warn' : 'ok',
    summary:
      fieldResult.active === false
        ? 'All required webhook fields are subscribed, but the subscription is marked inactive by Meta'
        : `All required webhook fields subscribed (${required.join(', ')})`,
    required,
    subscribed,
    missing: [],
    // Not an error: these are simply not needed while coexistence is off, but
    // knowing they are absent is what tells you the flag cannot be flipped yet.
    notReadyForCoexistence: missingCoexistenceWhileOff,
    callbackUrl: fieldResult.callbackUrl,
  };
};

const checkCoexistenceGating = ({ coexistenceEnabled, fieldCheck, coexistenceAccountCount }) => {
  const missingCoexistenceFields = COEXISTENCE_WEBHOOK_FIELDS.filter(
    (f) => !(fieldCheck.subscribed || []).includes(f)
  );

  // The dangerous state: the popup offers coexistence, but the traffic has
  // nowhere to land.
  if (coexistenceEnabled && missingCoexistenceFields.length && fieldCheck.severity !== 'warn') {
    return {
      id: 'coexistence_gating',
      severity: 'error',
      coexistenceEnabled,
      coexistenceAccountCount,
      summary: `META_ENABLE_COEXISTENCE is on while ${missingCoexistenceFields.join(', ')} ${missingCoexistenceFields.length === 1 ? 'is' : 'are'} unsubscribed. Set META_ENABLE_COEXISTENCE=false until the App Dashboard is configured.`,
    };
  }

  // Accounts already onboarded as coexistence while the flag is off: not
  // dangerous (they keep working), but it means the flag was turned off after
  // the fact and those customers can no longer be re-onboarded.
  if (!coexistenceEnabled && coexistenceAccountCount > 0) {
    return {
      id: 'coexistence_gating',
      severity: 'warn',
      coexistenceEnabled,
      coexistenceAccountCount,
      summary: `META_ENABLE_COEXISTENCE is off but ${coexistenceAccountCount} account(s) are already connected in coexistence mode — their webhooks still need the coexistence fields subscribed.`,
    };
  }

  return {
    id: 'coexistence_gating',
    severity: 'ok',
    coexistenceEnabled,
    coexistenceAccountCount,
    summary: coexistenceEnabled
      ? 'Coexistence is enabled and its webhook fields are subscribed'
      : 'Coexistence is disabled; the Embedded Signup popup will not offer the WhatsApp Business app path',
  };
};

/**
 * Token posture per active account. Meta's guidance for BSPs is a
 * Business-owned System User token over one tied to an individual's login —
 * see docs/meta-tech-provider/ACCESS_TOKENS.md.
 */
const checkTokenSources = (accounts, { now = Date.now(), expiryWarningDays = 14 } = {}) => {
  const details = accounts.map((a) => {
    const tokenSource = String(a.tokenSource || 'user_token');
    const expiresAt = a.tokenExpiresAt ? new Date(a.tokenExpiresAt) : null;
    const daysToExpiry = expiresAt ? Math.floor((expiresAt.getTime() - now) / 86400000) : null;

    let severity = 'ok';
    let note = 'System User token';
    if (tokenSource !== 'system_user') {
      severity = 'warn';
      note = 'User token — expires and depends on one person\'s Meta login; prefer a Business-owned System User token';
    }
    if (daysToExpiry !== null && daysToExpiry < 0) {
      severity = 'error';
      note = 'Token has expired';
    } else if (daysToExpiry !== null && daysToExpiry <= expiryWarningDays) {
      severity = severity === 'error' ? severity : 'warn';
      note = `Token expires in ${daysToExpiry} day(s)`;
    }

    return {
      accountId: String(a._id),
      phoneNumberId: a.phoneNumberId,
      displayPhoneNumber: a.displayPhoneNumber || '',
      connectionMode: a.connectionMode,
      tokenSource,
      tokenExpiresAt: expiresAt ? expiresAt.toISOString() : null,
      daysToExpiry,
      severity,
      note,
    };
  });

  const systemUserCount = details.filter((d) => d.tokenSource === 'system_user').length;

  return {
    id: 'token_sources',
    severity: worstSeverity(details.length ? details : [{ severity: 'ok' }]),
    summary: accounts.length
      ? `${systemUserCount}/${accounts.length} active account(s) using a System User token`
      : 'No active WhatsApp accounts connected',
    accounts: details,
  };
};

/**
 * Whether Embedded Signup can actually launch.
 *
 * getConnectConfig serves META_APP_ID and META_EMBEDDED_SIGNUP_CONFIG_ID to
 * the browser, and the dashboard refuses to open the popup unless BOTH are
 * present — it falls back to "Connect manually" with a toast. There is no
 * server-side error and nothing in the logs, so an unset config id looks
 * exactly like a working deployment until a customer tries to connect and is
 * quietly told to do it by hand.
 *
 * The config id is not a secret (it goes to the browser on every dashboard
 * load), so it is safe to echo here; the app secret is only ever reported as
 * present or absent.
 */
const checkEmbeddedSignupConfig = () => {
  const appId = String(process.env.META_APP_ID || '').trim();
  const configId = String(process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '').trim();
  const hasAppSecret = Boolean(String(process.env.META_APP_SECRET || '').trim());

  const missing = [];
  if (!appId) missing.push('META_APP_ID');
  if (!configId) missing.push('META_EMBEDDED_SIGNUP_CONFIG_ID');
  // The code-for-token exchange in completeEmbeddedSignup needs the secret, so
  // the popup would succeed and the connection would then fail at the end.
  if (!hasAppSecret) missing.push('META_APP_SECRET');

  return {
    id: 'embedded_signup_config',
    severity: missing.length ? 'error' : 'ok',
    summary: missing.length
      ? `Embedded Signup cannot launch — unset: ${missing.join(', ')}. "Connect with Meta" will fall back to manual entry.`
      : `Embedded Signup configured (config id ${configId})`,
    appId,
    configId,
    hasAppSecret,
    missing,
  };
};

// ── Runners ──────────────────────────────────────────────────────────────────

const loadActiveAccounts = async () =>
  WhatsAppAccount.find({ isActive: true, status: 'active' })
    .select('_id phoneNumberId displayPhoneNumber wabaId connectionMode tokenSource tokenExpiresAt accessTokenEncrypted coexistence')
    .lean();

/**
 * The boot-time / admin check. `includeWabaSubscriptions` adds one Graph call
 * per active WABA and is therefore off unless explicitly requested.
 */
const runPreflightChecks = async ({ includeWabaSubscriptions = false } = {}) => {
  const coexistenceEnabled = isCoexistenceEnabled();
  const graphVersion = getGraphApiVersion();

  let accounts = [];
  try {
    accounts = await loadActiveAccounts();
  } catch (error) {
    logger.error('[preflight] Could not load WhatsApp accounts:', error.message);
  }

  const fieldResult = await fetchAppWebhookFields({ graphVersion });
  const fieldCheck = checkWebhookFields(fieldResult, { coexistenceEnabled });

  const coexistenceAccountCount = accounts.filter(
    (a) => a.connectionMode === 'coexistence' || a?.coexistence?.enabled
  ).length;

  const checks = [
    checkEmbeddedSignupConfig(),
    fieldCheck,
    checkCoexistenceGating({ coexistenceEnabled, fieldCheck, coexistenceAccountCount }),
    checkTokenSources(accounts),
  ];

  if (includeWabaSubscriptions) {
    checks.push(await checkWabaSubscriptions(accounts, { graphVersion }));
  }

  return {
    checkedAt: new Date().toISOString(),
    graphVersion,
    coexistenceEnabled,
    severity: worstSeverity(checks),
    checks,
  };
};

const checkWabaSubscriptions = async (accounts, { graphVersion } = {}) => {
  const withWaba = accounts.filter((a) => a.wabaId);
  const results = [];

  for (const account of withWaba) {
    let accessToken = '';
    try {
      accessToken = account.accessTokenEncrypted ? decryptSensitiveValue(account.accessTokenEncrypted) : '';
    } catch (_error) {
      results.push({
        accountId: String(account._id),
        wabaId: account.wabaId,
        severity: 'error',
        note: 'Stored access token could not be decrypted — check WHATSAPP_TOKEN_ENCRYPTION_KEY',
      });
      continue;
    }
    if (!accessToken) {
      results.push({ accountId: String(account._id), wabaId: account.wabaId, severity: 'warn', note: 'No stored access token' });
      continue;
    }

    const sub = await fetchWabaSubscription({ wabaId: account.wabaId, accessToken, graphVersion });
    results.push({
      accountId: String(account._id),
      wabaId: account.wabaId,
      phoneNumberId: account.phoneNumberId,
      severity: sub.status === 'ok' ? 'ok' : sub.status === 'not_subscribed' ? 'error' : 'warn',
      note:
        sub.status === 'ok'
          ? 'This app is subscribed to the WABA'
          : sub.status === 'not_subscribed'
            ? 'This app is NOT in the WABA\'s subscribed_apps — no webhooks will arrive for it'
            : `Could not verify: ${sub.reason}`,
    });
  }

  return {
    id: 'waba_subscriptions',
    severity: worstSeverity(results.length ? results : [{ severity: 'ok' }]),
    summary: withWaba.length
      ? `${results.filter((r) => r.severity === 'ok').length}/${withWaba.length} active WABA(s) confirmed subscribed to this app`
      : 'No active accounts with a WABA ID',
    accounts: results,
  };
};

const LOG_BY_SEVERITY = { error: 'error', warn: 'warn', info: 'info', ok: 'info' };

const logPreflightReport = (report) => {
  const banner = `[preflight] WhatsApp configuration check — ${report.severity.toUpperCase()} (Graph ${report.graphVersion}, coexistence ${report.coexistenceEnabled ? 'ON' : 'OFF'})`;
  logger[LOG_BY_SEVERITY[report.severity] || 'info'](banner);

  for (const check of report.checks) {
    const level = LOG_BY_SEVERITY[check.severity] || 'info';
    logger[level](`[preflight] ${check.id}: ${check.summary}`);
    if (check.notReadyForCoexistence?.length) {
      logger.info(
        `[preflight] ${check.id}: coexistence fields not yet subscribed (${check.notReadyForCoexistence.join(', ')}) — subscribe them before setting META_ENABLE_COEXISTENCE=true`
      );
    }
  }
};

/**
 * Boot hook. Never blocks startup and never throws: a Graph API blip must not
 * stop the server from serving. Set RUN_PREFLIGHT_ON_BOOT=false to skip.
 */
const runPreflightOnBoot = async () => {
  if (String(process.env.RUN_PREFLIGHT_ON_BOOT ?? 'true').toLowerCase() === 'false') return null;
  try {
    // App-level fields only — one Graph call. Per-WABA verification is left to
    // the admin endpoint so a restart never fans out across every customer.
    const report = await runPreflightChecks({ includeWabaSubscriptions: false });
    logPreflightReport(report);
    return report;
  } catch (error) {
    logger.error('[preflight] Check failed (non-fatal):', error.message);
    return null;
  }
};

module.exports = {
  BASE_WEBHOOK_FIELDS,
  COEXISTENCE_WEBHOOK_FIELDS,
  ALL_WEBHOOK_FIELDS,
  isCoexistenceEnabled,
  fetchAppWebhookFields,
  fetchWabaSubscription,
  checkWebhookFields,
  checkCoexistenceGating,
  checkTokenSources,
  checkEmbeddedSignupConfig,
  checkWabaSubscriptions,
  runPreflightChecks,
  logPreflightReport,
  runPreflightOnBoot,
};
