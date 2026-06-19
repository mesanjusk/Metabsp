import { Box, Button, Container, Grid, Stack, Typography, Paper, Chip } from '@mui/material';
import { Link } from 'react-router-dom';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import WebhookRoundedIcon from '@mui/icons-material/WebhookRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';

const FEATURES = [
  {
    icon: <BusinessRoundedIcon sx={{ fontSize: 32, color: '#25d366' }} />,
    title: 'WhatsApp Business Accounts',
    desc: 'Manage WABAs and phone numbers connected to your Meta app with real-time status.',
  },
  {
    icon: <AccountTreeRoundedIcon sx={{ fontSize: 32, color: '#25d366' }} />,
    title: 'Embedded Signup',
    desc: 'Onboard businesses to WhatsApp Business Platform using Facebook Login for Business.',
  },
  {
    icon: <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 32, color: '#25d366' }} />,
    title: 'Messaging Inbox',
    desc: 'Send and receive messages via official WhatsApp Cloud API with real-time updates.',
  },
  {
    icon: <SendRoundedIcon sx={{ fontSize: 32, color: '#25d366' }} />,
    title: 'Paid / Template Messaging',
    desc: 'Distribute pre-approved message templates for marketing, utility, and authentication.',
  },
  {
    icon: <WebhookRoundedIcon sx={{ fontSize: 32, color: '#25d366' }} />,
    title: 'Webhook Debugger',
    desc: 'Inspect live webhook payloads from Meta in real time to debug your integration.',
  },
  {
    icon: <SettingsRoundedIcon sx={{ fontSize: 32, color: '#25d366' }} />,
    title: 'Business Assets',
    desc: 'View Pages, Ad Accounts, Datasets, Catalogs, and Instagram accounts connected to your business.',
  },
];

const BENEFITS = [
  'Official Meta WhatsApp Cloud API',
  'Real-time messaging via Socket.io',
  'Webhook event capture & replay',
  'Multi-account WABA management',
  'Template message campaigns',
  'Embedded Signup for SMB onboarding',
];

export default function PublicLanding() {
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: '#0a1628', color: '#fff', overflowX: 'hidden' }}>

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <Box
        component="nav"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 3, md: 6 },
          py: 2,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backdropFilter: 'blur(12px)',
          bgcolor: 'rgba(10,22,40,0.85)',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 2,
              bgcolor: '#25d366',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChatBubbleOutlineRoundedIcon sx={{ color: '#fff', fontSize: 22 }} />
          </Box>
          <Typography fontWeight={700} fontSize={20} letterSpacing={-0.5}>
            Metabsp
          </Typography>
          <Chip label="Tech Provider" size="small" sx={{ bgcolor: 'rgba(37,211,102,0.15)', color: '#25d366', fontSize: 11 }} />
        </Stack>

        <Stack direction="row" spacing={1.5}>
          <Button
            component={Link}
            to="/login"
            variant="outlined"
            size="small"
            sx={{
              borderColor: 'rgba(255,255,255,0.25)',
              color: '#fff',
              '&:hover': { borderColor: '#25d366', color: '#25d366' },
            }}
          >
            Sign In
          </Button>
          <Button
            component={Link}
            to="/cloud-signup"
            variant="contained"
            size="small"
            sx={{ bgcolor: '#25d366', '&:hover': { bgcolor: '#1da851' } }}
          >
            Get Started
          </Button>
        </Stack>
      </Box>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <Container maxWidth="lg" sx={{ pt: { xs: 8, md: 12 }, pb: { xs: 6, md: 10 }, textAlign: 'center' }}>
        <Chip
          label="Built on Meta Platform APIs"
          size="small"
          sx={{
            mb: 3,
            bgcolor: 'rgba(37,211,102,0.1)',
            color: '#25d366',
            border: '1px solid rgba(37,211,102,0.3)',
          }}
        />
        <Typography
          variant="h2"
          fontWeight={800}
          sx={{
            fontSize: { xs: '2.2rem', md: '3.5rem' },
            lineHeight: 1.1,
            mb: 3,
            letterSpacing: -1.5,
          }}
        >
          WhatsApp Business Platform
          <br />
          <Box component="span" sx={{ color: '#25d366' }}>
            for Tech Providers
          </Box>
        </Typography>
        <Typography
          sx={{ color: 'rgba(255,255,255,0.6)', fontSize: { xs: '1rem', md: '1.2rem' }, mb: 5, maxWidth: 640, mx: 'auto' }}
        >
          Onboard businesses, manage WABAs, send messages, and debug webhooks — all from a single developer dashboard powered by the official Meta Cloud API.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
          <Button
            component={Link}
            to="/cloud-signup"
            variant="contained"
            size="large"
            endIcon={<ArrowForwardRoundedIcon />}
            sx={{ bgcolor: '#25d366', '&:hover': { bgcolor: '#1da851' }, px: 4, py: 1.5, fontSize: '1rem', fontWeight: 700 }}
          >
            Start for free
          </Button>
          <Button
            component={Link}
            to="/login"
            variant="outlined"
            size="large"
            sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff', '&:hover': { borderColor: '#25d366' }, px: 4, py: 1.5 }}
          >
            Sign in to dashboard
          </Button>
        </Stack>
      </Container>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', py: { xs: 6, md: 10 } }}>
        <Container maxWidth="lg">
          <Typography variant="h4" fontWeight={700} textAlign="center" mb={1}>
            Everything a Tech Provider needs
          </Typography>
          <Typography textAlign="center" sx={{ color: 'rgba(255,255,255,0.5)', mb: 6 }}>
            Integrate WhatsApp Business Platform into your product with confidence.
          </Typography>
          <Grid container spacing={3}>
            {FEATURES.map((f) => (
              <Grid item xs={12} sm={6} md={4} key={f.title}>
                <Paper
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    height: '100%',
                    transition: 'border-color 0.2s',
                    '&:hover': { borderColor: 'rgba(37,211,102,0.4)' },
                  }}
                >
                  <Box mb={2}>{f.icon}</Box>
                  <Typography fontWeight={700} mb={1}>
                    {f.title}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                    {f.desc}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── Benefits ─────────────────────────────────────────────────────────── */}
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 10 } }}>
        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="h4" fontWeight={700} mb={2}>
              What's included
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.55)', mb: 4 }}>
              A complete toolkit for building WhatsApp-powered products on Meta's official Business Platform.
            </Typography>
            <Stack spacing={1.5}>
              {BENEFITS.map((b) => (
                <Stack key={b} direction="row" alignItems="center" spacing={1.5}>
                  <CheckCircleRoundedIcon sx={{ color: '#25d366', fontSize: 20 }} />
                  <Typography sx={{ color: 'rgba(255,255,255,0.8)' }}>{b}</Typography>
                </Stack>
              ))}
            </Stack>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper
              sx={{
                p: 3,
                borderRadius: 3,
                bgcolor: 'rgba(37,211,102,0.06)',
                border: '1px solid rgba(37,211,102,0.2)',
              }}
            >
              <Typography fontWeight={700} mb={2} sx={{ color: '#25d366' }}>
                Get started in minutes
              </Typography>
              {['Create your account', 'Connect a WhatsApp Business Account', 'Use Embedded Signup to onboard businesses', 'Send messages & monitor webhooks'].map(
                (step, i) => (
                  <Stack key={step} direction="row" spacing={2} mb={1.5} alignItems="flex-start">
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        bgcolor: '#25d366',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        mt: 0.1,
                      }}
                    >
                      <Typography sx={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{i + 1}</Typography>
                    </Box>
                    <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem' }}>{step}</Typography>
                  </Stack>
                )
              )}
            </Paper>
          </Grid>
        </Grid>
      </Container>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <Box sx={{ bgcolor: '#25d366', py: { xs: 6, md: 8 }, textAlign: 'center' }}>
        <Container maxWidth="sm">
          <Typography variant="h4" fontWeight={800} color="#fff" mb={1}>
            Ready to build?
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.8)', mb: 4 }}>
            Sign up for free and start managing your WhatsApp Business Platform integration today.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              component={Link}
              to="/cloud-signup"
              variant="contained"
              size="large"
              sx={{ bgcolor: '#fff', color: '#1da851', fontWeight: 700, '&:hover': { bgcolor: '#f0f0f0' }, px: 4 }}
            >
              Create free account
            </Button>
            <Button
              component={Link}
              to="/login"
              variant="outlined"
              size="large"
              sx={{ borderColor: 'rgba(255,255,255,0.6)', color: '#fff', '&:hover': { borderColor: '#fff' }, px: 4 }}
            >
              Sign in
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <Box sx={{ py: 3, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>
          © {new Date().getFullYear()} Metabsp · Built on Meta Platform APIs ·{' '}
          <Box component={Link} to="/privacy-policy" sx={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'underline' }}>
            Privacy Policy
          </Box>
        </Typography>
      </Box>
    </Box>
  );
}
