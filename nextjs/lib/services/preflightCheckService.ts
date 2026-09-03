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

import axios from 'axios';
import WhatsAppAccount from '../models/WhatsAppAccount';
import { decryptSensitiveValue } from '../utils/crypto';
import { getGraphApiVersion } from '../config/graphApi';
import logger from '../utils/logger';

// `messages` is required by every deployment; the other three are required
// only when Coexistence is on, but are reported either way so the gap is
// visible before the flag is flipped rather than after.
export const BASE_WEBHOOK_FIELDS = ['messages'];
const COEXISTENCE_WEBHOOK_FIELDS = ['history', 'smb_message_echoes', 'smb_app_state_sync'];
export const ALL_WEBHOOK_FIELDS = [...BASE_WEBHOOK_FIELDS, ...COEXISTENCE_WEBHOOK_FIELDS];

const GRAPH_TIMEOUT_MS = 15000;

// Mirrors getConnectConfig in controllers/whatsappController.js. Kept as its
// own function so the check and the popup can never disagree about what
// "enabled" means.
export const isCoexistenceEnabled = () =>
  String(process.env.META_ENABLE_COEXISTENCE ?? 'true').toLowerCase() !== 'false';

const severityRank = { ok: 0, info: 1, warn: 2, error: 3 };
const worstSeverity = (results: any) =>
  results.reduce((worst, r) => (severityRank[r.severity] > severityRank[worst] ? r.severity : worst), 'ok');

/**
 * Why a Graph call failed, in a form that survives being read in a log.
 *
 * The old version was `error.response.data.error.message || error.message`,
 * and on this deployment both came back empty — so the boot log printed
 * "Could not read webhook field subscriptions: " and stopped. An empty
 * reason is worse than no check at all: it reports a failure while withholding
 * every fact that would let anyone act on it, and it is indistinguishable from
 * a formatting bug.
 *
 * So: whatever is actually present. Meta's error code, type, subcode and
 * fbtrace_id identify the failure in the App Dashboard's own logs; the HTTP
 * status separates an auth rejection from a rate limit; the node error code
 * separates a DNS or TLS failure from either. If none of that exists, the
 * error's own class name is still more than a blank.
 */
export const describeGraphFailure = (error: any): string => {
  const parts: string[] = [];
  const metaError = error?.response?.data?.error;

  const message = String(metaError?.message || error?.message || '').trim();
  if (message) parts.push(message);

  if (metaError?.code !== undefined) parts.push(`code ${metaError.code}`);
  if (metaError?.error_subcode !== undefined) parts.push(`subcode ${metaError.error_subcode}`);
  if (metaError?.type) parts.push(String(metaError.type));
  if (metaError?.fbtrace_id) parts.push(`fbtrace_id ${metaError.fbtrace_id}`);

  const status = error?.response?.status;
  if (status !== undefined) parts.push(`HTTP ${status}`);
  if (error?.code) parts.push(String(error.code));

  // Gated on there being no message rather than no parts at all: an HTTP
  // status is a part, so "!parts.length" swallowed the body of exactly the
  // response this clause is for — a proxy or a WAF answering instead of Graph,
  // which has a status and HTML and no Meta error object anywhere.
  if (!message && error?.response?.data !== undefined) {
    const body = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
    if (body) parts.push(`unrecognised response: ${body.slice(0, 300)}`);
  }

  if (!parts.length) parts.push(`${error?.constructor?.name || typeof error} with no message`);

  return parts.join(' — ');
};

/**
 * GET /{app-id}/subscriptions — which webhook fields this Meta app is actually
 * subscribed to for the `whatsapp_business_account` object.
 *
 * Uses an app access token (`{app-id}|{app-secret}`), so it needs no customer
 * token and works even with zero accounts connected.
 */
export const fetchAppWebhookFields = async ({
  appId = process.env.META_APP_ID,
  appSecret = process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET,
  graphVersion = getGraphApiVersion(),
}: any = {}) => {
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
    const whatsapp = entries.find((e: any) => String(e?.object || '') === 'whatsapp_business_account');

    if (!whatsapp) {
      return {
        status: 'not_subscribed',
        reason: 'This app has no whatsapp_business_account webhook subscription at all',
        fields: [],
      };
    }

    // Meta returns fields as objects ({name, version}: any) on current versions and
    // has used bare strings before — accept both.
    const fields = (Array.isArray(whatsapp.fields) ? whatsapp.fields : [])
      .map((f: any) => (typeof f === 'string' ? f : String(f?.name || '')))
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
      reason: describeGraphFailure(error),
      fields: [],
    };
  }
};

/**
 * GET /{waba-id}/subscribed_apps — is this app attached to that customer's WABA.
 */
export const fetchWabaSubscription = async ({ wabaId, accessToken, appId = process.env.META_APP_ID, graphVersion = getGraphApiVersion() }: any) => {
  try {
    const res = await axios.get(`https://graph.facebook.com/${graphVersion}/${wabaId}/subscribed_apps`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: GRAPH_TIMEOUT_MS,
    });

    const apps = Array.isArray(res.data?.data) ? res.data.data : [];
    const ids = apps.map((a: any) => String(a?.whatsapp_business_api_data?.id || a?.id || '')).filter(Boolean);

    // With no app id configured we can still report how many apps are
    // attached, just not whether one of them is us.
    if (!appId) return { status: 'unknown', reason: 'META_APP_ID is not set', subscribedAppIds: ids };

    return { status: ids.includes(String(appId)) ? 'ok' : 'not_subscribed', subscribedAppIds: ids };
  } catch (error) {
    // Same reasoning as above: this reason is read from a log, so it has to
    // carry the code and the trace id, not just whatever message Meta felt
    // like sending.
    return {
      status: 'unknown',
      reason: describeGraphFailure(error),
      subscribedAppIds: [],
    };
  }
};

// ── Individual checks ────────────────────────────────────────────────────────

export const checkWebhookFields = (fieldResult, { coexistenceEnabled }) => {
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
  const missing = required.filter((f: any) => !subscribed.includes(f));
  const missingCoexistenceWhileOff = coexistenceEnabled
    ? []
    : COEXISTENCE_WEBHOOK_FIELDS.filter((f: any) => !subscribed.includes(f));

  if (missing.length) {
    const missingCoexistence = missing.filter((f: any) => COEXISTENCE_WEBHOOK_FIELDS.includes(f));
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
    // The callback URL belongs in the summary, not just the payload. Meta
    // stores one per app, and "the fields are subscribed" says nothing about
    // where the deliveries are being sent — a URL pointing at a previous host
    // or a different environment looks exactly like a healthy subscription
    // from every other angle, and is invisible in a log line that omits it.
    summary:
      fieldResult.active === false
        ? `All required webhook fields are subscribed, but Meta has marked the subscription INACTIVE. Callback URL: ${fieldResult.callbackUrl || '(none reported)'}`
        : `All required webhook fields subscribed (${required.join(', ')}). Meta delivers to: ${fieldResult.callbackUrl || '(no URL reported)'}`,
    required,
    subscribed,
    missing: [],
    // Not an error: these are simply not needed while coexistence is off, but
    // knowing they are absent is what tells you the flag cannot be flipped yet.
    notReadyForCoexistence: missingCoexistenceWhileOff,
    callbackUrl: fieldResult.callbackUrl,
  };
};

export const checkCoexistenceGating = ({ coexistenceEnabled, fieldCheck, coexistenceAccountCount }: any) => {
  const missingCoexistenceFields = COEXISTENCE_WEBHOOK_FIELDS.filter(
    (f: any) => !(fieldCheck.subscribed || []).includes(f)
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
export const checkTokenSources = (accounts, { now = Date.now(), expiryWarningDays = 14 } = {}) => {
  const details = accounts.map((a: any) => {
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

  const systemUserCount = details.filter((d: any) => d.tokenSource === 'system_user').length;

  return {
    id: 'token_sources',
    severity: worstSeverity(details.length ? details : [{ severity: 'ok' }]),
    summary: accounts.length
      ? `${systemUserCount}/${accounts.length} active account(s) using a System User token`
      : 'No active WhatsApp accounts connected',
    accounts: details,
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
/**
 * Whether Embedded Signup can actually launch.
 *
 * The connect/config route serves META_APP_ID and META_EMBEDDED_SIGNUP_CONFIG_ID
 * to the browser, and the dashboard refuses to open the popup unless BOTH are
 * present — it falls back to "Connect manually" with a toast. There is no
 * server-side error and nothing in the logs, so an unset config id looks
 * exactly like a working deployment until a customer tries to connect and is
 * quietly told to do it by hand.
 *
 * The config id is not a secret (it goes to the browser on every dashboard
 * load), so it is safe to echo here; the app secret is only ever reported as
 * present or absent.
 */
export const checkEmbeddedSignupConfig = () => {
  const appId = String(process.env.META_APP_ID || '').trim();
  const configId = String(process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '').trim();
  const hasAppSecret = Boolean(String(process.env.META_APP_SECRET || '').trim());

  const missing: string[] = [];
  if (!appId) missing.push('META_APP_ID');
  if (!configId) missing.push('META_EMBEDDED_SIGNUP_CONFIG_ID');
  // The code-for-token exchange needs the secret, so the popup would succeed
  // and the connection would then fail at the end.
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

// Above this many connected WABAs, the per-WABA check is one Graph call per
// customer at every boot and belongs on the admin endpoint instead. At or
// below it — which is every deployment that is not yet a busy BSP — the call
// is cheap and answers the one question the app-level check cannot.
export const WABA_CHECK_AUTO_LIMIT = 10;

export const runPreflightChecks = async ({ includeWabaSubscriptions = false }: any = {}) => {
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
    (a: any) => a.connectionMode === 'coexistence' || a?.coexistence?.enabled
  ).length;

  const checks = [
    checkEmbeddedSignupConfig(),
    fieldCheck,
    checkCoexistenceGating({ coexistenceEnabled, fieldCheck, coexistenceAccountCount }),
    checkTokenSources(accounts),
  ];

  // 'auto' is what boot passes: include the check while it costs a call or
  // two, skip it once a deployment has enough customers for that to matter.
  const wabaAccounts = accounts.filter((a: any) => a.wabaId);
  const runWabaCheck =
    includeWabaSubscriptions === 'auto'
      ? wabaAccounts.length > 0 && wabaAccounts.length <= WABA_CHECK_AUTO_LIMIT
      : Boolean(includeWabaSubscriptions);

  if (runWabaCheck) {
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

export const checkWabaSubscriptions = async (
  accounts: any[],
  { graphVersion }: { graphVersion?: string } = {}
) => {
  const withWaba = accounts.filter((a: any) => a.wabaId);
  const results: any[] = [];

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
      ? `${results.filter((r: any) => r.severity === 'ok').length}/${withWaba.length} active WABA(s) confirmed subscribed to this app`
      : 'No active accounts with a WABA ID',
    accounts: results,
  };
};

const LOG_BY_SEVERITY = { error: 'error', warn: 'warn', info: 'info', ok: 'info' };

export const logPreflightReport = (report: any) => {
  const banner = `[preflight] WhatsApp configuration check — ${report.severity.toUpperCase()} (Graph ${report.graphVersion}, coexistence ${report.coexistenceEnabled ? 'ON' : 'OFF'})`;
  logger[LOG_BY_SEVERITY[report.severity] || 'info'](banner);

  for (const check of report.checks) {
    const level = LOG_BY_SEVERITY[check.severity] || 'info';
    logger[level](`[preflight] ${check.id}: ${check.summary}`);

    // A count ("0/1 confirmed") does not say which number is unreachable or
    // why, and that is exactly what someone reading this line needs next.
    if (check.id === 'waba_subscriptions') {
      for (const account of check.accounts || []) {
        if (account.severity === 'ok') continue;
        logger[LOG_BY_SEVERITY[account.severity] || 'info'](
          `[preflight] waba_subscriptions: WABA ${account.wabaId || 'unknown'} ` +
            `(phone_number_id ${account.phoneNumberId || 'unknown'}): ${account.note}`
        );
      }
    }
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
export const runPreflightOnBoot = async () => {
  if (String(process.env.RUN_PREFLIGHT_ON_BOOT ?? 'true').toLowerCase() === 'false') return null;
  try {
    // App-level fields plus, while there are few enough WABAs to be cheap, the
    // per-WABA subscription. Those two are not interchangeable and the
    // difference is the whole diagnosis: an app can have `messages` ticked and
    // the callback URL verified, and still receive nothing for a WABA it was
    // never attached to. Leaving that to the admin endpoint meant the answer
    // was only ever a login away — no use at all when the question is being
    // asked of the logs.
    const report = await runPreflightChecks({ includeWabaSubscriptions: 'auto' });
    logPreflightReport(report);
    return report;
  } catch (error) {
    logger.error('[preflight] Check failed (non-fatal):', error.message);
    return null;
  }
};

