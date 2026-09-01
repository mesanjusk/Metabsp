'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import apiClient from '@/lib/api/client';
import { parseApiError } from '@/lib/api/parseApiError';
import { toast } from '@/lib/ui/components/Toast';

/**
 * Workspace-level preferences.
 *
 * Extracted from the former "WhatsApp Settings" panel, which stacked these
 * toggles together with number connection, webhook destinations, team
 * management and billing in a single scroll — five unrelated jobs on one
 * screen, so none of them was findable. Each now lives where it belongs; this
 * file keeps only the preferences that are genuinely settings.
 *
 * Every control carries a line explaining what it changes. A switch labelled
 * "Enable analytics" tells a user nothing about what turning it off costs them.
 */
const DEFAULTS = {
  analyticsEnabled: true,
  autoReplyEnabled: true,
  webhookHealthAlerts: false,
  defaultCountryCode: '+91',
  timezone: 'Asia/Kolkata',
};

const TOGGLES = [
  {
    key: 'autoReplyEnabled',
    label: 'Automations',
    description: 'Run keyword auto-replies and workflows against inbound messages. Off means every message waits for a person.',
  },
  {
    key: 'analyticsEnabled',
    label: 'Analytics collection',
    description: 'Aggregate message and conversation counts for the Analytics screen.',
  },
  {
    key: 'webhookHealthAlerts',
    label: 'Webhook health alerts',
    description: 'Notify you when one of your webhook destinations starts failing, instead of finding out from missing data.',
  },
];

export default function WorkspacePreferencesPanel() {
  const [form, setForm] = useState(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/whatsapp/settings');
      const data = response?.data?.data || response?.data || {};
      setForm({ ...DEFAULTS, ...data });
    } catch (err) {
      setError(parseApiError(err, 'Could not load preferences. The rest of the product is unaffected.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setIsSaving(true);
    setError('');
    try {
      await apiClient.post('/api/whatsapp/settings', form);
      toast.success('Preferences saved.');
    } catch (err) {
      setError(parseApiError(err, 'Could not save preferences.'));
    } finally {
      setIsSaving(false);
    }
  };

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Card>
      <CardHeader
        title="Workspace preferences"
        subheader="Applies to every number connected to this workspace."
        titleTypographyProps={{ variant: 'h6' }}
        subheaderTypographyProps={{ variant: 'body2' }}
      />
      <CardContent sx={{ pt: 0 }}>
        <Stack spacing={3}>
          {error ? <Alert severity="warning">{error}</Alert> : null}

          <Stack spacing={2}>
            {TOGGLES.map((toggle) => (
              <Stack key={toggle.key} spacing={0.25}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(form[toggle.key])}
                      onChange={(event) => setField(toggle.key, event.target.checked)}
                    />
                  }
                  label={toggle.label}
                />
                <Typography variant="caption" color="text.secondary" sx={{ pl: 6 }}>
                  {toggle.description}
                </Typography>
              </Stack>
            ))}
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Default country code"
              value={form.defaultCountryCode || ''}
              onChange={(event) => setField('defaultCountryCode', event.target.value)}
              helperText="Prefixed to imported numbers that arrive without one."
              fullWidth
            />
            <TextField
              label="Time zone"
              value={form.timezone || ''}
              onChange={(event) => setField('timezone', event.target.value)}
              helperText="Used for scheduling and for timestamps in reports."
              fullWidth
            />
          </Stack>

          <Stack direction="row" spacing={1.5} justifyContent="flex-end">
            <Button variant="outlined" onClick={load} disabled={isLoading || isSaving}>
              Discard changes
            </Button>
            <Button variant="contained" onClick={save} disabled={isLoading || isSaving}>
              {isSaving ? 'Saving…' : 'Save preferences'}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
