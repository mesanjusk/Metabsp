import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Divider, Stack, TextField, Typography,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useAuth } from '../context/AuthContext';
import PwaInstallPrompt from '../components/pwa/PwaInstallPrompt';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(form.username, form.password);
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 1.5, background: 'linear-gradient(180deg,#eef4ff 0%,#f7fafc 100%)' }}>
      <Stack spacing={1.5} sx={{ width: '100%', maxWidth: 420 }}>
        <PwaInstallPrompt />
        <Card sx={{ width: '100%', maxWidth: 420, mx: 'auto' }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={2} component="form" onSubmit={submit}>
              <Stack spacing={1} alignItems="center">
                <Box sx={{ width: 56, height: 56, borderRadius: 99, display: 'grid', placeItems: 'center', bgcolor: 'primary.main', color: 'white' }}>
                  <LockOutlinedIcon />
                </Box>
                <Typography variant="h5" fontWeight={600}>Instify Bulk Invite</Typography>
                <Typography color="text.secondary" align="center" variant="body2">
                  Sign in with your mobile number or username
                </Typography>
              </Stack>

              {error && <Alert severity="error">{error}</Alert>}

              <TextField
                label="Mobile / Username"
                value={form.username}
                onChange={set('username')}
                inputProps={{ inputMode: 'text' }}
                required
              />
              <TextField
                label="Password"
                type="password"
                value={form.password}
                onChange={set('password')}
                required
              />

              <Button size="large" variant="contained" type="submit" disabled={submitting}>
                {submitting ? <CircularProgress size={22} color="inherit" /> : 'Login'}
              </Button>

              <Box textAlign="right">
                <Link to="/forgot-password" style={{ fontSize: 14, color: 'inherit' }}>
                  Forgot password?
                </Link>
              </Box>

              <Divider />

              <Typography variant="body2" textAlign="center">
                New here?{' '}
                <Link to="/signup" style={{ fontWeight: 600, color: 'inherit' }}>
                  Create an account
                </Link>
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
