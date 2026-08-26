import axios from 'axios';
import { getStoredToken } from './authStorage';

/**
 * Ported from frontend/src/apiClient.js.
 *
 * The Vite client had to pick between VITE_API_LOCAL and VITE_API_SERVER by
 * sniffing window.location.hostname at module scope — the SPA was served from
 * a different origin than the API, so it needed an absolute base URL, and
 * choosing it required knowing where the browser was.
 *
 * That whole problem disappears here: this app serves the API routes itself,
 * from the same origin. An empty baseURL means every request is relative, which
 * is also what makes the module safe to import during server rendering — the
 * old version dereferenced `window` at import time and would have thrown.
 *
 * NEXT_PUBLIC_API_BASE_URL exists only as an escape hatch for pointing the UI
 * at a different backend (say, the Express host during the migration). Leave it
 * unset in normal operation.
 */
const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || '';

const client = axios.create({ baseURL });

client.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` } as any;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default client;
export const getApiBase = () => baseURL;
