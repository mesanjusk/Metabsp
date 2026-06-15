import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchWhatsAppAccount } from '../services/whatsappCloudService';
import {
  STORAGE_KEYS,
  clearStoredSession,
  getStoredToken,
  persistAuthState,
  pickFirst,
  setStoredToken,
} from '../utils/authStorage';

const AuthContext = createContext(null);

const getInitialUser = () => ({
  userName: pickFirst([STORAGE_KEYS.userName]),
  userGroup: pickFirst([STORAGE_KEYS.userGroup]),
  mobileNumber: pickFirst([STORAGE_KEYS.mobileNumber]),
});

const getAccountPayload = (response) => {
  const data = response?.data?.data ?? response?.data ?? null;
  if (Array.isArray(data)) return data[0] || null;
  if (Array.isArray(data?.items)) return data.items[0] || null;
  if (data?.account) return data.account;
  return data;
};

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken());
  const [user, setUser] = useState(getInitialUser);
  const [whatsappAccount, setWhatsappAccount] = useState(null);
  const [whatsappAccountStatus, setWhatsappAccountStatus] = useState('idle');
  const [isAccountLoading, setIsAccountLoading] = useState(false);

  const login = useCallback((nextToken, userData = {}) => {
    setStoredToken(nextToken || '');
    setToken(nextToken || '');

    const nextUser = {
      userName: userData.userName || '',
      userGroup: userData.userGroup || '',
      mobileNumber: userData.mobileNumber || '',
    };

    persistAuthState(nextUser);
    setUser(nextUser);
  }, [user?.userGroup]);

  const refreshWhatsAppAccount = useCallback(async () => {
    if (!getStoredToken()) {
      setWhatsappAccount(null);
      setWhatsappAccountStatus('not_connected');
      setIsAccountLoading(false);
      return null;
    }

    if (String(user?.userGroup || '').toLowerCase() === 'admin') {
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
    setUser({ userName: '', userGroup: '', mobileNumber: '' });
    setWhatsappAccount(null);
    setWhatsappAccountStatus('idle');
    setIsAccountLoading(false);
  }, [user?.userGroup]);

  useEffect(() => {
    if (token) {
      refreshWhatsAppAccount();
      return;
    }
    setWhatsappAccount(null);
    setWhatsappAccountStatus('idle');
    setIsAccountLoading(false);
  }, [refreshWhatsAppAccount, token]);

  const value = useMemo(
    () => ({
      token,
      user,
      userName: user.userName,
      userGroup: user.userGroup,
      mobileNumber: user.mobileNumber,
      isAuthenticated: Boolean(token),
      isAdmin: String(user.userGroup || '').toLowerCase() === 'admin',
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
    }),
    [
      isAccountLoading,
      login,
      logout,
      refreshWhatsAppAccount,
      token,
      user,
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
