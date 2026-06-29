import { useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip,
  CircularProgress, FormControl, FormControlLabel, FormGroup,
  Grid, IconButton, InputAdornment, InputLabel, LinearProgress,
  MenuItem, Paper, Select, Stack, Step, StepLabel, Stepper,
  TextField, Tooltip, Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  ArrowForward as NextIcon,
  CheckCircle as CheckCircleIcon,
  ContentCopy as CopyIcon,
  Facebook as FacebookIcon,
  Language as WebIcon,
  MenuBook as DocsIcon,
  Phone as PhoneIcon,
  Save as SaveIcon,
  Send as SendIcon,
  SupportAgent as SupportIcon,
  Verified as VerifiedIcon,
  Webhook as WebhookIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  'Business Details',
  'Facebook Login',
  'Business Verification',
  'WhatsApp Number',
  'Webhook Config',
  'Testing',
  'All Done!',
];

const INDUSTRIES = [
  'E-commerce', 'Financial Services', 'Healthcare', 'Education', 'Travel & Hospitality',
  'Real Estate', 'Retail', 'Technology', 'Media & Entertainment', 'Other',
];

const BUSINESS_SIZES = ['1–10', '11–50', '51–200', '201–1,000', '1,000+'];

const COUNTRIES = [
  'United States', 'United Kingdom', 'India', 'Germany', 'France',
  'Brazil', 'Canada', 'Australia', 'Singapore', 'Other',
];

// ─── Step Components ──────────────────────────────────────────────────────────

function StepFade({ children, stepKey }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -24 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Step 1 ──────────────────────────────────────────────────────────────────────

function Step1BusinessDetails({ form, setForm }) {
  const update = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  return (
    <StepFade stepKey="s1">
      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Tell us about your business</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        We use this information to configure your WhatsApp Business account and comply with Meta's business verification requirements.
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField fullWidth required label="Business Name" value={form.businessName} onChange={update('businessName')} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth required>
            <InputLabel>Industry</InputLabel>
            <Select label="Industry" value={form.industry} onChange={update('industry')}>
              {INDUSTRIES.map((i) => <MenuItem key={i} value={i}>{i}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth required>
            <InputLabel>Business Size</InputLabel>
            <Select label="Business Size" value={form.size} onChange={update('size')}>
              {BUSINESS_SIZES.map((s) => <MenuItem key={s} value={s}>{s} employees</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField fullWidth label="Website URL" value={form.website} onChange={update('website')} placeholder="https://example.com" />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth required>
            <InputLabel>Country</InputLabel>
            <Select label="Country" value={form.country} onChange={update('country')}>
              {COUNTRIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </StepFade>
  );
}

// Step 2 ──────────────────────────────────────────────────────────────────────

function Step2FacebookLogin({ fbState, setFbState }) {
  const connect = () => {
    setFbState('connecting');
    setTimeout(() => setFbState('connected'), 2200);
  };

  return (
    <StepFade stepKey="s2">
      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Connect with Facebook</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        MetaBSP uses Facebook Login to securely access your Meta Business Manager and set up WhatsApp Business API.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Permissions Requested</Typography>
              {['whatsapp_business_management', 'whatsapp_business_messaging', 'business_management', 'pages_manage_metadata'].map((p) => (
                <Stack key={p} direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{p}</Typography>
                </Stack>
              ))}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Data Accessed</Typography>
              {[
                'Business Manager ID and name',
                'WhatsApp Business Account details',
                'Phone numbers and their status',
                'Message templates',
              ].map((d) => (
                <Stack key={d} direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 1 }}>
                  <CheckCircleIcon sx={{ fontSize: 16, color: 'info.main', mt: '2px' }} />
                  <Typography variant="body2" color="text.secondary">{d}</Typography>
                </Stack>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, textAlign: 'center' }}>
        {fbState === 'idle' && (
          <Button
            variant="contained"
            size="large"
            startIcon={<FacebookIcon />}
            onClick={connect}
            sx={{ bgcolor: '#1877F2', '&:hover': { bgcolor: '#1565C0' }, px: 4, py: 1.5, borderRadius: 2, fontWeight: 700, fontSize: '1rem' }}
          >
            Continue with Facebook
          </Button>
        )}
        {fbState === 'connecting' && (
          <Stack alignItems="center" spacing={2}>
            <CircularProgress size={40} sx={{ color: '#1877F2' }} />
            <Typography variant="body2" color="text.secondary">Connecting to Facebook…</Typography>
          </Stack>
        )}
        {fbState === 'connected' && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Stack alignItems="center" spacing={1}>
              <CheckCircleIcon sx={{ fontSize: 56, color: 'success.main' }} />
              <Typography variant="h6" fontWeight={700} color="success.main">Connected Successfully!</Typography>
              <Typography variant="body2" color="text.secondary">Facebook account linked. Click Next to continue.</Typography>
            </Stack>
          </motion.div>
        )}
      </Box>
    </StepFade>
  );
}

// Step 3 ──────────────────────────────────────────────────────────────────────

function Step3BusinessVerification({ verifyState }) {
  return (
    <StepFade stepKey="s3">
      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Business Verification</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Meta requires all businesses to verify their identity before accessing the WhatsApp Business API at scale.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Business verification is done through your Meta Business Manager. The process typically takes 1–3 business days.
      </Alert>

      <Stack spacing={2} sx={{ mb: 3 }}>
        {[
          { step: '1', label: 'Log in to Meta Business Manager', done: true },
          { step: '2', label: 'Navigate to Business Settings → Security Centre', done: true },
          { step: '3', label: 'Click "Start Verification"', done: true },
          { step: '4', label: 'Provide business details and documents', done: false },
          { step: '5', label: 'Wait for Meta review (1–3 business days)', done: false },
        ].map((s) => (
          <Stack key={s.step} direction="row" alignItems="center" spacing={2}>
            <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: s.done ? 'success.main' : 'grey.200', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {s.done
                ? <CheckCircleIcon sx={{ fontSize: 18, color: 'white' }} />
                : <Typography variant="caption" fontWeight={700} color="text.secondary">{s.step}</Typography>}
            </Box>
            <Typography variant="body2" sx={{ color: s.done ? 'text.primary' : 'text.secondary' }}>{s.label}</Typography>
          </Stack>
        ))}
      </Stack>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Upload Supporting Documents</Typography>
          <Box
            sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 4, textAlign: 'center', bgcolor: 'grey.50', cursor: 'pointer', '&:hover': { bgcolor: 'grey.100' } }}
          >
            <VerifiedIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">Drop documents here or click to upload</Typography>
            <Typography variant="caption" color="text.disabled">Business registration, utility bill, or government-issued ID</Typography>
          </Box>
        </CardContent>
      </Card>

      <Stack direction="row" spacing={1.5} alignItems="center">
        <Chip label={verifyState === 'verified' ? 'Verified' : verifyState === 'pending' ? 'Pending Review' : 'Not Started'} color={verifyState === 'verified' ? 'success' : verifyState === 'pending' ? 'warning' : 'default'} />
        {verifyState === 'pending' && <Typography variant="caption" color="text.secondary">You can continue the onboarding while verification is in progress.</Typography>}
      </Stack>
    </StepFade>
  );
}

// Step 4 ──────────────────────────────────────────────────────────────────────

function Step4WhatsAppNumber({ otpState, setOtpState, form, setForm }) {
  const update = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const requestOtp = () => {
    setOtpState('sent');
    setTimeout(() => setOtpState('verified'), 3000);
  };

  return (
    <StepFade stepKey="s4">
      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Add WhatsApp Number</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Register the phone number you want to use for WhatsApp Business messaging. You'll need to verify it via OTP.
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={4} sm={3}>
          <FormControl fullWidth>
            <InputLabel>Code</InputLabel>
            <Select label="Code" value={form.countryCode || '+1'} onChange={update('countryCode')}>
              {['+1', '+44', '+91', '+49', '+33', '+55', '+61'].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={8} sm={9}>
          <TextField fullWidth label="Phone Number" value={form.phoneNumber || ''} onChange={update('phoneNumber')} placeholder="415 555 0100" />
        </Grid>
        <Grid item xs={12}>
          <TextField fullWidth label="Display Name" value={form.displayName || ''} onChange={update('displayName')} placeholder="Acme Support" helperText="This name will be visible to customers on WhatsApp." />
        </Grid>
      </Grid>

      <Box sx={{ mt: 3 }}>
        {otpState === 'idle' && (
          <Button variant="outlined" onClick={requestOtp} startIcon={<PhoneIcon />}>
            Send OTP Verification Code
          </Button>
        )}
        {otpState === 'sent' && (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>OTP sent to {form.countryCode || '+1'} {form.phoneNumber || 'your number'}. Verifying automatically in demo…</Alert>
            <TextField label="Enter OTP" value="••••••" disabled sx={{ mr: 2 }} />
            <CircularProgress size={20} sx={{ verticalAlign: 'middle' }} />
          </Box>
        )}
        {otpState === 'verified' && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Alert severity="success" icon={<CheckCircleIcon />}>Phone number verified successfully!</Alert>
          </motion.div>
        )}
      </Box>
    </StepFade>
  );
}

// Step 5 ──────────────────────────────────────────────────────────────────────

function Step5Webhook({ webhookTest, setWebhookTest }) {
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState('');
  const [events, setEvents] = useState({ messages: true, status: true, templates: false });
  const url = 'https://api.metabsp.com/webhook/biz_8f3a91c2';

  const copy = () => {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const testWebhook = () => {
    setWebhookTest('testing');
    setTimeout(() => setWebhookTest('success'), 2000);
  };

  return (
    <StepFade stepKey="s5">
      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Configure Webhook</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        MetaBSP will receive real-time notifications from Meta about incoming messages, delivery status updates, and template approvals.
      </Typography>

      <Stack spacing={2.5}>
        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Your Webhook URL</Typography>
          <TextField
            fullWidth
            value={url}
            InputProps={{
              readOnly: true,
              sx: { fontFamily: 'monospace', fontSize: '0.85rem', bgcolor: 'grey.50' },
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title={copied ? 'Copied!' : 'Copy'}>
                    <IconButton onClick={copy} size="small">
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Verify Token</Typography>
          <TextField
            fullWidth
            label="Verify Token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter a secret token to validate webhook calls"
            helperText="Set this same value in your Meta App Dashboard under Webhooks."
          />
        </Box>

        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Subscribe to Events</Typography>
          <FormGroup row>
            {Object.keys(events).map((k) => (
              <FormControlLabel
                key={k}
                control={<Checkbox checked={events[k]} onChange={(e) => setEvents((p) => ({ ...p, [k]: e.target.checked }))} />}
                label={k.charAt(0).toUpperCase() + k.slice(1)}
              />
            ))}
          </FormGroup>
        </Box>

        <Box>
          <Button variant="outlined" startIcon={<WebhookIcon />} onClick={testWebhook} disabled={webhookTest === 'testing'}>
            {webhookTest === 'testing' ? 'Testing…' : 'Test Webhook'}
          </Button>
          {webhookTest === 'testing' && <CircularProgress size={18} sx={{ ml: 1.5, verticalAlign: 'middle' }} />}
          {webhookTest === 'success' && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Chip label="Webhook Verified" color="success" size="small" icon={<CheckCircleIcon />} sx={{ ml: 1.5 }} />
            </motion.span>
          )}
        </Box>
      </Stack>
    </StepFade>
  );
}

// Step 6 ──────────────────────────────────────────────────────────────────────

function Step6Testing({ testResult, setTestResult }) {
  const [testNumber, setTestNumber] = useState('');

  const sendTest = () => {
    setTestResult('sending');
    setTimeout(() => setTestResult('delivered'), 2500);
  };

  return (
    <StepFade stepKey="s6">
      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Send a Test Message</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Verify everything is working by sending a test message to your own number and confirming the webhook received it.
      </Typography>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Test Message</Typography>
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Recipient Number"
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              placeholder="+1 650 555 0100"
              helperText="Enter a real number to receive the test. Standard messaging rates may apply."
            />
            <Box sx={{ bgcolor: '#ECE5DD', borderRadius: 2, p: 2 }}>
              <Box sx={{ bgcolor: 'white', borderRadius: 2, p: 1.5, display: 'inline-block', boxShadow: 1 }}>
                <Typography variant="body2">
                  Hello! This is a test message from <strong>MetaBSP</strong>. Your WhatsApp Business integration is working correctly. 🎉
                </Typography>
              </Box>
            </Box>
            <Button variant="contained" startIcon={<SendIcon />} onClick={sendTest} disabled={testResult === 'sending'} sx={{ alignSelf: 'flex-start' }}>
              {testResult === 'sending' ? 'Sending…' : 'Send Test Message'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {testResult === 'sending' && (
        <Stack alignItems="center" spacing={1}>
          <CircularProgress size={32} />
          <Typography variant="body2" color="text.secondary">Sending test message…</Typography>
        </Stack>
      )}

      {testResult === 'delivered' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Stack spacing={1.5}>
            <Alert severity="success">Test message sent and delivered successfully!</Alert>
            <Alert severity="info">Webhook event received: <strong>message_status: delivered</strong> at 2026-06-27 14:35:02</Alert>
          </Stack>
        </motion.div>
      )}
    </StepFade>
  );
}

// Step 7 ──────────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#1877F2', '#25D366', '#FF6900', '#9C27B0', '#FFC107', '#00BCD4'];

function Confetti() {
  return (
    <Box sx={{ position: 'relative', height: 80, overflow: 'hidden', mb: 2 }}>
      {Array.from({ length: 24 }).map((_, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            top: -10,
            left: `${Math.random() * 100}%`,
            width: 8,
            height: 8,
            borderRadius: Math.random() > 0.5 ? '50%' : 2,
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          }}
          animate={{ y: [0, 100], rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)], opacity: [1, 0] }}
          transition={{ duration: 1.2 + Math.random() * 0.8, delay: Math.random() * 0.6, ease: 'easeIn' }}
        />
      ))}
    </Box>
  );
}

function Step7Finish({ form }) {
  return (
    <StepFade stepKey="s7">
      <Confetti />
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}>
          <CheckCircleIcon sx={{ fontSize: 72, color: 'success.main', mb: 1 }} />
        </motion.div>
        <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5 }}>You're all set!</Typography>
        <Typography variant="body1" color="text.secondary">
          Your WhatsApp Business integration is live and ready to use.
        </Typography>
      </Box>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Configuration Summary</Typography>
          <Grid container spacing={1.5}>
            {[
              ['Business', form.businessName || 'Acme Corp'],
              ['Industry', form.industry || 'Technology'],
              ['Country', form.country || 'United States'],
              ['Facebook', 'Connected'],
              ['Verification', 'Pending Review'],
              ['Phone Number', `${form.countryCode || '+1'} ${form.phoneNumber || '415 555 0100'}`],
              ['Display Name', form.displayName || 'Acme Support'],
              ['Webhook', 'Configured & Verified'],
              ['Test Message', 'Delivered'],
            ].map(([label, value]) => (
              <Grid item xs={12} sm={6} key={label}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                  <Typography variant="body2"><strong>{label}:</strong> {value}</Typography>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        {[
          { label: 'Go to Dashboard', icon: <WebIcon />, href: '/', primary: true },
          { label: 'API Documentation', icon: <DocsIcon />, href: '#', primary: false },
          { label: 'Help Center', icon: <SupportIcon />, href: '#', primary: false },
        ].map((l) => (
          <Grid item xs={12} sm={4} key={l.label}>
            <Button
              fullWidth
              variant={l.primary ? 'contained' : 'outlined'}
              startIcon={l.icon}
              href={l.href}
              sx={l.primary ? { py: 1.5, fontWeight: 700, bgcolor: '#1877F2', '&:hover': { bgcolor: '#1565C0' } } : { py: 1.5 }}
            >
              {l.label}
            </Button>
          </Grid>
        ))}
      </Grid>
    </StepFade>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OnboardingWizardPage() {
  const [step, setStep] = useState(0);
  const [fbState, setFbState] = useState('idle');       // idle | connecting | connected
  const [otpState, setOtpState] = useState('idle');     // idle | sent | verified
  const [webhookTest, setWebhookTest] = useState('idle'); // idle | testing | success
  const [testResult, setTestResult] = useState('idle'); // idle | sending | delivered
  const [form, setForm] = useState({ businessName: '', industry: '', size: '', website: '', country: '', countryCode: '+1', phoneNumber: '', displayName: '' });

  const canProceed = () => {
    if (step === 0) return form.businessName && form.industry && form.size && form.country;
    if (step === 1) return fbState === 'connected';
    return true; // other steps can proceed
  };

  const next = () => { if (step < STEPS.length - 1) setStep((s) => s + 1); };
  const back = () => { if (step > 0) setStep((s) => s - 1); };

  const stepViews = [
    <Step1BusinessDetails form={form} setForm={setForm} />,
    <Step2FacebookLogin fbState={fbState} setFbState={setFbState} />,
    <Step3BusinessVerification verifyState="pending" />,
    <Step4WhatsAppNumber otpState={otpState} setOtpState={setOtpState} form={form} setForm={setForm} />,
    <Step5Webhook webhookTest={webhookTest} setWebhookTest={setWebhookTest} />,
    <Step6Testing testResult={testResult} setTestResult={setTestResult} />,
    <Step7Finish form={form} />,
  ];

  const isLast = step === STEPS.length - 1;
  const progress = ((step) / (STEPS.length - 1)) * 100;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50', py: { xs: 3, sm: 6 }, px: { xs: 2, sm: 4 } }}>
      <Box sx={{ maxWidth: 760, mx: 'auto' }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 4 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FacebookIcon sx={{ color: 'white', fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1 }}>MetaBSP</Typography>
            <Typography variant="caption" color="text.secondary">Onboarding Wizard</Typography>
          </Box>
        </Stack>

        {/* Progress Bar */}
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" justifyContent="space-between" mb={0.75}>
            <Typography variant="caption" color="text.secondary">Step {step + 1} of {STEPS.length}</Typography>
            <Typography variant="caption" fontWeight={700} color="primary.main">{Math.round(progress)}% complete</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3 }} />
        </Box>

        {/* Stepper */}
        <Box sx={{ display: { xs: 'none', md: 'block' }, mb: 3 }}>
          <Stepper activeStep={step} alternativeLabel>
            {STEPS.map((label, i) => (
              <Step key={label} completed={i < step}>
                <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '0.7rem', mt: 0.5 } }}>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        {/* Content */}
        <Paper elevation={0} variant="outlined" sx={{ borderRadius: 3, p: { xs: 2.5, sm: 4 }, mb: 3, minHeight: 320 }}>
          {stepViews[step]}
        </Paper>

        {/* Navigation */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <Button variant="text" startIcon={<SaveIcon />} color="inherit" sx={{ color: 'text.secondary' }}>
            Save & Continue Later
          </Button>
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" startIcon={<BackIcon />} onClick={back} disabled={step === 0}>
              Back
            </Button>
            {!isLast && (
              <Button
                variant="contained"
                endIcon={<NextIcon />}
                onClick={next}
                disabled={!canProceed()}
                sx={{ px: 3 }}
              >
                {step === STEPS.length - 2 ? 'Finish Setup' : 'Next'}
              </Button>
            )}
          </Stack>
        </Stack>

        {/* Mobile step label */}
        <Box sx={{ display: { xs: 'block', md: 'none' }, mt: 2, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">{STEPS[step]}</Typography>
        </Box>
      </Box>
    </Box>
  );
}
