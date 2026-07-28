import IORedis, { Cluster } from 'ioredis';
import logger from '../utils/logger';

// Ported from backend/src/config/redis.js — same singleton pattern, cached
// on `global` for the same HMR/cold-start-reuse reason as lib/db/mongo.ts.
// This Redis instance MUST be the same one the always-on backend/ host uses
// (same REDIS_URL) — it's how the BullMQ producer here and the unchanged
// BullMQ Worker there share the same queue, and how any Socket.IO emits
// from here (see lib/socket/emitter.ts) reach the always-on host's
// Socket.IO server via its Redis adapter.
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
