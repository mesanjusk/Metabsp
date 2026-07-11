const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { getRedisConnection } = require("./config/redis");
const logger = require('./utils/logger');

let ioInstance = null;

// Horizontal scaling: without this, each backend instance keeps its own
// in-memory socket registry, so `ioInstance.emit(...)` on one instance never
// reaches a client connected to another — real-time chat updates would
// silently miss roughly (N-1)/N of connected clients across N instances.
// The Redis pub/sub adapter makes every instance broadcast through the same
// shared Redis, so emits reach every connected client regardless of which
// instance they landed on. Uses the same Redis the app already requires
// (BullMQ/rate-limiter) — no new infra dependency, just a second connection
// (pub/sub requires a dedicated subscriber connection; the shared singleton
// stays free for the rest of the app's normal commands).
const initSocket = (server) => {
  const pubClient = getRedisConnection();
  const subClient = pubClient.duplicate();
  // duplicate() doesn't carry over pubClient's listeners, so without this
  // the adapter falls back to its own bare console.warn("missing 'error'
  // handler on this Redis client") on every reconnect attempt instead of
  // our structured logger.
  subClient.on('error', (error) => logger.error('[socket.io redis] Subscriber connection error:', error.message));

  ioInstance = new Server(server, {
    cors: {
      origin: true,
      methods: ["GET", "POST"],
      credentials: true,
    },
    adapter: createAdapter(pubClient, subClient),
  });

  ioInstance.on("connection", (socket) => {
    logger.info(`[socket.io] Client connected: ${socket.id}`);

    socket.on("disconnect", (reason) => {
      logger.info(`[socket.io] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  return ioInstance;
};

const emitNewMessage = (message) => {
  if (!ioInstance) {
    logger.warn(
      "[socket.io] Cannot emit new_message because Socket.IO is not initialized yet"
    );
    return;
  }

  logger.info("[socket.io] Emitting new_message event");
  ioInstance.emit("new_message", message);
};

module.exports = {
  initSocket,
  emitNewMessage,
};
