const IORedis = require('ioredis');
const logger = require('../utils/logger');

let connection = null;

// BullMQ requires maxRetriesPerRequest: null on the connection it's given
// (it manages its own retry/backoff for blocking commands) — a shared
// singleton so queues/workers don't each open their own connection pool.
function getRedisConnection() {
  if (connection) return connection;

  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  connection = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  connection.on('error', (error) => {
    logger.error('[redis] Connection error:', error.message);
  });

  return connection;
}

async function closeRedisConnection() {
  if (!connection) return;
  await connection.quit();
  connection = null;
}

module.exports = { getRedisConnection, closeRedisConnection };
