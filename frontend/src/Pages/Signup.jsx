import { useState } from 'react';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
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
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../apiClient';
import { toast } from '../Components/Toast';
import { ROUTES } from '../constants/routes';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step, setStep] = useState(0);
  const [userName, setUserName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');

  const requestOtp = async (event) => {
    event.preventDefault();
    setErrorText('');
    setInfoText('');

    if (!userName.trim() || !mobile.trim() || !password.trim()) {
      setErrorText('All fields are required.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await apiClient.post('/api/users/signup/request-otp', {
        User_name: userName,
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

  const verifyAndCreate = async (event) => {
    event.preventDefault();
    setErrorText('');

    if (!code.trim()) {
      setErrorText('Enter the OTP sent to your WhatsApp number.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await apiClient.post('/api/users/signup/verify', {
        User_name: userName,
        Mobile_number: mobile,
        Password: password,
        code,
      });

      login(data.token, {
        userName: data.user?.User_name || userName,
        userGroup: data.user?.User_group || '',
        mobileNumber: data.user?.Mobile_number || mobile,
      });

      toast.success('Account created successfully.');
      navigate(ROUTES.WHATSAPP, { replace: true });
    } catch (error) {
      setErrorText(error?.response?.data?.message || 'Failed to verify OTP.');
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
          Create your workspace account to manage conversations, broadcast campaigns, and templates.
        </Typography>
      </Stack>

      <Box sx={{ display: 'grid', placeItems: 'center', p: { xs: 2, md: 3 } }}>
        <Paper sx={{ width: '100%', maxWidth: 460, p: { xs: 3, sm: 4 }, borderRadius: 4 }}>
          <Stack
            spacing={3}
            component="form"
            onSubmit={step === 0 ? requestOtp : verifyAndCreate}
          >
            <Box>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                Create account
              </Typography>
              <Typography color="text.secondary">
                {step === 0
                  ? 'Enter your details to receive an OTP on WhatsApp.'
                  : `Enter the OTP sent to ${mobile}.`}
              </Typography>
            </Box>

            {errorText ? <Alert severity="error">{errorText}</Alert> : null}
            {infoText ? <Alert severity="success">{infoText}</Alert> : null}

            {step === 0 ? (
              <>
                <TextField
                  label="User Name"
                  autoComplete="username"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonRoundedIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />

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

                <TextField
                  label="Password"
                  type="password"
                  autoComplete="new-password"
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
                  endIcon={loading ? <CircularProgress size={18} color="inherit" /> : <PersonAddRoundedIcon />}
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

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={loading}
                  endIcon={loading ? <CircularProgress size={18} color="inherit" /> : <PersonAddRoundedIcon />}
                >
                  {loading ? 'Verifying...' : 'Verify & Create Account'}
                </Button>
              </>
            )}

            <Typography variant="body2" textAlign="center">
              Already have an account?{' '}
              <MuiLink component={Link} to={ROUTES.LOGIN}>Sign in</MuiLink>
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
