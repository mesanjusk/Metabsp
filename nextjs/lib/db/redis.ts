import IORedis, { Cluster } from 'ioredis';
import logger from '../utils/logger';

// Ported from backend/src/config/redis.js — same singleton pattern, cached
// on `global` for the same HMR/cold-start-reuse reason as lib/db/mongo.ts.
//
// Redis carries the BullMQ send queue (producer in route handlers, consumer in
// the worker started from instrumentation.ts) and the per-tick leader lock the
// schedulers take. Both halves now live in this one process, so this is the
// only Redis client the app opens.
declare global {
  // eslint-disable-next-line no-var
  var __metabspRedisConnection: IORedis | Cluster | undefined;
}

const parseClusterNodes = (raw: string | undefined) =>
  String(raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [host, port] = entry.split(':');
      return { host, port: Number(port) || 6379 };
    });

export function getRedisConnection(): IORedis | Cluster {
  if (global.__metabspRedisConnection) return global.__metabspRedisConnection;

  const clusterNodes = parseClusterNodes(process.env.REDIS_CLUSTER_NODES);

  let connection: IORedis | Cluster;
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

  connection.on('error', (error: Error) => {
    logger.error('[redis] Connection error:', error.message);
  });

  global.__metabspRedisConnection = connection;
  return connection;
}
