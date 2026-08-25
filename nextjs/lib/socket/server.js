/**
 * Socket.IO server bootstrap. Ported from backend/src/socket.js.
 *
 * Deliberately plain CommonJS rather than TypeScript: it is required by
 * server.js, which runs before (and outside) Next's compilation, so it cannot
 * import from the TypeScript side.
 *
 * Route handlers never touch this. They publish through
 * lib/socket/emitter.ts, which writes to the same Redis channels this
 * server's adapter subscribes to — so an emit from a route handler reaches
 * connected clients without either side holding a reference to the other.
 * That indirection is what let the app run split across two hosts, and it
 * keeps working unchanged now that both halves share one process.
 *
 * The Redis connection is cached on the same `global` key lib/db/redis.ts
 * uses, so the socket server and the App Router share one connection rather
 * than opening a second.
 */

const { Server: SocketIOServer } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const IORedis = require('ioredis');

const REDIS_GLOBAL_KEY = '__metabspRedisConnection';

function parseClusterNodes(raw) {
  return String(raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [host, port] = entry.split(':');
      return { host, port: Number(port) || 6379 };
    });
}

// ioredis reconnects forever, and an unreachable Redis emits an error per
// attempt. Logging each one buries everything else — the running production
// service already demonstrates this, where a hibernate-wake produces hundreds
// of identical lines. Log the first, then at most one a minute.
function throttledErrorLogger(prefix) {
  let lastLoggedAt = 0;
  let suppressed = 0;
  return (error) => {
    const now = Date.now();
    if (now - lastLoggedAt < 60000) {
      suppressed += 1;
      return;
    }
    const tail = suppressed ? ` (${suppressed} similar suppressed)` : '';
    console.error(`${prefix} ${error.message}${tail}`);
    lastLoggedAt = now;
    suppressed = 0;
  };
}

function getRedisConnection() {
  if (global[REDIS_GLOBAL_KEY]) return global[REDIS_GLOBAL_KEY];

  const clusterNodes = parseClusterNodes(process.env.REDIS_CLUSTER_NODES);
  const options = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    // Back off rather than hammering a down Redis every few milliseconds.
    retryStrategy: (attempt) => Math.min(attempt * 200, 5000),
  };

  const connection = clusterNodes.length
    ? new IORedis.Cluster(clusterNodes, { redisOptions: options })
    : new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', options);

  connection.on('error', throttledErrorLogger('[redis] Connection error:'));

  global[REDIS_GLOBAL_KEY] = connection;
  return connection;
}

let ioInstance = null;

function initSocket(server) {
  if (ioInstance) return ioInstance;

  const pubClient = getRedisConnection();
  const subClient = pubClient.duplicate();

  // duplicate() does not carry over pubClient's listeners, so without this the
  // adapter falls back to its own bare console.warn on every reconnect.
  subClient.on('error', throttledErrorLogger('[socket.io redis] Subscriber connection error:'));

  ioInstance = new SocketIOServer(server, {
    cors: { origin: true, methods: ['GET', 'POST'], credentials: true },
    adapter: createAdapter(pubClient, subClient),
  });

  ioInstance.on('connection', (socket) => {
    console.log(`[socket.io] Client connected: ${socket.id}`);
    socket.on('disconnect', (reason) => {
      console.log(`[socket.io] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log('[socket.io] Server attached');
  return ioInstance;
}

module.exports = { initSocket, getRedisConnection };
