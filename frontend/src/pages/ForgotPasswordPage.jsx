import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  InputAdornment, Stack, Step, StepLabel, Stepper,
  TextField, Typography,
} from '@mui/material';
import LockResetIcon from '@mui/icons-material/LockReset';
import PhoneIcon from '@mui/icons-material/Phone';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import api from '../api';
import { useAuth } from '../context/BulkAuthContext';

const STEPS = ['Enter Mobile', 'OTP Verification', 'New Password'];

export default function ForgotPasswordPage() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const clearMessages = () => { setError(''); setInfo(''); };

  // Step 0: Request OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!mobile.trim()) return setError('Enter your mobile number');
    setLoading(true);
    try {
      const { data } = await api.post('/org/request-forgot-otp', { mobile });
      if (data.redirectTo === 'signup') {
        setError(data.message);
        return;
      }
      setInfo(data.message);
      setStep(1);
    } catch (err) {
      const d = err?.response?.data;
      if (d?.redirectTo === 'signup') {
        setError(d.message);
        return;
      }
      setError(d?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Verify OTP → move to password input
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!otp.trim()) return setError('Enter the OTP');
    // Just advance — final reset happens in step 2
    setStep(2);
  };

  // Step 2: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    clearMessages();
    if (newPassword !== confirmPassword) return setError('Passwords do not match');
    if (newPassword.length < 6) return setError('Password must be at least 6 characters');
    setLoading(true);
    try {
      const { data } = await api.post('/org/reset-password', { mobile, otp, newPassword });
      loginWithToken(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2, background: 'linear-gradient(180deg,#eef4ff 0%,#f7fafc 100%)' }}>
      <Card sx={{ width: '100%', maxWidth: 460 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={3}>
            <Stack spacing={1} alignItems="center">
              <Box sx={{ width: 56, height: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'warning.main', color: 'white' }}>
                <LockResetIcon />
              </Box>
              <Typography variant="h5" fontWeight={600}>Reset Password</Typography>
              <Typography color="text.secondary" variant="body2" textAlign="center">
                We'll send an OTP to your WhatsApp number
              </Typography>
            </Stack>

            <Stepper activeStep={step} alternativeLabel>
              {STEPS.map((label) => (
                <Step key={label}><StepLabel>{label}</StepLabel></Step>
              ))}
            </Stepper>

            {error && <Alert severity="error" onClose={clearMessages}>{error}</Alert>}
            {info && <Alert severity="info">{info}</Alert>}

            {step === 0 && (
              <Stack component="form" onSubmit={handleRequestOtp} spacing={2}>
                <TextField
                  label="Registered Mobile Number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  inputProps={{ inputMode: 'numeric' }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><PhoneIcon fontSize="small" /></InputAdornment> }}
                  required
                />
                <Button type="submit" variant="contained" size="large" disabled={loading}>
                  {loading ? <CircularProgress size={22} /> : 'Send OTP'}
                </Button>
                <Typography variant="body2" textAlign="center">
                  Remember your password?{' '}
                  <Link to="/login" style={{ color: 'inherit', fontWeight: 600 }}>Log in</Link>
                </Typography>
                <Typography variant="body2" textAlign="center">
                  No account?{' '}
                  <Link to="/signup" style={{ color: 'inherit', fontWeight: 600 }}>Sign up</Link>
                </Typography>
              </Stack>
            )}

            {step === 1 && (
              <Stack component="form" onSubmit={handleVerifyOtp} spacing={2}>
                <Stack spacing={0.5} alignItems="center">
                  <VerifiedUserIcon color="primary" sx={{ fontSize: 48 }} />
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    OTP sent to <strong>{mobile}</strong> on WhatsApp
                  </Typography>
                </Stack>
                <TextField
                  label="Enter OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  inputProps={{ inputMode: 'numeric', maxLength: 6 }}
                  required
                />
                <Button type="submit" variant="contained" size="large">Next</Button>
                <Button variant="text" onClick={async () => {
                  clearMessages();
                  setLoading(true);
                  try {
                    const { data } = await api.post('/org/request-forgot-otp', { mobile });
                    setInfo('OTP resent.');
                  } catch (err) {
                    setError(err?.response?.data?.message || 'Failed to resend');
                  } finally { setLoading(false); }
                }}>Resend OTP</Button>
                <Button variant="text" onClick={() => { setStep(0); clearMessages(); }}>← Back</Button>
              </Stack>
            )}

            {step === 2 && (
              <Stack component="form" onSubmit={handleResetPassword} spacing={2}>
                <TextField
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <TextField
                  label="Confirm New Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <Button type="submit" variant="contained" size="large" disabled={loading}>
                  {loading ? <CircularProgress size={22} /> : 'Reset Password & Login'}
                </Button>
                <Button variant="text" onClick={() => { setStep(1); clearMessages(); }}>← Back</Button>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
