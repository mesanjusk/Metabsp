import { Emitter } from '@socket.io/redis-emitter';
import { getRedisConnection } from '../db/redis';
import logger from '../utils/logger';

// The Socket.IO server (lib/socket/server.js, attached in server.js) uses
// @socket.io/redis-adapter over the shared Redis connection, so its emits
// reach every connected client regardless of which replica produced them.
// Route handlers and the queue worker publish through this emitter, which
// writes to the SAME Redis channels the adapter subscribes to, in the
// adapter's wire format — no Socket.IO server instance needed here. That
// indirection is what lets any process in the deployment notify clients.
let emitter: Emitter | null = null;

function getEmitter(): Emitter {
  if (!emitter) {
    emitter = new Emitter(getRedisConnection() as any);
  }
  return emitter;
}

// Room naming is shared with lib/socket/server.js — both sides must agree or
// events land in a room nobody is in, which fails silently.
const userRoom = (userId: unknown) => (userId ? `user:${String(userId)}` : '');
const accountRoom = (accountId: unknown) => (accountId ? `account:${String(accountId)}` : '');

/**
 * Publishes a saved message to the rooms entitled to see it.
 *
 * This used to be a bare `emit('new_message', message)`, which Socket.IO
 * broadcasts to every connected socket — every tenant received every other
 * tenant's WhatsApp traffic. Addressing the owning user's room (and the
 * account room, for a client watching one specific number) is what confines
 * a message to the business it belongs to. A message with no resolvable
 * owner is dropped rather than broadcast: an un-addressable event is a bug,
 * and the safe failure is silence, not a leak.
 */
export function emitNewMessage(message: any): void {
  const rooms = [userRoom(message?.userId), accountRoom(message?.whatsappAccountId)].filter(Boolean);

  if (!rooms.length) {
    logger.warn('[socket-emitter] Dropping new_message with no owning user or account — refusing to broadcast');
    return;
  }

  try {
    getEmitter().to(rooms).emit('new_message', message);
  } catch (error: any) {
    logger.warn('[socket-emitter] Failed to emit new_message:', error.message);
  }
}

/**
 * Delivery/read receipts and other per-message status transitions. Same
 * room-addressing rule as above.
 */
export function emitMessageStatus(payload: any): void {
  const rooms = [userRoom(payload?.userId), accountRoom(payload?.whatsappAccountId)].filter(Boolean);
  if (!rooms.length) return;

  try {
    getEmitter().to(rooms).emit('message_status', payload);
  } catch (error: any) {
    logger.warn('[socket-emitter] Failed to emit message_status:', error.message);
  }
}
