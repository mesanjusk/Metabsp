import { Emitter } from '@socket.io/redis-emitter';
import { getRedisConnection } from '../db/redis';
import logger from '../utils/logger';

// The always-on host's Socket.IO server (backend/src/socket.js) uses
// @socket.io/redis-adapter over the shared Redis connection so its emits
// reach every connected client regardless of which backend instance
// produced them (see docs/NEXTJS_MIGRATION_AUDIT_AND_PLAN.md §0/§2.2 —
// Socket.IO itself stays on that always-on host, it cannot run in a Vercel
// function). This Next.js app has no Socket.IO server of its own, but it
// still needs to notify connected clients when it saves a new message (the
// webhook handler, message-send routes, etc.) — @socket.io/redis-emitter is
// the official lightweight client for exactly that: it publishes to the
// SAME Redis channels the redis-adapter subscribes to, in the adapter's
// wire format, without needing a full Socket.IO server instance here.
let emitter: Emitter | null = null;

function getEmitter(): Emitter {
  if (!emitter) {
    emitter = new Emitter(getRedisConnection() as any);
  }
  return emitter;
}

// Mirrors backend/src/socket.js's emitNewMessage — same event name
// ('new_message') and payload shape, so the always-on host's connected
// clients see identical events regardless of which app (Express or
// Next.js) produced the message.
export function emitNewMessage(message: unknown): void {
  try {
    getEmitter().emit('new_message', message);
  } catch (error: any) {
    logger.warn('[socket-emitter] Failed to emit new_message:', error.message);
  }
}
