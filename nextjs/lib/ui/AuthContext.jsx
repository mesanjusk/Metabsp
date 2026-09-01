'use client';

// Ported from frontend/src/context/AuthContext.jsx.
//
// ── Why the session is read in an effect, not in useState ────────────────────
// The session lives in localStorage, which the server cannot see. Reading it
// in a useState initialiser meant the server rendered a signed-out shell while
// the first client render produced a signed-in one — a hydration mismatch, and
// React logged error #418 on every dashboard page load, discarding the
// server-rendered HTML and re-rendering from scratch.
//
// Reading it in a mount effect instead makes the first client render identical
// to the server's, and `isSessionLoading` marks the gap: it is true until
// storage has actually been read, so a route guard can wait rather than
// bouncing a signed-in user to the login page in the meantime.
//
// ── Who decides what role you have ──────────────────────────────────────────
// It used to be localStorage, written once at sign-in and trusted forever.
// That produced the bug where a newly created account could be shown the
// administration UI — any stale `User_group` left in the browser, from an
// earlier session or typed into devtools, was accepted as fact — and it meant
// `isAdmin` was a value the visitor controlled.
//
// The server decides now. `/api/users/me` re-reads the account and its role on
// every load, and `isAdmin` stays false until that answer arrives. The stored
// values survive only as a first-paint hint for the display name, never for
// authorisation. The API routes have always enforced this server-side
// (requireAdmin), so this closes the presentational half of the same gap.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import apiClient from '@/lib/api/client';
import { fetchWhatsAppAccount } from '@/lib/client/services/whatsappCloudService';
import {
  STORAGE_KEYS,
  clearStoredSession,
  getStoredToken,
  persistAuthState,
  pickFirst,
  setStoredToken,
} from '@/lib/api/authStorage';

const AuthContext = createContext(null);

const getInitialUser = () => ({
  userName: pickFirst([STORAGE_KEYS.userName]),
  userGroup: pickFirst([STORAGE_KEYS.userGroup]),
  mobileNumber: pickFirst([STORAGE_KEYS.mobileNumber]),
  whatsappProvider: pickFirst([STORAGE_KEYS.whatsappProvider]),
});

const getAccountPayload = (response) => {
  const data = response?.data?.data ?? response?.data ?? null;
  if (Array.isArray(data)) return data[0] || null;
  if (Array.isArray(data?.items)) return data.items[0] || null;
  if (data?.account) return data.account;
  return data;
};

export function AuthProvider({ children }) {
  // Empty on both sides of hydration; filled from storage in the effect below.
  const [token, setToken] = useState('');
  const [user, setUser] = useState({ userName: '', userGroup: '', mobileNumber: '', whatsappProvider: '' });
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [whatsappAccount, setWhatsappAccount] = useState(null);
  const [whatsappAccountStatus, setWhatsappAccountStatus] = useState('idle');
  const [isAccountLoading, setIsAccountLoading] = useState(false);

  // null = not yet answered by the server. Deliberately not seeded from
  // storage: "unknown" must never read as "admin", and a brief moment without
  // the Administration entry is the correct thing to show while we ask.
  const [verifiedGroup, setVerifiedGroup] = useState(null);
  const [isIdentityLoading, setIsIdentityLoading] = useState(false);

  const login = useCallback((nextToken, userData = {}) => {
    setStoredToken(nextToken || '');
    setToken(nextToken || '');

    const nextUser = {
      userName: userData.userName || '',
      userGroup: userData.userGroup || '',
      mobileNumber: userData.mobileNumber || '',
      whatsappProvider: userData.whatsappProvider || '',
    };

    persistAuthState(nextUser);
    setUser(nextUser);
    // Not setVerifiedGroup(userData.userGroup): the sign-in response is
    // trustworthy, but making the effect below the single place that grants a
    // role means there is exactly one code path to reason about, and no way to
    // acquire one without the server having just confirmed it.
    setVerifiedGroup(null);
  }, []);

  const refreshWhatsAppAccount = useCallback(async () => {
    if (!getStoredToken()) {
      setWhatsappAccount(null);
      setWhatsappAccountStatus('not_connected');
      setIsAccountLoading(false);
      return null;
    }

    setIsAccountLoading(true);
    try {
      const response = await fetchWhatsAppAccount();
      const account = getAccountPayload(response);
      setWhatsappAccount(account);
      setWhatsappAccountStatus(account?.status || (account ? 'connected' : 'not_connected'));
      return account;
    } catch (error) {
      const statusCode = error?.response?.status;
      if (statusCode === 404 || statusCode === 204) {
        setWhatsappAccount(null);
        setWhatsappAccountStatus('not_connected');
        return null;
      }
      setWhatsappAccount(null);
      setWhatsappAccountStatus('error');
      return null;
    } finally {
      setIsAccountLoading(false);
    }
  }, [user?.userGroup]);

  const logout = useCallback(() => {
    clearStoredSession();
    setToken('');
    setUser({ userName: '', userGroup: '', mobileNumber: '', whatsappProvider: '' });
    setWhatsappAccount(null);
    setWhatsappAccountStatus('idle');
    setIsAccountLoading(false);
    setVerifiedGroup(null);
  }, []);

  const updateWhatsappProvider = useCallback(async (provider) => {
    const response = await apiClient.put('/api/users/whatsapp-provider', { provider });
    const nextProvider = response?.data?.user?.Whatsapp_provider || provider;
    setUser((prev) => {
      const nextUser = { ...prev, whatsappProvider: nextProvider };
      persistAuthState(nextUser);
      return nextUser;
    });
    return nextProvider;
  }, []);

  useEffect(() => {
    if (token) {
      refreshWhatsAppAccount();
      return;
    }
    setWhatsappAccount(null);
    setWhatsappAccountStatus('idle');
    setIsAccountLoading(false);
  }, [refreshWhatsAppAccount, token]);

  // Restores the stored session once, on mount. Nothing renders a signed-in
  // view before this runs, which is what keeps the first client render
  // identical to the server's.
  useEffect(() => {
    setToken(getStoredToken());
    setUser(getInitialUser());
    setIsSessionLoading(false);
  }, []);

  /**
   * Establishes identity from the server on every load.
   *
   * Besides settling the role, this catches two things the old
   * trust-what-is-stored approach could not: an account deactivated since the
   * last sign-in, and a token that has expired. Both used to keep the
   * dashboard looking signed in until some unrelated request happened to fail.
   */
  useEffect(() => {
    if (isSessionLoading) return undefined;

    if (!token) {
      setVerifiedGroup(null);
      setIsIdentityLoading(false);
      return undefined;
    }

    let active = true;
    setIsIdentityLoading(true);

    apiClient
      .get('/api/users/me')
      .then((response) => {
        if (!active) return;
        const serverUser = response?.data?.user;
        if (!serverUser) return;

        setVerifiedGroup(String(serverUser.User_group || 'user').toLowerCase());

        // Reconcile the display fields too, so a name or number changed
        // elsewhere shows up without needing to sign out.
        setUser((prev) => {
          const next = {
            ...prev,
            userName: serverUser.User_name || prev.userName,
            userGroup: String(serverUser.User_group || '').toLowerCase(),
            mobileNumber: serverUser.Mobile_number || prev.mobileNumber,
            whatsappProvider: serverUser.Whatsapp_provider || prev.whatsappProvider,
          };
          persistAuthState(next);
          return next;
        });
      })
      .catch((error) => {
        if (!active) return;
        const status = error?.response?.status;
        // 401/403 means this session is genuinely over — clear it rather than
        // leaving a dashboard that looks usable and fails on every action.
        if (status === 401 || status === 403) {
          clearStoredSession();
          setToken('');
          setUser({ userName: '', userGroup: '', mobileNumber: '', whatsappProvider: '' });
        }
        // Anything else (offline, a 5xx) leaves the session alone. The role
        // simply stays unknown, which means no administration UI — the safe
        // direction to fail in.
        setVerifiedGroup(null);
      })
      .finally(() => {
        if (active) setIsIdentityLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isSessionLoading, token]);

  const value = useMemo(
    () => ({
      token,
      user,
      userName: user.userName,
      userGroup: user.userGroup,
      mobileNumber: user.mobileNumber,
      whatsappProvider: user.whatsappProvider || '',
      isAuthenticated: Boolean(token),
      isSessionLoading,
      // Only ever true once the server has said so. Unknown is not admin.
      isAdmin: verifiedGroup === 'admin',
      isIdentityLoading,
      whatsappAccount,
      whatsappAccountStatus,
      isAccountLoading,
      isAccountConnected:
        Boolean(whatsappAccount) &&
        !['disconnected', 'inactive', 'error', 'not_connected'].includes(
          String(whatsappAccount?.status || whatsappAccountStatus || '').toLowerCase(),
        ),
      accountConnectionMode:
        whatsappAccount?.connection_mode || whatsappAccount?.connectionMode || null,
      refreshWhatsAppAccount,
      login,
      logout,
      updateWhatsappProvider,
    }),
    [
      isAccountLoading,
      isIdentityLoading,
      isSessionLoading,
      login,
      logout,
      refreshWhatsAppAccount,
      token,
      updateWhatsappProvider,
      user,
      verifiedGroup,
      whatsappAccount,
      whatsappAccountStatus,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
