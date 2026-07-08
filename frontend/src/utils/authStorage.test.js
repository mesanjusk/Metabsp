import { describe, it, expect, beforeEach } from 'vitest';
import {
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  persistAuthState,
  clearStoredSession,
  STORAGE_KEYS,
} from './authStorage';

describe('authStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('setStoredToken writes only the canonical "token" key and clears legacy aliases', () => {
    localStorage.setItem('authToken', 'stale-legacy-value');
    setStoredToken('fresh-token');

    expect(localStorage.getItem('token')).toBe('fresh-token');
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(getStoredToken()).toBe('fresh-token');
  });

  it('getStoredToken falls back to legacy keys when "token" is absent', () => {
    localStorage.setItem('access_token', 'legacy-value');
    expect(getStoredToken()).toBe('legacy-value');
  });

  it('clearStoredToken removes every known token key', () => {
    setStoredToken('some-token');
    clearStoredToken();
    expect(getStoredToken()).toBe('');
  });

  it('persistAuthState writes role under all four legacy-compatible keys', () => {
    persistAuthState({ userName: 'alice', userGroup: 'ADMIN', mobileNumber: '9999999999' });

    expect(localStorage.getItem(STORAGE_KEYS.userGroup)).toBe('ADMIN');
    expect(localStorage.getItem(STORAGE_KEYS.role)).toBe('ADMIN');
    expect(localStorage.getItem(STORAGE_KEYS.roleFallback)).toBe('ADMIN');
    expect(localStorage.getItem(STORAGE_KEYS.userRoleLegacy)).toBe('ADMIN');
    expect(localStorage.getItem(STORAGE_KEYS.mobileNumber)).toBe('9999999999');
  });

  it('persistAuthState clears fields that are omitted on a subsequent call', () => {
    persistAuthState({ userName: 'alice', userGroup: 'ADMIN' });
    persistAuthState({ userName: 'alice' });

    expect(localStorage.getItem(STORAGE_KEYS.userGroup)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.role)).toBeNull();
  });

  it('clearStoredSession removes both session state and the token', () => {
    setStoredToken('some-token');
    persistAuthState({ userName: 'alice', userGroup: 'ADMIN' });

    clearStoredSession();

    expect(getStoredToken()).toBe('');
    expect(localStorage.getItem(STORAGE_KEYS.userName)).toBeNull();
  });
});
