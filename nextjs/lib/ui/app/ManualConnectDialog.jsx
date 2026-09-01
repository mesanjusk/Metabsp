'use client';

import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

const EMPTY = {
  accessToken: '',
  phoneNumberId: '',
  businessAccountId: '',
  wabaId: '',
  displayPhoneNumber: '',
  verifiedName: '',
};

/**
 * The manual connect path: a business administrator supplies a WhatsApp
 * Business Account they already hold, instead of going through Embedded
 * Signup.
 *
 * Worth keeping distinct from the Meta popup, because it is the only place the
 * product asks anyone to paste an access token — the server validates that the
 * WABA genuinely belongs to the business supplying it before storing anything,
 * and the copy below says so rather than leaving a token field unexplained.
 */
export default function ManualConnectDialog({ open, onClose, onSubmit, isBusy }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const close = () => {
    setForm(EMPTY);
    setError('');
    onClose?.();
  };

  const submit = async () => {
    if (!form.accessToken || !form.phoneNumberId) {
      setError('Access token and Phone number ID are both required.');
      return;
    }
    if (!form.businessAccountId && !form.wabaId) {
      setError('Provide either a Business account ID or a WABA ID.');
      return;
    }
    setError('');
    const result = await onSubmit(form);
    if (result?.ok) close();
    else setError(result?.error || 'Could not connect the number.');
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>Connect an existing WhatsApp number</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Use this when you already manage the WhatsApp Business Account in Meta Business Manager. We
            verify with Meta that the account belongs to you before storing anything, and the token is
            encrypted at rest.
          </Typography>

          {error ? <Alert severity="error">{error}</Alert> : null}

          <TextField
            label="Access token"
            value={form.accessToken}
            onChange={set('accessToken')}
            type="password"
            autoComplete="off"
            required
            fullWidth
            helperText="A System User token is recommended — it does not expire."
          />
          <TextField label="Phone number ID" value={form.phoneNumberId} onChange={set('phoneNumberId')} required fullWidth />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Business account ID" value={form.businessAccountId} onChange={set('businessAccountId')} fullWidth />
            <TextField label="WABA ID" value={form.wabaId} onChange={set('wabaId')} fullWidth />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Display phone number" value={form.displayPhoneNumber} onChange={set('displayPhoneNumber')} fullWidth />
            <TextField label="Verified name" value={form.verifiedName} onChange={set('verifiedName')} fullWidth />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={close} disabled={isBusy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={isBusy}>
          {isBusy ? 'Connecting…' : 'Connect number'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
