'use client';

import { useEffect, useState } from 'react';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import { toast } from '@/lib/ui/components/Toast';
import { ROUTES } from '@/lib/constants/routes';
import { useAuth } from '@/lib/ui/AuthContext';
import SocialSignIn from '@/lib/ui/components/SocialSignIn';

export default function Login() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(ROUTES.WHATSAPP);
    }
  }, [isAuthenticated, router]);

  // Social sign-in returns the same {token, user} envelope as password login,
  // so it lands in the session through the identical code path — no second
  // notion of "logged in" to keep consistent.
  const handleAuthenticated = (data) => {
    login(data.token, {
      userName: data.user?.Display_name || data.user?.User_name || '',
      userGroup: data.user?.User_group || '',
      mobileNumber: data.user?.Mobile_number || '',
      whatsappProvider: data.user?.Whatsapp_provider || '',
    });
    toast.success('Login successful.');
    router.replace(ROUTES.WHATSAPP);
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrorText('');

    try {
      const response = await apiClient.post('/api/users/login', {
        Mobile_number: mobile,
        Password: password,
      });

      const data = response?.data || {};

      if (!data.success || !data.token) {
        setErrorText(data.message || 'That mobile number and password did not match an account.');
        return;
      }

      login(data.token, {
        userName: data.user?.Display_name || data.user?.User_name || mobile,
        userGroup: data.user?.User_group || '',
        mobileNumber: data.user?.Mobile_number || '',
        whatsappProvider: data.user?.Whatsapp_provider || '',
      });

      toast.success('Login successful.');
      router.replace(ROUTES.WHATSAPP);
    } catch (error) {
      setErrorText(
        error?.response?.data?.message || 'Login failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '1fr minmax(420px, 520px)' },
        bgcolor: '#111b21',
      }}
    >
      <Stack
        sx={{
          display: { xs: 'none', lg: 'flex' },
          justifyContent: 'center',
          p: 6,
          color: '#e9edef',
          background: 'linear-gradient(160deg, #0b141a 0%, #111b21 50%, #10352f 100%)',
        }}
        spacing={2}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <ChatRoundedIcon sx={{ color: '#25d366', fontSize: 32 }} />
          <Typography variant="h4" fontWeight={700}>WhatsApp BSP</Typography>
        </Stack>
        <Typography variant="h6" sx={{ maxWidth: 540 }}>
          Manage customer conversations, broadcast campaigns, templates, and automation from a single WhatsApp-native workspace.
        </Typography>
      </Stack>

      <Box sx={{ display: 'grid', placeItems: 'center', p: { xs: 2, md: 3 } }}>
        <Paper sx={{ width: '100%', maxWidth: 460, p: { xs: 3, sm: 4 }, borderRadius: 4 }}>
          <Stack spacing={3} component="form" onSubmit={submit}>
            <Box>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                Sign in
              </Typography>
              <Typography color="text.secondary">
                Sign in with the mobile number your account was created with.
              </Typography>
            </Box>

            {errorText ? <Alert severity="error">{errorText}</Alert> : null}

            <TextField
              label="Mobile number"
              autoComplete="username tel"
              type="tel"
              inputProps={{ inputMode: 'tel' }}
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={loading}
              endIcon={loading ? <CircularProgress size={18} color="inherit" /> : <LoginRoundedIcon />}
            >
              {loading ? 'Please wait...' : 'Continue'}
            </Button>

            <SocialSignIn onSuccess={handleAuthenticated} disabled={loading} />

            <Stack direction="row" justifyContent="space-between">
              <MuiLink component={NextLink} href={ROUTES.SIGNUP} variant="body2">
                Create account
              </MuiLink>
              <MuiLink component={NextLink} href={ROUTES.FORGOT_PASSWORD} variant="body2">
                Forgot password?
              </MuiLink>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}