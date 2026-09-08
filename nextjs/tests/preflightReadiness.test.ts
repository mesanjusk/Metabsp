import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkVersions,
  checkWebhookSecurity,
  checkPublicDomain,
  buildReadinessSummary,
  checkEmbeddedSignupConfig,
  parseGraphVersion,
} from '@/lib/services/preflightCheckService';

// Phase 9: the deployment-gate checks that fail silently when wrong — version
// drift, a missing verify token or encryption key, and a callback URL pointing
// at a different host than this deployment.

const ENV_KEYS = [
  'WHATSAPP_API_VERSION',
  'META_API_VERSION',
  'META_JS_SDK_VERSION',
  'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
  'WHATSAPP_VERIFY_TOKEN',
  'VERIFY_TOKEN',
  'WHATSAPP_TOKEN_ENCRYPTION_KEY',
  'WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE',
  'FRONTEND_URL',
  'PUBLIC_APP_URL',
  'NEXT_PUBLIC_APP_URL',
  'META_APP_ID',
  'META_APP_SECRET',
  'META_EMBEDDED_SIGNUP_CONFIG_ID',
];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('parseGraphVersion', () => {
  it('parses vNN.N and rejects anything else', () => {
    expect(parseGraphVersion('v23.0')).toEqual({ major: 23, minor: 0 });
    expect(parseGraphVersion('23.0')).toBeNull();
    expect(parseGraphVersion('latest')).toBeNull();
  });
});

describe('checkVersions', () => {
  it('is ok at the baseline for both Graph and SDK', () => {
    process.env.WHATSAPP_API_VERSION = 'v23.0';
    process.env.META_JS_SDK_VERSION = 'v24.0';
    const result = checkVersions();
    expect(result.severity).toBe('ok');
    expect(result.graphVersion).toBe('v23.0');
    expect(result.sdkVersion).toBe('v24.0');
  });

  it('errors when the Graph version is below the baseline', () => {
    process.env.WHATSAPP_API_VERSION = 'v20.0';
    expect(checkVersions().severity).toBe('error');
  });

  it('errors on a malformed version', () => {
    process.env.WHATSAPP_API_VERSION = 'not-a-version';
    expect(checkVersions().severity).toBe('error');
  });

  it('falls the SDK version back to the Graph version when unset', () => {
    process.env.WHATSAPP_API_VERSION = 'v23.0';
    const result = checkVersions();
    expect(result.sdkVersion).toBe('v23.0');
  });
});

describe('checkWebhookSecurity', () => {
  it('errors when the verify token or encryption key is missing', () => {
    const result = checkWebhookSecurity();
    expect(result.severity).toBe('error');
    expect(result.missing).toContain('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
    expect(result.missing).toContain('WHATSAPP_TOKEN_ENCRYPTION_KEY');
  });

  it('never leaks secret values, only present/absent', () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'super-secret-token';
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = 'super-secret-key';
    process.env.WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE = 'true';
    const result = checkWebhookSecurity();
    expect(result.severity).toBe('ok');
    expect(JSON.stringify(result)).not.toContain('super-secret');
    expect(result.hasVerifyToken).toBe(true);
    expect(result.hasEncryptionKey).toBe(true);
  });

  it('warns when signature enforcement is off even with secrets present', () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 't';
    process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = 'k';
    process.env.WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE = 'false';
    expect(checkWebhookSecurity().severity).toBe('warn');
  });
});

describe('checkPublicDomain', () => {
  it('is ok when the stored callback shares the production origin', () => {
    process.env.FRONTEND_URL = 'https://meta.sanjusk.in';
    const result = checkPublicDomain({ callbackUrl: 'https://meta.sanjusk.in/webhook' });
    expect(result.severity).toBe('ok');
  });

  it('errors when Meta delivers to a different host', () => {
    process.env.FRONTEND_URL = 'https://meta.sanjusk.in';
    const result = checkPublicDomain({ callbackUrl: 'https://old-host.onrender.com/webhook' });
    expect(result.severity).toBe('error');
    expect(result.summary).toMatch(/NOT this deployment/i);
  });

  it('warns when no public URL is configured', () => {
    expect(checkPublicDomain({ callbackUrl: 'https://x.test/webhook' }).severity).toBe('warn');
  });

  it('errors on a non-https public URL', () => {
    process.env.FRONTEND_URL = 'http://meta.sanjusk.in';
    expect(checkPublicDomain({}).severity).toBe('error');
  });
});

describe('buildReadinessSummary', () => {
  const ok = (id: string, extra: any = {}) => ({ id, severity: 'ok', ...extra });

  it('maps webhook fields and readiness states for the dashboard', () => {
    const summary = buildReadinessSummary({
      coexistenceEnabled: true,
      embeddedSignupCheck: ok('embedded_signup_config'),
      versionCheck: ok('versions'),
      securityCheck: ok('webhook_security'),
      fieldCheck: { subscribed: ['messages', 'history', 'smb_message_echoes', 'smb_app_state_sync'] },
      domainCheck: ok('public_domain', { callbackUrl: 'https://meta.sanjusk.in/webhook' }),
    });

    expect(summary.embeddedSignupV4).toBe('ready');
    expect(summary.coexistenceSelector).toBe('ready');
    expect(summary.webhookFields).toEqual({
      messages: 'subscribed',
      history: 'subscribed',
      smb_message_echoes: 'subscribed',
      smb_app_state_sync: 'subscribed',
    });
    expect(summary.metaWebhookCallback).toBe('configured');
    expect(summary.productionDomain).toBe('ready');
  });

  it('reports coexistence not_ready when a coexistence field is missing', () => {
    const summary = buildReadinessSummary({
      coexistenceEnabled: true,
      embeddedSignupCheck: ok('embedded_signup_config'),
      versionCheck: ok('versions'),
      securityCheck: ok('webhook_security'),
      fieldCheck: { subscribed: ['messages', 'history'] },
      domainCheck: ok('public_domain', { callbackUrl: 'https://meta.sanjusk.in/webhook' }),
    });
    expect(summary.coexistenceSelector).toBe('not_ready');
    expect(summary.webhookFields.smb_message_echoes).toBe('missing');
  });

  it('reports the selector disabled when coexistence is off', () => {
    const summary = buildReadinessSummary({
      coexistenceEnabled: false,
      embeddedSignupCheck: ok('embedded_signup_config'),
      versionCheck: ok('versions'),
      securityCheck: ok('webhook_security'),
      fieldCheck: { subscribed: ['messages'] },
      domainCheck: ok('public_domain', { callbackUrl: 'https://meta.sanjusk.in/webhook' }),
    });
    expect(summary.coexistenceSelector).toBe('disabled');
  });
});

describe('checkEmbeddedSignupConfig still gates on the config id', () => {
  it('errors when the config id is unset', () => {
    process.env.META_APP_ID = '123';
    process.env.META_APP_SECRET = 'secret';
    const result = checkEmbeddedSignupConfig();
    expect(result.severity).toBe('error');
    expect(result.missing).toContain('META_EMBEDDED_SIGNUP_CONFIG_ID');
  });
});
