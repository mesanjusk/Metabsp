/**
 * One command that answers "can we submit for App Review yet?".
 *
 *   npm run submission-check --workspace=backend
 *
 * Run it against production, with production's environment. It is read-only:
 * no Graph write is ever issued and no document is modified.
 *
 * The point is to replace a checklist nobody can verify with a check that
 * fails loudly. Every gate below has been a real rejection cause for this app
 * or reads directly on one:
 *
 *   - the webhook callback URL registered at Meta pointed at a host that is
 *     not this backend, so inbound customer messages went nowhere while every
 *     "is the field subscribed" check still passed;
 *   - the testing instructions said no credentials were required when the
 *     WhatsApp dashboard is behind requireAuth and signup needs a WhatsApp OTP;
 *   - `public_profile` was requested with zero lifetime API calls behind it.
 *
 * What it cannot see, and says so rather than implying otherwise: Business
 * Verification, the Allowed Domains for the JavaScript SDK list, the OAuth
 * redirect URI allowlist, and whether the reviewer videos exist. Those live in
 * Meta's dashboard with no read API, so the script prints the exact values to
 * set and leaves the confirmation to a person.
 */

require('dotenv').config();

const mongoose = require('mongoose');
const axios = require('axios');

const { runPreflightChecks } = require('../src/services/preflightCheckService');
const { getGraphApiVersion } = require('../src/config/graphApi');

const REQUIRED_PERMISSIONS = [
  'whatsapp_business_messaging',
  'whatsapp_business_management',
  'business_management',
];

// A value that is present but obviously a template is worse than an unset one:
// it satisfies every `if (!process.env.X)` guard in the codebase and then fails
// at the Graph call.
const PLACEHOLDER_PATTERNS = [
  /^your_/i,
  /^changeme$/i,
  /^change_me$/i,
  /^<.*>$/,
  /^\[.*\]$/,
  /^xxx+$/i,
  /^todo$/i,
  /^placeholder$/i,
];

const isPlaceholder = (value) => PLACEHOLDER_PATTERNS.some((p) => p.test(String(value).trim()));

const results = [];
const record = (severity, id, message, detail) => {
  results.push({ severity, id, message, detail });
};

const env = (name) => String(process.env[name] || '').trim();

// ── Environment ──────────────────────────────────────────────────────────────

function checkEnvironment() {
  const required = [
    ['MONGO_URI', 'the database'],
    ['JWT_SECRET', 'session signing'],
    ['META_APP_ID', 'every Graph call and Embedded Signup'],
    ['META_APP_SECRET', 'webhook signature verification and the app access token'],
    ['META_EMBEDDED_SIGNUP_CONFIG_ID', 'launching the Embedded Signup popup'],
    ['WHATSAPP_TOKEN_ENCRYPTION_KEY', 'decrypting stored customer tokens'],
    ['WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'the webhook verification handshake'],
    ['PUBLIC_APP_URL', 'the URLs handed to Meta and to reviewers'],
  ];

  for (const [name, why] of required) {
    const value = env(name);
    if (!value) {
      record('error', `env:${name}`, `${name} is not set — needed for ${why}.`);
    } else if (isPlaceholder(value)) {
      record('error', `env:${name}`, `${name} still holds a placeholder value ("${value}") — needed for ${why}.`);
    }
  }

  if (env('WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE').toLowerCase() === 'false') {
    record(
      'error',
      'env:WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE',
      'Webhook signature enforcement is turned OFF. Anyone who learns the callback URL can inject messages. Set it to true.'
    );
  }

  const jwtSecret = env('JWT_SECRET');
  if (jwtSecret && jwtSecret.length < 32) {
    record('warn', 'env:JWT_SECRET', `JWT_SECRET is only ${jwtSecret.length} characters; use at least 32.`);
  }

  if (!env('SENTRY_DSN')) {
    record('warn', 'env:SENTRY_DSN', 'SENTRY_DSN is unset, so error tracking is silently off in production.');
  }
}

// ── Webhook callback URL ─────────────────────────────────────────────────────
//
// Subscribing to webhook FIELDS and registering a callback URL are independent
// settings. Every field can be ticked while the callback points at a dead host,
// and nothing in the app notices, because nothing arrives to notice.

function checkCallbackUrl(preflight) {
  const webhookCheck = preflight.checks.find((c) => c.id === 'webhook_fields');
  const registered = String(webhookCheck?.callbackUrl || '').trim();
  const publicUrl = env('PUBLIC_APP_URL');

  if (!registered) {
    record(
      'warn',
      'webhook:callback_url',
      'Could not read the webhook callback URL registered at Meta — check META_APP_ID/META_APP_SECRET, then confirm it by hand in App Dashboard → WhatsApp → Configuration.'
    );
    return;
  }

  if (!publicUrl) {
    record('info', 'webhook:callback_url', `Meta has the callback URL registered as ${registered}. Set PUBLIC_APP_URL so this can be checked automatically.`);
    return;
  }

  let registeredHost;
  let expectedHost;
  try {
    registeredHost = new URL(registered).host;
    expectedHost = new URL(publicUrl).host;
  } catch (_error) {
    record('warn', 'webhook:callback_url', `Could not parse the callback URL (${registered}) or PUBLIC_APP_URL (${publicUrl}).`);
    return;
  }

  if (registeredHost !== expectedHost) {
    record(
      'error',
      'webhook:callback_url',
      `Meta delivers webhooks to ${registered}, but this deployment is ${publicUrl}. Inbound customer messages and delivery statuses are going to a different host — the reviewer's test message will never appear. Fix it in App Dashboard → WhatsApp → Configuration.`
    );
    return;
  }

  record('ok', 'webhook:callback_url', `Webhook callback URL matches this deployment (${registered}).`);
}

// ── Reviewer account ─────────────────────────────────────────────────────────

async function checkReviewerAccount() {
  const login = env('REVIEWER_LOGIN');

  if (!login) {
    record(
      'error',
      'reviewer:account',
      'REVIEWER_LOGIN is not set, so no reviewer account can be verified. A Meta reviewer cannot self-register — signup requires a WhatsApp OTP. Create one with: npm run seed-reviewer --workspace=backend'
    );
    return;
  }

  const User = require('../bulk/models/User');
  const user = await User.findOne({ username: login, tenantId: null });

  if (!user) {
    record(
      'error',
      'reviewer:account',
      `No account exists with username "${login}". Create it with: REVIEWER_LOGIN=${login} REVIEWER_PASSWORD=… npm run seed-reviewer --workspace=backend`
    );
    return;
  }

  if (!user.isActive) {
    record('error', 'reviewer:account', `The reviewer account "${login}" exists but is inactive — login returns 403. Re-run seed-reviewer to re-activate it.`);
    return;
  }

  if (!user.password) {
    record('error', 'reviewer:account', `The reviewer account "${login}" has no password set (social-login only), so a reviewer cannot sign in with credentials.`);
    return;
  }

  record('ok', 'reviewer:account', `Reviewer account "${login}" exists and is active.`);

  if (!env('REVIEWER_PASSWORD')) {
    record('warn', 'reviewer:account', 'REVIEWER_PASSWORD is not set here, so the password could not be verified. Sign in yourself in a private window before submitting.');
  }
}

// ── Public URLs Meta will fetch ──────────────────────────────────────────────

async function checkPublicUrls() {
  const base = env('PUBLIC_APP_URL').replace(/\/$/, '');
  if (!base) return;

  const paths = [
    ['/privacy-policy', 'Privacy Policy URL'],
    ['/terms-of-service', 'Terms of Service URL'],
    ['/data-deletion', 'Data deletion URL'],
    ['/login', 'the page reviewers are sent to'],
  ];

  for (const [path, label] of paths) {
    const url = `${base}${path}`;
    try {
      const res = await axios.get(url, { timeout: 15000, validateStatus: () => true, maxRedirects: 5 });
      if (res.status >= 200 && res.status < 400) {
        record('ok', `url:${path}`, `${label} responds ${res.status} (${url}).`);
      } else {
        record('error', `url:${path}`, `${label} returns HTTP ${res.status} at ${url}. Meta fetches this during review.`);
      }
    } catch (error) {
      record('error', `url:${path}`, `${label} is unreachable at ${url}: ${error.message}`);
    }
  }
}

// ── Things only a person can confirm ─────────────────────────────────────────

function printDashboardValues() {
  const base = env('PUBLIC_APP_URL').replace(/\/$/, '') || '<PUBLIC_APP_URL is not set>';
  const host = base.replace(/^https?:\/\//, '');
  const configId = env('META_EMBEDDED_SIGNUP_CONFIG_ID') || '<META_EMBEDDED_SIGNUP_CONFIG_ID is not set>';

  const rows = [
    ['Settings → Basic', 'App Domains', host],
    ['Settings → Basic', 'Site URL', `${base}/`],
    ['Settings → Basic', 'Privacy Policy URL', `${base}/privacy-policy`],
    ['Settings → Basic', 'Terms of Service URL', `${base}/terms-of-service`],
    ['Settings → Basic', 'Data deletion URL', `${base}/data-deletion`],
    ['Facebook Login for Business → Settings', 'Allowed Domains for the JavaScript SDK', base],
    ['Facebook Login for Business → Settings', 'Valid OAuth Redirect URIs', `${base}/login`],
    ['WhatsApp → Configuration', 'Webhook Callback URL', `${base}/webhook`],
    ['WhatsApp → Embedded Signup', 'Configuration ID', configId],
    ['App Review', 'Permissions requested', REQUIRED_PERMISSIONS.join(', ')],
  ];

  console.log('\nMeta App Dashboard — set these by hand (no read API exists for most of them):\n');
  const width = Math.max(...rows.map((r) => r[1].length));
  for (const [where, field, value] of rows) {
    console.log(`  ${field.padEnd(width)}  ${value}`);
    console.log(`  ${' '.repeat(width)}  ↳ ${where}`);
  }
  console.log('\n  Do NOT request public_profile: the app makes zero calls that need it,');
  console.log('  and requesting an unused permission is a documented rejection trigger.');
  console.log('\n  Allowed Domains for the JavaScript SDK is not optional. Left unset, clicking');
  console.log('  "Connect with Meta" fails with "JSSDK unknown host domain" and Embedded');
  console.log('  Signup — the exact flow under review — never opens.\n');
}

function printManualGates() {
  console.log('Not checkable from here — confirm each one yourself:\n');
  const gates = [
    'Business Verification is complete in Meta Business Manager.',
    'The legal pages contain reviewed final policies, not the shipped templates.',
    'You have signed in as the reviewer, in a private window, and reached "Connect with Meta".',
    'A real inbound message arrives in the inbox and a real reply is delivered.',
    'A screen recording exists for each of the three requested permissions.',
    'Coexistence has had one real end-to-end onboarding, or META_ENABLE_COEXISTENCE=false.',
  ];
  for (const gate of gates) console.log(`  [ ] ${gate}`);
  console.log('');
}

// ── Report ───────────────────────────────────────────────────────────────────

const ICON = { error: '✗', warn: '!', info: 'i', ok: '✓' };

function report() {
  const order = ['error', 'warn', 'info', 'ok'];
  const bySeverity = (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity);

  console.log('\nAutomated checks:\n');
  for (const r of [...results].sort(bySeverity)) {
    console.log(`  ${ICON[r.severity]} ${r.message}`);
  }

  const errors = results.filter((r) => r.severity === 'error');
  const warnings = results.filter((r) => r.severity === 'warn');

  console.log('');
  if (errors.length) {
    console.log(`NOT READY — ${errors.length} blocker(s), ${warnings.length} warning(s).`);
    console.log('Fix every ✗ above, then re-run this command.');
  } else {
    console.log(`Automated checks pass (${warnings.length} warning(s)).`);
    console.log('The manual gates below are what remain. Submitting before they are true is how the last attempt was rejected.');
  }
  console.log('');

  return errors.length;
}

async function main() {
  console.log('MetaBSP — App Review submission check');
  console.log(`Graph API ${getGraphApiVersion()} · ${new Date().toISOString()}`);

  checkEnvironment();

  if (env('MONGO_URI') && !isPlaceholder(env('MONGO_URI'))) {
    await mongoose.connect(process.env.MONGO_URI);
  } else {
    record('warn', 'db', 'Skipped the database checks because MONGO_URI is unusable.');
  }

  try {
    if (mongoose.connection.readyState === 1) {
      await checkReviewerAccount();
    }

    if (env('META_APP_ID') && env('META_APP_SECRET')) {
      const preflight = await runPreflightChecks({ includeWabaSubscriptions: mongoose.connection.readyState === 1 });
      for (const check of preflight.checks) {
        record(check.severity, `preflight:${check.id}`, check.summary);
      }
      checkCallbackUrl(preflight);
    }

    await checkPublicUrls();
  } finally {
    if (mongoose.connection.readyState === 1) await mongoose.disconnect();
  }

  const blockers = report();
  printDashboardValues();
  printManualGates();

  process.exitCode = blockers ? 1 : 0;
}

if (require.main === module) {
  main().catch((error) => {
    console.error('submission-check failed to run:', error.message);
    process.exitCode = 2;
  });
}

module.exports = { isPlaceholder, PLACEHOLDER_PATTERNS, REQUIRED_PERMISSIONS };
