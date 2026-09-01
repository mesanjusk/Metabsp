'use client';

import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { getStoredToken } from '@/lib/api/authStorage';

/**
 * Subscribes to live inbound/outbound messages for the signed-in user.
 *
 * Three things were wrong with the inline version this replaces, and each of
 * them is worth stating because none is obvious from the diff:
 *
 * 1. It read `import.meta.env.VITE_SOCKET_URL` — Vite syntax that webpack
 *    compiles to `(void 0).VITE_SOCKET_URL`. That throws a TypeError the
 *    moment the Chats chunk is evaluated, so the inbox — the screen an App
 *    Review walkthrough spends most of its time on — crashed on open.
 * 2. It connected anonymously. The server broadcast every message to every
 *    socket, so any visitor could open one and receive other businesses'
 *    WhatsApp traffic. The token below is what puts a connection in its own
 *    room (see lib/socket/server.js).
 * 3. It pinned `transports: ['polling']`, forcing long-polling forever and
 *    leaving a 5-second refetch loop to do the real work. The socket server
 *    is in this same process now, so a websocket upgrade just works.
 *
 * The API is served from the same origin as the app, so there is no URL to
 * configure at all: an empty string tells socket.io-client to use the page's
 * own origin, which is correct in every environment.
 */
export function useRealtimeMessages({ onMessage, onStatus, accountId } = {}) {
  useEffect(() => {
    const token = getStoredToken();
    if (!token) return undefined;

    const socket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    if (onMessage) socket.on('new_message', onMessage);
    if (onStatus) socket.on('message_status', onStatus);

    // Narrows the stream to one number when the dashboard is scoped to it.
    // Purely a filter — the server still confines every event to this user.
    if (accountId) {
      socket.on('connect', () => socket.emit('watch-account', accountId));
    }

    return () => {
      socket.disconnect();
    };
  }, [onMessage, onStatus, accountId]);
}

export default useRealtimeMessages;
