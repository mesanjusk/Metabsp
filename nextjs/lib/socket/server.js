/**
 * Socket.IO server bootstrap.
 *
 * Deliberately plain CommonJS rather than TypeScript: it is required by
 * server.js, which runs before (and outside) Next's compilation, so it cannot
 * import from the TypeScript side.
 *
 * Route handlers never touch this. They publish through
 * lib/socket/emitter.ts, which writes to the same Redis channels this
 * server's adapter subscribes to — so an emit from a route handler reaches
 * connected clients without either side holding a reference to the other.
 *
 * The Redis connection is cached on the same `global` key lib/db/redis.ts
 * uses, so the socket server and the App Router share one connection rather
 * than opening a second.
 *
 * ── Tenant isolation ────────────────────────────────────────────────────────
 * Every connection MUST present the same JWT the REST API uses, and is placed
 * in a room named for its own user. Emits are addressed to a room, never
 * broadcast. Before this, the server accepted anonymous connections and
 * `emitNewMessage` fanned every message out to every socket — so any visitor
 * who opened a websocket received every tenant's WhatsApp traffic. Rooms and
 * handshake auth are what make this safe to run as a multi-tenant BSP.
 */

const { Server: SocketIOServer } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const IORedis = require('ioredis');
const jwt = require('jsonwebtoken');

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

// Mirrors lib/auth/jwt.ts:getJwtSecret. Duplicated rather than imported for
// the CommonJS reason in the header — keep the two in step.
function getJwtSecret() {
  return process.env.JWT_SECRET || process.env.ACCESS_TOKEN_SECRET || '';
}

// Same allow-list the HTTP layer applies (lib/http/cors.ts). A websocket
// upgrade is a cross-origin request like any other, and `origin: true` —
// which reflects whatever Origin the client sent — combined with
// `credentials: true` is exactly the configuration CORS exists to prevent.
function resolveAllowedOrigins() {
  return String(process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
    .split(',')
    .map((entry) => entry.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

let ioInstance = null;

function initSocket(server) {
  if (ioInstance) return ioInstance;

  const pubClient = getRedisConnection();
  const subClient = pubClient.duplicate();

  // duplicate() does not carry over pubClient's listeners, so without this the
  // adapter falls back to its own bare console.warn on every reconnect.
  subClient.on('error', throttledErrorLogger('[socket.io redis] Subscriber connection error:'));

  const allowedOrigins = resolveAllowedOrigins();

  ioInstance = new SocketIOServer(server, {
    cors: {
      origin: (origin, callback) => {
        // No Origin header at all: a native/server-side client, not a browser
        // page, so there is no cross-origin escalation to prevent.
        if (!origin) return callback(null, true);
        const normalized = origin.replace(/\/$/, '');
        if (allowedOrigins.includes(normalized)) return callback(null, true);
        // Same-origin is the normal case for the dashboard, which is served by
        // this very process; an unset allow-list must not break it.
        if (!allowedOrigins.length) return callback(null, true);
        return callback(new Error(`Socket.IO: origin '${origin}' not allowed`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    adapter: createAdapter(pubClient, subClient),
  });

  // Handshake auth. The client sends the same bearer token it uses for REST
  // (see lib/ui/hooks/useRealtimeMessages.js). A connection that cannot be
  // attributed to a user is refused rather than allowed in read-only —
  // there is nothing on this server a signed-out client may legitimately see.
  ioInstance.use((socket, nextMiddleware) => {
    const secret = getJwtSecret();
    if (!secret) return nextMiddleware(new Error('Server auth is not configured'));

    const token =
      socket.handshake.auth?.token ||
      String(socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return nextMiddleware(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, secret);
      if (!decoded?.id) return nextMiddleware(new Error('Authentication required'));
      socket.data.userId = String(decoded.id);
      return nextMiddleware();
    } catch {
      return nextMiddleware(new Error('Authentication required'));
    }
  });

  ioInstance.on('connection', (socket) => {
    const { userId } = socket.data;
    socket.join(userRoom(userId));

    // A user may hold several WhatsApp numbers; the client asks to follow the
    // one it is currently viewing. Membership is still bounded by the user
    // room above — this only narrows what arrives, it cannot widen it, because
    // every account emit is addressed to the owning user's room as well.
    socket.on('watch-account', (accountId) => {
      const room = accountRoom(accountId);
      if (room) socket.join(room);
    });
    socket.on('unwatch-account', (accountId) => {
      const room = accountRoom(accountId);
      if (room) socket.leave(room);
    });
  });

  console.log('[socket.io] Server attached (authenticated, room-scoped)');
  return ioInstance;
}

// Room naming is shared with lib/socket/emitter.ts — both sides must agree or
// events are published to a room nobody is in, which fails silently.
function userRoom(userId) {
  return userId ? `user:${userId}` : '';
}

function accountRoom(accountId) {
  return accountId ? `account:${String(accountId)}` : '';
}

module.exports = { initSocket, getRedisConnection, userRoom, accountRoom };
