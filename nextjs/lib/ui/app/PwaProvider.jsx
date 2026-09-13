'use client';

import { useCallback, useEffect, useState } from 'react';
import { Box, Button, IconButton, Paper, Slide, Stack, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InstallMobileRoundedIcon from '@mui/icons-material/InstallMobileRounded';

/**
 * Registers the service worker and offers the install prompt.
 *
 * Registration is what makes the app installable at all: Android and desktop Chrome both require a
 * controlling service worker plus a manifest before they will fire `beforeinstallprompt` or offer
 * "Install app". The Android package (a Trusted Web Activity over this origin) and the Windows
 * package are built on the same foundation, so this component is load-bearing for all three
 * distributions, not just the browser one.
 *
 * `beforeinstallprompt` fires once, and only when the browser has decided the app qualifies. The
 * event must be captured and re-dispatched later from a real user gesture — calling `prompt()` on a
 * stale event, or without a gesture, is rejected. That is why the event is held in state rather
 * than acted on immediately.
 */

const DISMISS_KEY = 'metabsp:install-dismissed';

/** Reading storage throws outright in a private window with site data blocked. */
function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* A preference not worth breaking the page over. */
  }
}

export default function PwaProvider() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return undefined;

    // Registered after load rather than during hydration: the registration request competes with
    // the app's own first paint otherwise, and nothing about it is urgent.
    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(
        (registration) => {
          // A worker sitting in `waiting` means a new deploy is on disk but the old one is still in
          // charge. Telling it to take over now avoids the classic "I refreshed and it's still the
          // old version" report, which on a dashboard behind a service worker can persist for days.
          if (registration.waiting) registration.waiting.postMessage('skip-waiting');
          registration.addEventListener('updatefound', () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                installing.postMessage('skip-waiting');
              }
            });
          });
        },
        () => {
          /* An unregistered worker costs installability and offline, never correctness. */
        },
      );
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => window.removeEventListener('load', register);
  }, []);

  useEffect(() => {
    const onPrompt = (event) => {
      // Chrome shows its own mini-infobar unless the event is cancelled, and two install prompts on
      // one screen is worse than either alone.
      event.preventDefault();
      setDeferredPrompt(event);
      if (!readDismissed()) setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    setVisible(false);
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => null);
    // The event is single-use whatever the answer was.
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setVisible(false);
    writeDismissed();
  }, []);

  if (!visible) return null;

  return (
    <Slide in direction="up">
      <Paper
        elevation={8}
        role="dialog"
        aria-label="Install SanjuSK"
        sx={{
          position: 'fixed',
          zIndex: (theme) => theme.zIndex.snackbar,
          left: 16,
          right: 16,
          // Clears both the mobile tab bar and the phone's own gesture inset.
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)',
          mx: 'auto',
          maxWidth: 420,
          p: 2,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              flexShrink: 0,
            }}
          >
            <InstallMobileRoundedIcon fontSize="small" />
          </Box>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle2" noWrap>
              Install SanjuSK
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Full screen, on your home screen, opens offline.
            </Typography>
          </Box>

          <Button variant="contained" size="small" onClick={install} sx={{ flexShrink: 0 }}>
            Install
          </Button>
          <IconButton size="small" onClick={dismiss} aria-label="Not now" sx={{ flexShrink: 0 }}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Paper>
    </Slide>
  );
}
