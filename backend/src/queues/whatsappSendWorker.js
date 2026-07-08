const { Worker } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const { loadAccountContextById } = require('../services/whatsappAccountService');
const { dispatchTextMessage, dispatchTemplateMessage } = require('../controllers/whatsappController');
const logger = require('../utils/logger');
const { QUEUE_NAME } = require('./whatsappSendQueue');

async function processSendJob(job) {
  const { accountId, userId, to, messageType, body, templateName, language, components, campaignId } = job.data;

  const accountContext = await loadAccountContextById(accountId);

  if (String(messageType).toLowerCase() === 'template') {
    return dispatchTemplateMessage({ accountContext, userId, to, templateName, language, components, campaignId });
  }
  return dispatchTextMessage({ accountContext, userId, to, body, campaignId });
}

// Concurrency is intentionally modest (default 5) — Meta enforces per-number
// messaging rate limits, and BullMQ's own retry/backoff already handles
// transient failures without needing every recipient sent in parallel.
function startWhatsAppSendWorker({ concurrency = 5 } = {}) {
  const worker = new Worker(QUEUE_NAME, processSendJob, {
    connection: getRedisConnection(),
    concurrency,
  });

  worker.on('failed', (job, error) => {
    logger.warn(
      `[whatsapp-send-worker] Job ${job?.id} (recipient ${job?.data?.to}) failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}):`,
      error.message
    );
  });

  worker.on('error', (error) => {
    logger.error('[whatsapp-send-worker] Worker error:', error.message);
  });

  return worker;
}

module.exports = { startWhatsAppSendWorker, processSendJob };
