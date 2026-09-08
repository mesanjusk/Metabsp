'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, CardContent, CardHeader, Divider, Stack, TextField, Typography } from '@mui/material';
import apiClient from '@/lib/api/client';
import { parseApiError } from '@/lib/api/parseApiError';
import { toast } from '@/lib/ui/components/Toast';

const EMPTY_PROFILE = {
  mobile: '',
  username: '',
  displayName: '',
  password: '',
  confirmPassword: '',
};

const asText = (value) => String(value ?? '');

export default function AccountProfilePanel() {
  const [form, setForm] = useState(EMPTY_PROFILE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/users/me');
      const user = response?.data?.user || {};
      setForm((prev) => ({
        ...prev,
        mobile: asText(user.Mobile_number),
        username: asText(user.User_name),
        displayName: asText(user.Display_name),
        password: '',
        confirmPassword: '',
      }));
    } catch (err) {
      setError(parseApiError(err, 'Could not load your account details.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const saveProfile = async () => {
    const mobile = asText(form.mobile).trim();
    const displayName = asText(form.displayName).trim();
    if (!mobile) {
      setError('Mobile number is required.');
      return;
    }

    setIsSavingProfile(true);
    setError('');
    try {
      const response = await apiClient.put('/api/users/me', {
        Mobile_number: mobile,
        Display_name: displayName,
      });
      const user = response?.data?.user || {};
      setForm((prev) => ({
        ...prev,
        mobile: asText(user.Mobile_number || mobile),
        username: asText(user.User_name || prev.username),
        displayName: asText(user.Display_name || displayName),
      }));
      toast.success('Account details updated.');
    } catch (err) {
      setError(parseApiError(err, 'Could not update account details.'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const savePassword = async () => {
    const password = asText(form.password);
    const confirmPassword = asText(form.confirmPassword);
    if (!password) {
      setError('Enter a new password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setIsSavingPassword(true);
    setError('');
    try {
      await apiClient.put('/api/users/me', {
        Password: password,
        Confirm_password: confirmPassword,
      });
      setForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
      toast.success('Password updated.');
    } catch (err) {
      setError(parseApiError(err, 'Could not update password.'));
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Profile and password"
        subheader="Update your sign-in mobile number, display name, or password."
        titleTypographyProps={{ variant: 'h6' }}
        subheaderTypographyProps={{ variant: 'body2' }}
      />
      <CardContent sx={{ pt: 0 }}>
        <Stack spacing={3}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <Stack spacing={2}>
            <Typography variant="subtitle2">Account details</Typography>
            <TextField
              label="Mobile"
              value={form.mobile}
              onChange={(event) => setField('mobile', event.target.value)}
              disabled={isLoading || isSavingProfile}
              helperText="This is your sign-in identity. Existing accounts are migrated safely when you save."
              fullWidth
            />
            <TextField
              label="Display name"
              value={form.displayName}
              onChange={(event) => setField('displayName', event.target.value)}
              disabled={isLoading || isSavingProfile}
              fullWidth
            />
            <TextField
              label="Username"
              value={form.username}
              disabled
              helperText="Legacy usernames are shown for reference. Mobile number is used for sign-in on migrated accounts."
              fullWidth
            />
            <Stack direction="row" justifyContent="flex-end">
              <Button variant="contained" onClick={saveProfile} disabled={isLoading || isSavingProfile || isSavingPassword}>
                {isSavingProfile ? 'Updating…' : 'Update profile'}
              </Button>
            </Stack>
          </Stack>

          <Divider />

          <Stack spacing={2}>
            <Typography variant="subtitle2">Change password</Typography>
            <TextField
              label="New password"
              type="password"
              value={form.password}
              onChange={(event) => setField('password', event.target.value)}
              disabled={isLoading || isSavingPassword}
              autoComplete="new-password"
              fullWidth
            />
            <TextField
              label="Confirm new password"
              type="password"
              value={form.confirmPassword}
              onChange={(event) => setField('confirmPassword', event.target.value)}
              disabled={isLoading || isSavingPassword}
              autoComplete="new-password"
              fullWidth
            />
            <Stack direction="row" justifyContent="flex-end">
              <Button variant="contained" onClick={savePassword} disabled={isLoading || isSavingPassword || isSavingProfile}>
                {isSavingPassword ? 'Updating…' : 'Change password'}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
