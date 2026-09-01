import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * The bug these cover: `emitNewMessage` used to call `emit()` on a bare
 * emitter, which Socket.IO broadcasts to EVERY connected socket. Combined with
 * a socket server that accepted anonymous connections, any visitor who opened
 * a websocket received every tenant's WhatsApp messages. Room addressing is
 * the fix, so these assert the addressing itself — not just that an emit
 * happened.
 */
const emit = vi.fn();
const to = vi.fn(() => ({ emit }));

vi.mock('@socket.io/redis-emitter', () => ({
  Emitter: class {
    to = to;
    emit = emit;
  },
}));

vi.mock('@/lib/db/redis', () => ({ getRedisConnection: () => ({}) }));

const { emitNewMessage, emitMessageStatus } = await import('@/lib/socket/emitter');

describe('socket emitter — tenant addressing', () => {
  beforeEach(() => {
    emit.mockClear();
    to.mockClear();
  });

  it('addresses a new message to its owning user and account, never globally', () => {
    emitNewMessage({ userId: 'user-1', whatsappAccountId: 'acct-9', body: 'hi' });

    expect(to).toHaveBeenCalledWith(['user:user-1', 'account:acct-9']);
    expect(emit).toHaveBeenCalledWith('new_message', expect.objectContaining({ body: 'hi' }));
  });

  it('still addresses a room when only the owning user is known', () => {
    emitNewMessage({ userId: 'user-1', body: 'hi' });
    expect(to).toHaveBeenCalledWith(['user:user-1']);
  });

  it('DROPS a message with no resolvable owner rather than broadcasting it', () => {
    // An inbound webhook for a number nobody has connected produces exactly
    // this. Broadcasting it would deliver a stranger's message to every
    // connected client, so silence is the only safe outcome.
    emitNewMessage({ body: 'unattributable' });

    expect(to).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('applies the same rule to delivery-status events', () => {
    emitMessageStatus({ userId: 'user-2', whatsappAccountId: 'acct-3', status: 'delivered' });
    expect(to).toHaveBeenCalledWith(['user:user-2', 'account:acct-3']);

    to.mockClear();
    emitMessageStatus({ status: 'read' });
    expect(to).not.toHaveBeenCalled();
  });
});
