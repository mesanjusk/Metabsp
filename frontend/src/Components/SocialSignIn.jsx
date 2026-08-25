import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Divider, Stack, Typography } from '@mui/material';
import apiClient from '../apiClient';
import { loadFacebookSdk } from '../utils/facebookSdk';

// Google / Facebook sign-in buttons.
//
// Additive to password login: this component renders nothing at all unless the
// server reports a provider as configured, so a deployment without
// GOOGLE_CLIENT_ID simply keeps the login page it has today.
//
// The browser never sends a profile — only the opaque credential the provider
// issues. Everything about who that credential belongs to is decided
// server-side in backend/src/services/socialAuthService.js.

const GOOGLE_SDK_ID = 'google-identity-services';

const loadGoogleSdk = () =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Google sign-in needs a browser'));
    if (window.google?.accounts?.id) return resolve(window.google);

    const existing = document.getElementById(GOOGLE_SDK_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google), { once: true });
      existing.addEventListener('error', () => reject(new Error('Could not load Google sign-in')), { once: true });
      return undefined;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_SDK_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.body.appendChild(script);
    return undefined;
  });

export default function SocialSignIn({ onSuccess, disabled = false }) {
  const [providers, setProviders] = useState({ google: { enabled: false }, facebook: { enabled: false } });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const googleButtonRef = useRef(null);

  useEffect(() => {
    let active = true;
    apiClient
      .get('/api/users/auth/providers')
      .then((res) => {
        if (!active) return;
        setProviders(res?.data?.data || {});
      })
      // A deployment that predates this endpoint simply shows no social
      // buttons — never a broken login page.
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const exchange = useCallback(
    async (path, payload, provider) => {
      setBusy(provider);
      setError('');
      try {
        const res = await apiClient.post(path, payload);
        const data = res?.data || {};
        if (!data.success || !data.token) throw new Error(data.message || 'Sign-in failed');
        onSuccess(data);
      } catch (err) {
        setError(err?.response?.data?.message || err.message || 'Sign-in failed');
      } finally {
        setBusy('');
      }
    },
    [onSuccess]
  );

  // Google Identity Services renders its own button and hands back an ID token
  // through this callback.
  useEffect(() => {
    const clientId = providers?.google?.clientId;
    if (!providers?.google?.enabled || !clientId || !googleButtonRef.current) return;

    let cancelled = false;
    loadGoogleSdk()
      .then((google) => {
        if (cancelled || !googleButtonRef.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: ({ credential }) => {
            if (credential) exchange('/api/users/auth/google', { credential }, 'google');
          },
        });
        google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
        });
      })
      .catch(() => setError('Could not load Google sign-in.'));

    return () => {
      cancelled = true;
    };
  }, [providers, exchange]);

  const handleFacebook = useCallback(async () => {
    setError('');
    try {
      await loadFacebookSdk({ appId: providers.facebook.appId });
      // Scopes come from the server: requesting one the Meta app does not have
      // fails the whole dialog with "Invalid Scopes", so the browser must not
      // hardcode them. See backend/src/services/socialAuthService.js.
      const result = await new Promise((resolve) =>
        window.FB.login(resolve, { scope: providers.facebook.scopes || 'public_profile' })
      );
      const accessToken = result?.authResponse?.accessToken;
      if (!accessToken) {
        setError('Facebook sign-in was cancelled.');
        return;
      }
      await exchange('/api/users/auth/facebook', { accessToken }, 'facebook');
    } catch (err) {
      setError(err.message || 'Could not start Facebook sign-in.');
    }
  }, [providers, exchange]);

  if (!providers?.google?.enabled && !providers?.facebook?.enabled) return null;

  return (
    <Stack spacing={1.5}>
      <Divider>
        <Typography variant="caption" color="text.secondary">or continue with</Typography>
      </Divider>

      {error && <Alert severity="error">{error}</Alert>}

      {providers?.google?.enabled && (
        <Stack alignItems="center">
          <div ref={googleButtonRef} />
        </Stack>
      )}

      {providers?.facebook?.enabled && (
        <Button
          variant="outlined"
          size="large"
          fullWidth
          onClick={handleFacebook}
          disabled={disabled || Boolean(busy)}
        >
          {busy === 'facebook' ? 'Signing in...' : 'Continue with Facebook'}
        </Button>
      )}
    </Stack>
  );
}
