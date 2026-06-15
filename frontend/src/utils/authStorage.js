const TOKEN_KEYS = ["token", "authToken", "access_token", "ACCESS_TOKEN"];

export const STORAGE_KEYS = {
  userName: "User_name",
  userGroup: "User_group",
  mobileNumber: "Mobile_number",
  role: "Role",
  roleFallback: "role",
  userRoleLegacy: "User_role",
};

export function getStoredToken() {
  return TOKEN_KEYS.map((key) => localStorage.getItem(key)).find(Boolean) || "";
}

export function setStoredToken(token) {
  TOKEN_KEYS.forEach((key) => {
    if (key === "token") localStorage.setItem(key, token);
    else localStorage.removeItem(key);
  });
}

export function clearStoredToken() {
  TOKEN_KEYS.forEach((key) => localStorage.removeItem(key));
}

export function pickFirst(keys) {
  return keys.map((key) => localStorage.getItem(key)).find(Boolean) || "";
}

export function persistAuthState(nextState = {}) {
  const { userName = "", userGroup = "", mobileNumber = "" } = nextState;

  if (userName) localStorage.setItem(STORAGE_KEYS.userName, userName);
  else localStorage.removeItem(STORAGE_KEYS.userName);

  if (userGroup) {
    localStorage.setItem(STORAGE_KEYS.userGroup, userGroup);
    localStorage.setItem(STORAGE_KEYS.role, userGroup);
    localStorage.setItem(STORAGE_KEYS.roleFallback, userGroup);
    localStorage.setItem(STORAGE_KEYS.userRoleLegacy, userGroup);
  } else {
    localStorage.removeItem(STORAGE_KEYS.userGroup);
    localStorage.removeItem(STORAGE_KEYS.role);
    localStorage.removeItem(STORAGE_KEYS.roleFallback);
    localStorage.removeItem(STORAGE_KEYS.userRoleLegacy);
  }

  if (mobileNumber) localStorage.setItem(STORAGE_KEYS.mobileNumber, mobileNumber);
  else localStorage.removeItem(STORAGE_KEYS.mobileNumber);
}

export function clearStoredSession() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  clearStoredToken();
}
