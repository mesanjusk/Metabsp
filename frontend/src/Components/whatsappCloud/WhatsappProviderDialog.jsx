import { useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Radio, RadioGroup, FormControlLabel, Stack, Alert,
} from '@mui/material';

const OPTIONS = [
  { value: 'baileys', label: 'Baileys (WhatsApp Web / QR code)' },
  { value: 'meta', label: 'Meta (official WhatsApp Cloud API)' },
  { value: 'both', label: 'Both' },
];

// forced=true: no close button, can't dismiss without choosing (first-login prompt).
// forced=false: dismissible "change later" dialog from settings.
export default function WhatsappProviderDialog({ open, forced = false, currentValue = '', onClose, onSubmit }) {
  const [value, setValue] = useState(currentValue || 'both');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    try {
      await onSubmit(value);
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not save your choice. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={forced ? undefined : onClose} maxWidth="xs" fullWidth disableEscapeKeyDown={forced}>
      <DialogTitle>Which WhatsApp do you use?</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {forced
            ? 'Pick how you plan to send/receive WhatsApp messages. You can change this anytime later in settings.'
            : 'Change which tab(s) show on your dashboard.'}
        </DialogContentText>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        <RadioGroup value={value} onChange={(e) => setValue(e.target.value)}>
          <Stack spacing={0.5}>
            {OPTIONS.map((opt) => (
              <FormControlLabel key={opt.value} value={opt.value} control={<Radio />} label={opt.label} />
            ))}
          </Stack>
        </RadioGroup>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {!forced && <Button onClick={onClose} disabled={saving}>Cancel</Button>}
        <Button variant="contained" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
