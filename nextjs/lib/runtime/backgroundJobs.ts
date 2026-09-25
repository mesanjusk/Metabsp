import logger from '../utils/logger';
import { startWhatsAppSendWorker } from '../queues/whatsappSendWorker';
import { startWebhookWorker } from '../queues/webhookWorker';
import { startLeadFinderWorker } from '../queues/leadFinderWorker';
import { startTokenRefreshScheduler } from '../services/tokenRefreshService';
import { startInvoiceScheduler } from '../services/invoiceSchedulerService';
import { startBackupScheduler } from '../services/backupSchedulerService';
import { startKeepAliveScheduler } from '../services/keepAliveService';
import { startRetentionScheduler } from '../services/dataRetentionService';
import { startGoogleReviewAutomationScheduler } from '../googleBusiness/reviewAutomation';
import { runPreflightOnBoot } from '../services/preflightCheckService';
import { runBootSelfCheck } from '../services/bootSelfCheck';
import { startVideoWorkers } from '../video/core/queue/video-workers';

let started = false;
export function startBackgroundJobs(): void {
  if (started) return; started = true;
  const enabled = String(process.env.RUN_BACKGROUND_JOBS ?? 'true').toLowerCase() !== 'false';
  if (!enabled) { logger.info('[runtime] RUN_BACKGROUND_JOBS=false — this instance serves HTTP only'); return; }
  startWhatsAppSendWorker();
  startWebhookWorker();
  startLeadFinderWorker();
  startVideoWorkers();
  startTokenRefreshScheduler();
  startInvoiceScheduler();
  startBackupScheduler();
  startKeepAliveScheduler();
  startRetentionScheduler();
  startGoogleReviewAutomationScheduler();
  logger.info('[runtime] Background workers and schedulers started');
  runPreflightOnBoot().catch((error: any) => logger.error('[preflight] Boot check failed (non-fatal):', error.message));
  runBootSelfCheck().catch((error: any) => logger.error('[self-check] Boot self-check failed (non-fatal):', error.message));
}
