import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Stack, Typography,
} from '@mui/material';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import api from '../api';
import { useAuth } from '../context/BulkAuthContext';

export default function MagicLoginPage() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState('loading'); // 'loading' | 'error'
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('No token found in the link.');
      setStatus('error');
      return;
    }

    api.get(`/auth/magic-login?token=${encodeURIComponent(token)}`)
      .then(({ data }) => {
        loginWithToken(data.token, data.user);
        navigate('/dashboard', { replace: true });
      })
      .catch((err) => {
        setError(err?.response?.data?.message || 'Magic link is invalid or has expired.');
        setStatus('error');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'loading') {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress size={48} />
          <Typography variant="h6" color="text.secondary">Logging you in…</Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2, background: 'linear-gradient(180deg,#eef4ff 0%,#f7fafc 100%)' }}>
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={3} alignItems="center">
            <Box sx={{ width: 56, height: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'error.main', color: 'white' }}>
              <LinkOffIcon />
            </Box>
            <Typography variant="h5" fontWeight={600}>Link Expired</Typography>
            {error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}
            <Typography color="text.secondary" variant="body2" textAlign="center">
              This magic link has expired or already been used.<br />
              Please request a new one.
            </Typography>
            <Stack spacing={1} sx={{ width: '100%' }}>
              <Button component={Link} to="/bulk-login" variant="contained" fullWidth>
                Back to Login
              </Button>
              <Button component={Link} to="/forgot-password" variant="outlined" fullWidth>
                Request New Link
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
