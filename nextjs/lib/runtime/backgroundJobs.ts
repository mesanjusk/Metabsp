import logger from '../utils/logger';
import { startWhatsAppSendWorker } from '../queues/whatsappSendWorker';
import { startWebhookWorker } from '../queues/webhookWorker';
import { startTokenRefreshScheduler } from '../services/tokenRefreshService';
import { startInvoiceScheduler } from '../services/invoiceSchedulerService';
import { startBackupScheduler } from '../services/backupSchedulerService';
import { startKeepAliveScheduler } from '../services/keepAliveService';
import { startRetentionScheduler } from '../services/dataRetentionService';
import { runPreflightOnBoot } from '../services/preflightCheckService';
import { runBootSelfCheck } from '../services/bootSelfCheck';

/**
 * Everything that must keep running between requests, started once per process.
 *
 * Called from instrumentation.ts, which Next.js invokes exactly once when the
 * server boots. That hook — rather than server.js — is what lets this file be
 * TypeScript that imports the same models and services the route handlers use:
 * server.js runs before Next's compiler exists and can only require plain
 * CommonJS.
 *
 * Every replica boots this independently. Duplicate scheduler runs are
 * prevented by a per-tick Redis leader lock (lib/services/schedulerLock.ts);
 * the two queue workers are deliberately NOT locked, because competing
 * consumers on one BullMQ queue is how throughput scales — each job is still
 * delivered to exactly one of them.
 *
 * Set RUN_BACKGROUND_JOBS=false on an instance that should serve HTTP only,
 * e.g. when running dedicated worker instances alongside web instances.
 */
let started = false;

export function startBackgroundJobs(): void {
  if (started) return;
  started = true;

  const enabled = String(process.env.RUN_BACKGROUND_JOBS ?? 'true').toLowerCase() !== 'false';
  if (!enabled) {
    logger.info('[runtime] RUN_BACKGROUND_JOBS=false — this instance serves HTTP only');
    return;
  }

  // Consumers first: a queue with a producer and no consumer is the failure
  // mode this whole module exists to prevent.
  startWhatsAppSendWorker();
  startWebhookWorker();

  // Refreshes Meta long-lived tokens before they expire. Without this every
  // connected number silently stops sending about 60 days after onboarding.
  startTokenRefreshScheduler();

  // Metered invoice generation for subscriptions whose billing period ended.
  startInvoiceScheduler();

  // Off unless ENABLE_SCHEDULED_BACKUPS=true (needs mongodump + a real mount).
  startBackupScheduler();

  // Keeps customers' registered webhook destinations warm.
  startKeepAliveScheduler();

  // Enforces the published data-retention policy. No-ops loudly when no
  // retention window is configured, which is the default.
  startRetentionScheduler();

  logger.info('[runtime] Background workers and schedulers started');

  // Read-only audit of the Meta-side configuration whose failure mode is
  // silence rather than an error — most importantly coexistence being enabled
  // while its webhook fields are unsubscribed. Deliberately not awaited so it
  // can never delay boot; set RUN_PREFLIGHT_ON_BOOT=false to skip.
  runPreflightOnBoot().catch((error: any) =>
    logger.error('[preflight] Boot check failed (non-fatal):', error.message)
  );

  // Two conditions that otherwise stay silent until customers notice: an
  // encryption key that cannot read the tokens already in the database, and a
  // Redis eviction policy that discards queued messages. Non-blocking and
  // never fatal — see lib/services/bootSelfCheck.ts.
  runBootSelfCheck().catch((error: any) =>
    logger.error('[self-check] Boot self-check failed (non-fatal):', error.message)
  );
}
