#!/usr/bin/env node
'use strict';

/**
 * Render pre-deploy gate for Meta Tech Provider readiness.
 *
 * This intentionally validates only things that can be proven from the
 * running deployment environment. Meta-dashboard state (Business Verification,
 * App Review approval, webhook field subscriptions, etc.) is external and is
 * reported as a manual gate in docs/meta-tech-provider/READINESS_STATUS.md.
 */

const errors = [];
const warnings = [];

function value(name) {
  return String(process.env[name] || '').trim();
}

function requireEnv(name, reason) {
  const v = value(name);
  if (!v) errors.push(`${name}: missing${reason ? ` — ${reason}` : ''}`);
  return v;
}

function warnEnv(name, reason) {
  const v = value(name);
  if (!v) warnings.push(`${name}: missing${reason ? ` — ${reason}` : ''}`);
  return v;
}

function isPlaceholder(v) {
  if (!v) return false;
  return /^(changeme|change-me|your_|example|placeholder|test123|secret)$/i.test(v) ||
    /^<.*>$/.test(v) ||
    /your[-_ ]?(app|secret|token|password|key)/i.test(v);
}

function rejectPlaceholder(name) {
  const v = value(name);
  if (isPlaceholder(v)) errors.push(`${name}: looks like a placeholder value`);
}

function parseGraphVersion(raw) {
  const match = /^v(\d+)\.(\d+)$/.exec(raw);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

const required = [
  ['MONGO_URI', 'database connection required by the app'],
  ['REDIS_URL', 'queues/rate limiting require Redis'],
  ['JWT_SECRET', 'authentication cannot use a default/empty secret'],
  ['META_APP_ID', 'Meta app identity is required'],
  ['META_APP_SECRET', 'OAuth code exchange and webhook signature validation require it'],
  ['META_EMBEDDED_SIGNUP_CONFIG_ID', 'Embedded Signup cannot launch without a config id'],
  ['WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'Meta webhook verification requires it'],
  ['WHATSAPP_TOKEN_ENCRYPTION_KEY', 'stored WhatsApp credentials must be encrypted']
];

for (const [name, reason] of required) requireEnv(name, reason);
for (const [name] of required) rejectPlaceholder(name);

const apiVersion = value('WHATSAPP_API_VERSION') || value('META_API_VERSION');
if (!apiVersion) {
  errors.push('WHATSAPP_API_VERSION: missing');
} else {
  const parsed = parseGraphVersion(apiVersion);
  if (!parsed) {
    errors.push(`WHATSAPP_API_VERSION: invalid format "${apiVersion}" (expected vNN.N)`);
  } else if (parsed.major < 23) {
    errors.push(`WHATSAPP_API_VERSION: ${apiVersion} is below this repo's validated baseline v23.0`);
  }
}

if (value('WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE').toLowerCase() !== 'true') {
  errors.push('WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE must be true in production');
}

const frontendUrl = value('FRONTEND_URL') || value('PUBLIC_APP_URL') || value('NEXT_PUBLIC_APP_URL');
if (!frontendUrl) {
  warnings.push('FRONTEND_URL/PUBLIC_APP_URL: no canonical public app URL is configured');
} else {
  try {
    const u = new URL(frontendUrl);
    if (u.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
      errors.push(`Public app URL must use HTTPS in production: ${frontendUrl}`);
    }
  } catch {
    errors.push(`Public app URL is invalid: ${frontendUrl}`);
  }
}

if (value('META_ENABLE_COEXISTENCE').toLowerCase() === 'true') {
  warnings.push('Coexistence is enabled: complete one real WhatsApp Business App onboarding end-to-end before Meta submission');
}

const enforceReview = value('META_REVIEW_ENFORCE_READY').toLowerCase() === 'true';
const reviewerFields = [
  ['META_REVIEWER_LOGIN', 'reviewer username/mobile'],
  ['META_REVIEWER_PASSWORD', 'reviewer password'],
  ['META_REVIEW_CONTACT_EMAIL', 'review contact email']
];

if (enforceReview) {
  for (const [name, reason] of reviewerFields) {
    requireEnv(name, reason);
    rejectPlaceholder(name);
  }
} else {
  for (const [name, reason] of reviewerFields) warnEnv(name, `${reason}; required before App Review submission`);
  warnings.push('META_REVIEW_ENFORCE_READY is not true; deployment is allowed, but this is not a Meta-submission certification');
}

console.log('\nMetaBSP deployment readiness check');
console.log('=================================');
if (warnings.length) {
  console.log('\nWarnings:');
  for (const warning of warnings) console.log(`  - ${warning}`);
}

if (errors.length) {
  console.error('\nBlocking errors:');
  for (const error of errors) console.error(`  - ${error}`);
  console.error('\nDeployment blocked. Fix the Render environment/configuration and redeploy.\n');
  process.exit(1);
}

console.log('\nPASS: code/runtime configuration passed the deploy gate.');
console.log(enforceReview
  ? 'PASS: reviewer credential fields are present for Meta App Review. External Meta-dashboard gates still require manual verification.\n'
  : 'NOTE: Set META_REVIEW_ENFORCE_READY=true before the final Meta App Review deployment to enforce reviewer credentials.\n');
