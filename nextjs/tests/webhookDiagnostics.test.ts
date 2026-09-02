import { describe, expect, it, vi, beforeEach } from 'vitest';

// Every stage of the diagnostic reaches outside the process — Meta, Redis,
// Mongo — so each dependency is stubbed at its own module boundary and the
// assertions are about the verdict the stage reaches, not about the plumbing.
const fetchAppWebhookFields = vi.fn();
const checkWabaSubscriptions = vi.fn();
vi.mock('@/lib/services/preflightCheckService', () => ({
  fetchAppWebhookFields,
  checkWabaSubscriptions,
  BASE_WEBHOOK_FIELDS: ['messages'],
}));

const readWebhookTelemetry = vi.fn();
vi.mock('@/lib/whatsapp/webhookTelemetry', () => ({ readWebhookTelemetry }));

const getJobCounts = vi.fn();
const getWorkers = vi.fn();
vi.mock('@/lib/queues/webhookQueue', () => ({
  WEBHOOK_QUEUE_NAME: 'whatsapp-webhook-inbound',
  getWebhookQueue: () => ({ getJobCounts, getWorkers }),
}));

const { checkEndpointConfig, checkMetaSubscription, checkDeliveryTelemetry, checkQueueDrain } = await import(
  '@/lib/services/webhookDiagnosticsService'
);

const telemetry = (counts: Record<string, number>, lastAt: Record<string, string | null> = {}) => ({
  available: true,
  counts: {
    accepted: 0,
    rejected_signature: 0,
    rejected_unconfigured: 0,
    ignored_object: 0,
    verify_ok: 0,
    verify_rejected: 0,
    ...counts,
  },
  lastAt: {
    accepted: null,
    rejected_signature: null,
    rejected_unconfigured: null,
    ignored_object: null,
    verify_ok: null,
    verify_rejected: null,
    ...lastAt,
  },
});

describe('webhook diagnostics — this deployment can accept a delivery', () => {
  beforeEach(() => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'a-verify-token';
    process.env.META_APP_SECRET = 'an-app-secret';
    process.env.WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE = 'true';
  });

  it('passes when both secrets are set and signatures are enforced', () => {
    const check = checkEndpointConfig();
    expect(check.severity).toBe('ok');
    expect(check.hasVerifyToken).toBe(true);
    expect(check.hasAppSecret).toBe(true);
  });

  it('never echoes the verify token or the app secret', () => {
    const serialized = JSON.stringify(checkEndpointConfig());
    expect(serialized).not.toContain('a-verify-token');
    expect(serialized).not.toContain('an-app-secret');
  });

  it('calls a missing app secret an error, because every delivery is then refused', () => {
    delete process.env.META_APP_SECRET;
    const check = checkEndpointConfig();
    expect(check.severity).toBe('error');
    expect(check.summary).toContain('META_APP_SECRET');
  });

  it('warns when signature enforcement is switched off', () => {
    process.env.WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE = 'false';
    expect(checkEndpointConfig().severity).toBe('warn');
  });
});

describe('webhook diagnostics — what Meta has been told to send', () => {
  it('fails on a subscription without the messages field', async () => {
    fetchAppWebhookFields.mockResolvedValueOnce({
      status: 'ok',
      fields: ['account_alerts', 'account_review_update'],
      callbackUrl: 'https://meta.example.test/webhook',
      active: true,
    });

    const check = await checkMetaSubscription({ expectedOrigin: 'https://meta.example.test' });
    expect(check.severity).toBe('error');
    expect(check.hasMessagesField).toBe(false);
    expect(check.summary).toContain('`messages` field is NOT subscribed');
  });

  it('fails when Meta delivers to a different deployment than this one', async () => {
    // The mistake a URL change makes: updated on one app or environment while
    // the inbox being watched is served by another.
    fetchAppWebhookFields.mockResolvedValueOnce({
      status: 'ok',
      fields: ['messages'],
      callbackUrl: 'https://old-host.example.test/webhook',
      active: true,
    });

    const check = await checkMetaSubscription({ expectedOrigin: 'https://meta.example.test' });
    expect(check.severity).toBe('error');
    expect(check.pointsElsewhere).toBe(true);
  });

  it('passes when messages is subscribed and the URL points here', async () => {
    fetchAppWebhookFields.mockResolvedValueOnce({
      status: 'ok',
      fields: ['messages', 'message_template_status_update'],
      callbackUrl: 'https://meta.example.test/webhook',
      active: true,
    });

    const check = await checkMetaSubscription({ expectedOrigin: 'https://meta.example.test' });
    expect(check.severity).toBe('ok');
    expect(check.pointsElsewhere).toBe(false);
  });
});

describe('webhook diagnostics — what actually arrived', () => {
  it('separates "Meta never called" from "we refused every call"', async () => {
    readWebhookTelemetry.mockResolvedValueOnce(
      telemetry({ verify_ok: 1, rejected_signature: 12 }, { rejected_signature: '2026-09-02T10:00:00.000Z' })
    );

    const check = await checkDeliveryTelemetry();
    expect(check.severity).toBe('error');
    // The distinction the whole counter exists for: this is a local secret
    // problem, not a Meta-side subscription problem, and the two have
    // opposite fixes.
    expect(check.summary).toContain('REFUSED');
  });

  it('flags a URL that verified but has never received a delivery', async () => {
    readWebhookTelemetry.mockResolvedValueOnce(telemetry({ verify_ok: 1 }, { verify_ok: '2026-09-02T10:00:00.000Z' }));

    const check = await checkDeliveryTelemetry();
    expect(check.severity).toBe('error');
    expect(check.summary).toContain('never POSTed');
  });

  it('passes once deliveries are being accepted', async () => {
    readWebhookTelemetry.mockResolvedValueOnce(telemetry({ accepted: 40 }, { accepted: '2026-09-02T10:00:00.000Z' }));
    expect((await checkDeliveryTelemetry()).severity).toBe('ok');
  });

  it('reports unreadable counters as a warning rather than throwing', async () => {
    readWebhookTelemetry.mockResolvedValueOnce({
      available: false,
      reason: 'Redis command timed out',
      counts: telemetry({}).counts,
      lastAt: telemetry({}).lastAt,
    });
    expect((await checkDeliveryTelemetry()).severity).toBe('warn');
  });
});

describe('webhook diagnostics — is anything draining the queue', () => {
  beforeEach(() => {
    getJobCounts.mockReset();
    getWorkers.mockReset();
  });

  it('calls a queue with jobs and no worker broken', async () => {
    // Acknowledged deliveries piling up behind no consumer is the failure
    // that leaves the endpoint answering a healthy 200 the whole time.
    getJobCounts.mockResolvedValueOnce({ waiting: 31, active: 0, delayed: 0, failed: 0, completed: 0 });
    getWorkers.mockResolvedValueOnce([]);

    const check = await checkQueueDrain();
    expect(check.severity).toBe('error');
    expect(check.summary).toContain('No worker is attached');
  });

  it('passes with a worker attached and nothing failed', async () => {
    getJobCounts.mockResolvedValueOnce({ waiting: 0, active: 1, delayed: 0, failed: 0, completed: 900 });
    getWorkers.mockResolvedValueOnce([{ id: 'worker-1' }]);

    const check = await checkQueueDrain();
    expect(check.severity).toBe('ok');
    expect(check.workerCount).toBe(1);
  });

  it('reports an unreachable queue instead of hanging on it', async () => {
    getJobCounts.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    getWorkers.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const check = await checkQueueDrain();
    expect(check.severity).toBe('error');
    expect(check.summary).toContain('unreachable');
  });
});
