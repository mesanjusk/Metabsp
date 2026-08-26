import { io } from 'socket.io-client';

// This module is still consumed by both the legacy Vite frontend and parts of
// the Next.js migration. Reading `import.meta.env.VITE_SOCKET_URL` directly is
// safe in Vite, but crashes when webpack/Next compiles the module because
// `import.meta.env` can be undefined. Resolve both build systems defensively.
const viteSocketUrl =
  typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_SOCKET_URL
    : undefined;

const nextSocketUrl =
  typeof process !== 'undefined' && process.env
    ? process.env.NEXT_PUBLIC_SOCKET_URL
    : undefined;

// Keep the current production Express backend as the compatibility fallback
// while the Next.js migration runs alongside it. Set VITE_SOCKET_URL on the
// legacy frontend or NEXT_PUBLIC_SOCKET_URL on Next.js to override this.
const SOCKET_URL = viteSocketUrl || nextSocketUrl || 'https://bulk-invite.onrender.com';

// autoConnect is off — LiveContext connects this socket once a user is
// authenticated. Without this, the socket tried (and, on a cold/sleeping
// Render backend, failed) to open a websocket on every page load, including
// the public login/signup/forgot-password screens that never read from it.
export const socket = io(SOCKET_URL, { autoConnect: false, transports: ['websocket', 'polling'] });
