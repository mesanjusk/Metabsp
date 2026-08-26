// Ported from frontend/src/utils/authStorage.js.
//
// Every function guards on `typeof window` because these modules are imported
// by components that Next renders on the server first, where localStorage does
// not exist. In the Vite app that could never happen.

const TOKEN_KEYS = ['token', 'authToken', 'access_token', 'ACCESS_TOKEN'];

export const STORAGE_KEYS = {
  userName: 'User_name',
  userGroup: 'User_group',
  mobileNumber: 'Mobile_number',
  whatsappProvider: 'Whatsapp_provider',
  role: 'Role',
  roleFallback: 'role',
  userRoleLegacy: 'User_role',
};

const hasWindow = () => typeof window !== 'undefined';

// Reading site data throws outright in some contexts (private windows with
// storage blocked, embedded previews), so every access is wrapped rather than
// only checked for existence.
const safeGet = (key: string): string | null => {
  if (!hasWindow()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (key: string, value: string) => {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — the session simply does not persist */
  }
};

const safeRemove = (key: string) => {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* as above */
  }
};

export function getStoredToken(): string {
  return TOKEN_KEYS.map(safeGet).find(Boolean) || '';
}

export function setStoredToken(token: string) {
  TOKEN_KEYS.forEach((key) => {
    if (key === 'token') safeSet(key, token);
    else safeRemove(key);
  });
}

export function clearStoredToken() {
  TOKEN_KEYS.forEach(safeRemove);
}

export function pickFirst(keys: string[]): string {
  return keys.map(safeGet).find(Boolean) || '';
}

export function persistAuthState(nextState: Record<string, string> = {}) {
  const { userName = '', userGroup = '', mobileNumber = '', whatsappProvider = '' } = nextState;

  if (userName) safeSet(STORAGE_KEYS.userName, userName);
  else safeRemove(STORAGE_KEYS.userName);

  if (userGroup) {
    for (const key of [STORAGE_KEYS.userGroup, STORAGE_KEYS.role, STORAGE_KEYS.roleFallback, STORAGE_KEYS.userRoleLegacy]) {
      safeSet(key, userGroup);
    }
  } else {
    for (const key of [STORAGE_KEYS.userGroup, STORAGE_KEYS.role, STORAGE_KEYS.roleFallback, STORAGE_KEYS.userRoleLegacy]) {
      safeRemove(key);
    }
  }

  if (mobileNumber) safeSet(STORAGE_KEYS.mobileNumber, mobileNumber);
  else safeRemove(STORAGE_KEYS.mobileNumber);

  if (whatsappProvider) safeSet(STORAGE_KEYS.whatsappProvider, whatsappProvider);
  else safeRemove(STORAGE_KEYS.whatsappProvider);
}

export function clearStoredSession() {
  Object.values(STORAGE_KEYS).forEach(safeRemove);
  clearStoredToken();
}
