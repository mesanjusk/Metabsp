const IORedis = require('ioredis');
const logger = require('../utils/logger');

let connection = null;

const parseClusterNodes = (raw) =>
  String(raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [host, port] = entry.split(':');
      return { host, port: Number(port) || 6379 };
    });

// BullMQ requires maxRetriesPerRequest: null on the connection it's given
// (it manages its own retry/backoff for blocking commands) — a shared
// singleton so queues/workers don't each open their own connection pool.
//
// Set REDIS_CLUSTER_NODES (comma-separated host:port list) to run against a
// Redis Cluster instead of a single instance — everything else (BullMQ, the
// rate limiter, the Socket.IO adapter) consumes whatever this returns
// without caring which mode it's in. Single-instance via REDIS_URL remains
// the default, unchanged behavior when REDIS_CLUSTER_NODES isn't set.
function getRedisConnection() {
  if (connection) return connection;

  const clusterNodes = parseClusterNodes(process.env.REDIS_CLUSTER_NODES);

  if (clusterNodes.length) {
    connection = new IORedis.Cluster(clusterNodes, {
      redisOptions: {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
      },
    });
  } else {
    const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    connection = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }

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

module.exports = { getRedisConnection, closeRedisConnection, parseClusterNodes };
