import { useEffect, useState, useCallback } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, FormControlLabel,
  MenuItem, Paper, Select, Stack, Step, StepLabel, Stepper, Switch,
  TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import apiClient from '../../apiClient';

const STEPS = ['Configure', 'Review Payload', 'Launch & Onboard'];

const FEATURE_OPTIONS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'MESSENGER', label: 'Messenger' },
  { value: 'PAGE', label: 'Page' },
];

const ES_VERSIONS = ['v3', 'v2', 'v1'];

function buildPayload({ esVersion, featureType, features, configId }) {
  return {
    config_id: configId || '<YOUR_CONFIG_ID>',
    response_type: 'code',
    extras: {
      version: esVersion,
      featureType,
      features,
    },
  };
}

function JsonHighlight({ json }) {
  return (
    <Box
      component="pre"
      sx={{
        bgcolor: 'rgba(0,0,0,0.35)',
        color: '#e2e8f0',
        p: 2,
        borderRadius: 2,
        fontSize: '0.78rem',
        overflowX: 'auto',
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        m: 0,
      }}
    >
      {json}
    </Box>
  );
}

export default function EmbeddedSignupBuilder() {
  const [step, setStep] = useState(0);
  const [esVersion, setEsVersion] = useState('v3');
  const [featureType, setFeatureType] = useState('WHATSAPP_EMBEDDED_SIGNUP');
  const [features, setFeatures] = useState(['WHATSAPP']);
  const [configId, setConfigId] = useState('');
  const [autoRegister, setAutoRegister] = useState(true);
  const [autoSubscribe, setAutoSubscribe] = useState(true);

  // Exchange code flow
  const [code, setCode] = useState('');
  const [exchangeLoading, setExchangeLoading] = useState(false);
  const [exchangeResult, setExchangeResult] = useState(null);
  const [exchangeError, setExchangeError] = useState('');

  const [copied, setCopied] = useState(false);

  const payload = buildPayload({ esVersion, featureType, features, configId });
  const payloadJson = JSON.stringify(payload, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(payloadJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeatureToggle = (_, newFeatures) => {
    if (newFeatures.length) setFeatures(newFeatures);
  };

  const handleExchange = async () => {
    if (!code.trim()) return;
    setExchangeLoading(true);
    setExchangeError('');
    setExchangeResult(null);
    try {
      const res = await apiClient.post('/api/whatsapp/embedded-signup/exchange-code', {
        code: code.trim(),
        autoRegister,
        autoSubscribe,
      });
      setExchangeResult(res.data);
    } catch (err) {
      setExchangeError(err?.response?.data?.message || 'Exchange failed');
    } finally {
      setExchangeLoading(false);
    }
  };

  const launchEmbeddedSignup = () => {
    const params = new URLSearchParams({
      client_id: configId || '',
      config_id: payload.config_id,
      response_type: 'code',
      override_default_response_type: 'true',
      extras: JSON.stringify(payload.extras),
    });
    const url = `https://www.facebook.com/dialog/oauth?${params.toString()}`;
    const win = window.open(url, 'embedded_signup', 'width=900,height=700');
    if (!win) alert('Popup blocked — allow popups for this site.');
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        Embedded Signup Builder
      </Typography>
      <Typography color="text.secondary" fontSize={14} mb={4}>
        Build, preview, and launch the Facebook Login for Business flow to onboard businesses onto WhatsApp Business Platform.
      </Typography>

      <Stepper activeStep={step} sx={{ mb: 4 }}>
        {STEPS.map((s) => (
          <Step key={s}>
            <StepLabel>{s}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {step === 0 && (
        <Box>
          <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 3 }}>
            <Typography fontWeight={600} mb={2}>
              Configuration
            </Typography>

            <Stack spacing={3}>
              <Box>
                <Typography fontSize={13} color="text.secondary" mb={1}>
                  ES Version
                </Typography>
                <Select
                  size="small"
                  value={esVersion}
                  onChange={(e) => setEsVersion(e.target.value)}
                  sx={{ minWidth: 120 }}
                >
                  {ES_VERSIONS.map((v) => (
                    <MenuItem key={v} value={v}>{v}</MenuItem>
                  ))}
                </Select>
              </Box>

              <Box>
                <Typography fontSize={13} color="text.secondary" mb={1}>
                  Feature Type
                </Typography>
                <Select
                  size="small"
                  value={featureType}
                  onChange={(e) => setFeatureType(e.target.value)}
                  sx={{ minWidth: 280 }}
                >
                  <MenuItem value="WHATSAPP_EMBEDDED_SIGNUP">WHATSAPP_EMBEDDED_SIGNUP</MenuItem>
                  <MenuItem value="CRM">CRM</MenuItem>
                  <MenuItem value="CUSTOM">CUSTOM</MenuItem>
                </Select>
              </Box>

              <Box>
                <Typography fontSize={13} color="text.secondary" mb={1}>
                  Features
                </Typography>
                <ToggleButtonGroup
                  value={features}
                  onChange={handleFeatureToggle}
                  size="small"
                >
                  {FEATURE_OPTIONS.map((f) => (
                    <ToggleButton key={f.value} value={f.value}>
                      {f.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>

              <Box>
                <Typography fontSize={13} color="text.secondary" mb={1}>
                  Tech Provider Config ID
                </Typography>
                <TextField
                  size="small"
                  placeholder="e.g. 1234567890"
                  value={configId}
                  onChange={(e) => setConfigId(e.target.value)}
                  sx={{ width: 280 }}
                />
                <Typography fontSize={11} color="text.disabled" mt={0.5}>
                  Found in Meta Business Suite → WhatsApp Manager → Configuration
                </Typography>
              </Box>

              <Divider />

              <Box>
                <Typography fontWeight={600} mb={1.5}>
                  Post-signup Server Actions
                </Typography>
                <Stack spacing={1}>
                  <FormControlLabel
                    control={<Switch checked={autoRegister} onChange={(e) => setAutoRegister(e.target.checked)} />}
                    label="Auto-register phone number"
                  />
                  <FormControlLabel
                    control={<Switch checked={autoSubscribe} onChange={(e) => setAutoSubscribe(e.target.checked)} />}
                    label="Auto-subscribe WABA to webhooks"
                  />
                </Stack>
              </Box>
            </Stack>
          </Paper>

          <Button variant="contained" onClick={() => setStep(1)} sx={{ bgcolor: '#25d366', '&:hover': { bgcolor: '#1da851' } }}>
            Next: Review Payload
          </Button>
        </Box>
      )}

      {step === 1 && (
        <Box>
          <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography fontWeight={600}>Generated Payload</Typography>
              <Tooltip title={copied ? 'Copied!' : 'Copy JSON'}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={copied ? <CheckCircleRoundedIcon /> : <ContentCopyRoundedIcon />}
                  onClick={handleCopy}
                  sx={{ borderColor: '#25d366', color: '#25d366' }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </Tooltip>
            </Stack>
            <JsonHighlight json={payloadJson} />
          </Paper>

          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button variant="contained" onClick={() => setStep(2)} sx={{ bgcolor: '#25d366', '&:hover': { bgcolor: '#1da851' } }}>
              Next: Launch
            </Button>
          </Stack>
        </Box>
      )}

      {step === 2 && (
        <Box>
          <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 3 }}>
            <Typography fontWeight={600} mb={2}>
              Launch Embedded Signup
            </Typography>
            <Typography color="text.secondary" fontSize={13} mb={3}>
              Click the button below to open the Facebook Login for Business popup. After the business completes signup,
              copy the authorization code from the callback and exchange it for an access token below.
            </Typography>
            <Button
              variant="contained"
              startIcon={<RocketLaunchRoundedIcon />}
              onClick={launchEmbeddedSignup}
              sx={{ bgcolor: '#1877f2', '&:hover': { bgcolor: '#1565c0' }, mb: 2 }}
            >
              Launch Embedded Signup
            </Button>

            <Divider sx={{ my: 3 }} />

            <Typography fontWeight={600} mb={2}>
              Exchange Authorization Code
            </Typography>
            <Stack spacing={2}>
              <TextField
                label="Authorization Code"
                size="small"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste the code from the callback URL"
                fullWidth
              />
              <Box>
                <Button
                  variant="contained"
                  onClick={handleExchange}
                  disabled={exchangeLoading || !code.trim()}
                  startIcon={exchangeLoading ? <CircularProgress size={16} /> : null}
                  sx={{ bgcolor: '#25d366', '&:hover': { bgcolor: '#1da851' } }}
                >
                  Exchange Code
                </Button>
              </Box>
              {exchangeError && <Alert severity="error">{exchangeError}</Alert>}
              {exchangeResult && (
                <Alert severity="success">
                  <Typography fontWeight={600} mb={0.5}>Success!</Typography>
                  <JsonHighlight json={JSON.stringify(exchangeResult, null, 2)} />
                </Alert>
              )}
            </Stack>
          </Paper>

          <Button variant="outlined" onClick={() => setStep(1)}>
            Back
          </Button>
        </Box>
      )}
    </Box>
  );
}
