'use client';

import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import DialpadRoundedIcon from '@mui/icons-material/DialpadRounded';

/**
 * Shown in place of a section that cannot work until a WhatsApp number is
 * connected.
 *
 * One clear explanation with the real Embedded Signup button, instead of each
 * panel discovering the missing account on its own and failing differently —
 * an empty list here, a toast there, an unexplained error somewhere else. It
 * matters beyond tidiness: connecting a number through Meta's popup is the
 * flow App Review assesses, and it should be reachable from wherever a person
 * first notices they need it.
 */
export default function ConnectGate({ sectionLabel, onConnect, onConnectManually, isBusy }) {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', height: '100%', p: 3 }}>
      <Paper variant="outlined" sx={{ maxWidth: 520, width: '100%', p: 4, textAlign: 'center' }}>
        <Stack spacing={2.5} alignItems="center">
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 3,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'action.selected',
              color: 'primary.main',
            }}
          >
            <DialpadRoundedIcon />
          </Box>

          <Stack spacing={1}>
            <Typography variant="h5">Connect a WhatsApp number</Typography>
            <Typography variant="body2" color="text.secondary">
              {sectionLabel} needs a WhatsApp Business number connected through Meta. Connecting takes a
              couple of minutes and happens in a Meta-hosted window — your credentials are never entered
              here.
            </Typography>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ width: '100%' }} justifyContent="center">
            <Button variant="contained" size="large" onClick={onConnect} disabled={isBusy}>
              {isBusy ? 'Connecting…' : 'Connect with Meta'}
            </Button>
            <Button variant="outlined" size="large" onClick={onConnectManually} disabled={isBusy}>
              Use an existing token
            </Button>
          </Stack>

          <Typography variant="caption" color="text.disabled" sx={{ maxWidth: 420 }}>
            No WhatsApp Business Account yet? Connect with Meta and it will set one up. Already have
            one? Use an existing token. Both routes are open to every account — see Numbers for the
            full comparison.
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
