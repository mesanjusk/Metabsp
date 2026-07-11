import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://bkbackend-zr8f.onrender.com';

// autoConnect is off — LiveContext connects this socket once a user is
// authenticated. Without this, the socket tried (and, on a cold/sleeping
// Render backend, failed) to open a websocket on every page load, including
// the public login/signup/forgot-password screens that never read from it.
export const socket = io(SOCKET_URL, { autoConnect: false, transports: ['websocket', 'polling'] });
