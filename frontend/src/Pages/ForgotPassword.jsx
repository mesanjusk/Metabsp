import { useState } from 'react';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
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
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../apiClient';
import { toast } from '../Components/Toast';
import { ROUTES } from '../constants/routes';

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');

  const requestOtp = async (event) => {
    event.preventDefault();
    setErrorText('');
    setInfoText('');

    if (!mobile.trim()) {
      setErrorText('Enter your registered mobile number.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await apiClient.post('/api/users/forgot-password/request-otp', {
        Mobile_number: mobile,
      });

      if (!data.success) {
        setErrorText(data.message || 'Failed to send OTP.');
        return;
      }

      setInfoText(data.message);
      setStep(1);
    } catch (error) {
      setErrorText(error?.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setErrorText('');

    if (!code.trim() || !newPassword.trim()) {
      setErrorText('Enter the OTP and a new password.');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/api/users/forgot-password/reset', {
        Mobile_number: mobile,
        code,
        newPassword,
      });

      toast.success('Password reset successful. Please log in.');
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (error) {
      setErrorText(error?.response?.data?.message || 'Failed to reset password.');
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
          Reset your password using an OTP sent to your registered WhatsApp number.
        </Typography>
      </Stack>

      <Box sx={{ display: 'grid', placeItems: 'center', p: { xs: 2, md: 3 } }}>
        <Paper sx={{ width: '100%', maxWidth: 460, p: { xs: 3, sm: 4 }, borderRadius: 4 }}>
          <Stack
            spacing={3}
            component="form"
            onSubmit={step === 0 ? requestOtp : resetPassword}
          >
            <Box>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                Forgot password
              </Typography>
              <Typography color="text.secondary">
                {step === 0
                  ? 'Enter your registered mobile number to receive an OTP on WhatsApp.'
                  : `Enter the OTP sent to ${mobile} and set a new password.`}
              </Typography>
            </Box>

            {errorText ? <Alert severity="error">{errorText}</Alert> : null}
            {infoText ? <Alert severity="success">{infoText}</Alert> : null}

            {step === 0 ? (
              <>
                <TextField
                  label="Mobile Number"
                  autoComplete="tel"
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

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={loading}
                  endIcon={loading ? <CircularProgress size={18} color="inherit" /> : <LockResetRoundedIcon />}
                >
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </Button>
              </>
            ) : (
              <>
                <TextField
                  label="OTP"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  inputMode="numeric"
                />

                <TextField
                  label="New Password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
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
                  endIcon={loading ? <CircularProgress size={18} color="inherit" /> : <LockResetRoundedIcon />}
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </Button>
              </>
            )}

            <Typography variant="body2" textAlign="center">
              <MuiLink component={Link} to={ROUTES.LOGIN}>Back to sign in</MuiLink>
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
