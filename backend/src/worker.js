/**
 * Standalone worker process entrypoint for the broadcast send queue.
 *
 * By default (see index.js) the worker runs in-process with the API
 * server — fine at low-to-moderate scale. Once send volume needs to scale
 * independently of API request capacity (or an API crash shouldn't also
 * kill in-flight sends), run this as its own process/deployment instead:
 *
 *   node src/worker.js        (or: npm run worker --workspace=backend)
 *
 * and stop calling startWhatsAppSendWorker() from index.js. Both processes
 * talk to the same Mongo/Redis, so this is a deployment-topology change,
 * not a code change to the queue/worker contract itself.
 */
require('dotenv').config();
const logger = require('./utils/logger');
const connectDB = require('./config/mongo');
const { startWhatsAppSendWorker } = require('./queues/whatsappSendWorker');
const { closeRedisConnection } = require('./config/redis');

async function main() {
  await connectDB();

  const worker = startWhatsAppSendWorker();
  logger.info('[worker] WhatsApp send worker started as a standalone process');

  const shutdown = async (signal) => {
    logger.info(`[worker] ${signal} received — shutting down gracefully`);
    await worker.close();
    await closeRedisConnection();
    const mongoose = require('mongoose');
    await mongoose.connection.close(false);
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  logger.error('[worker] Failed to start:', error.message);
  process.exit(1);
});
