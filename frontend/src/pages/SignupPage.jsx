import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  InputAdornment, Stack, Step, StepLabel, Stepper,
  TextField, Typography,
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import BusinessIcon from '@mui/icons-material/Business';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import api from '../api';
import { useAuth } from '../context/BulkAuthContext';

const STEPS = ['Check Mobile', 'Your Details', 'Verify OTP'];

export default function SignupPage() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [mobile, setMobile] = useState('');
  const [orgName, setOrgName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const clearMessages = () => { setError(''); setInfo(''); };

  // Step 0: Check if mobile exists
  const handleCheckMobile = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!mobile.trim()) return setError('Enter your mobile number');
    setLoading(true);
    try {
      const { data } = await api.post('/org/check-mobile', { mobile });
      if (data.exists) {
        setError('An account with this mobile already exists.');
        setInfo('');
        return;
      }
      setStep(1);
    } catch (err) {
      setError(err?.response?.data?.message || 'Error checking mobile');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Send OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!orgName.trim() || !adminName.trim() || !password) {
      return setError('All fields are required');
    }
    setLoading(true);
    try {
      const { data } = await api.post('/org/request-signup-otp', {
        mobile, orgName, adminName, password,
      });
      if (data.redirectTo === 'forgot-password') {
        setError(data.message);
        return;
      }
      setInfo(data.message);
      setStep(2);
    } catch (err) {
      const d = err?.response?.data;
      if (d?.redirectTo === 'forgot-password') {
        setError(d.message);
        navigate('/forgot-password');
        return;
      }
      setError(d?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!otp.trim()) return setError('Enter the OTP');
    setLoading(true);
    try {
      const { data } = await api.post('/org/verify-signup-otp', {
        mobile, otp, orgName, adminName, password,
      });
      loginWithToken(data.token, data.user);
      navigate('/');
    } catch (err) {
      const d = err?.response?.data;
      if (d?.redirectTo === 'login') {
        setError(d.message);
        navigate('/login');
        return;
      }
      setError(d?.message || 'OTP verification failed');
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
              <Box sx={{ width: 56, height: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'primary.main', color: 'white' }}>
                <BusinessIcon />
              </Box>
              <Typography variant="h5" fontWeight={600}>Create Account</Typography>
              <Typography color="text.secondary" variant="body2" textAlign="center">
                Sign up to start using Bulk Invite
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
              <Stack component="form" onSubmit={handleCheckMobile} spacing={2}>
                <TextField
                  label="Mobile Number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  inputProps={{ inputMode: 'numeric' }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><PhoneIcon fontSize="small" /></InputAdornment> }}
                  placeholder="e.g. 9876543210"
                  required
                />
                <Button type="submit" variant="contained" size="large" disabled={loading}>
                  {loading ? <CircularProgress size={22} /> : 'Check Availability'}
                </Button>
                <Typography variant="body2" textAlign="center">
                  Already have an account?{' '}
                  <Link to="/login" style={{ color: 'inherit', fontWeight: 600 }}>Log in</Link>
                </Typography>
              </Stack>
            )}

            {step === 1 && (
              <Stack component="form" onSubmit={handleRequestOtp} spacing={2}>
                <TextField label="Organization / Event Name" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
                <TextField label="Your Name" value={adminName} onChange={(e) => setAdminName(e.target.value)} required />
                <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <Button type="submit" variant="contained" size="large" disabled={loading}>
                  {loading ? <CircularProgress size={22} /> : 'Send OTP to WhatsApp'}
                </Button>
                <Button variant="text" onClick={() => { setStep(0); clearMessages(); }}>← Back</Button>
              </Stack>
            )}

            {step === 2 && (
              <Stack component="form" onSubmit={handleVerifyOtp} spacing={2}>
                <Stack spacing={0.5} alignItems="center">
                  <VerifiedUserIcon color="primary" sx={{ fontSize: 48 }} />
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    Enter the 6-digit OTP sent to <strong>{mobile}</strong> via WhatsApp
                  </Typography>
                </Stack>
                <TextField
                  label="OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  inputProps={{ inputMode: 'numeric', maxLength: 6 }}
                  required
                />
                <Button type="submit" variant="contained" size="large" disabled={loading}>
                  {loading ? <CircularProgress size={22} /> : 'Verify & Create Account'}
                </Button>
                <Button variant="text" onClick={async () => {
                  clearMessages();
                  setLoading(true);
                  try {
                    const { data } = await api.post('/org/request-signup-otp', { mobile, orgName, adminName, password });
                    setInfo('OTP resent.' + (data.devOtp ? ` [DEV: ${data.devOtp}]` : ''));
                  } catch (err) {
                    setError(err?.response?.data?.message || 'Failed to resend OTP');
                  } finally { setLoading(false); }
                }}>Resend OTP</Button>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
