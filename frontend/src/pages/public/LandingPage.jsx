import React from 'react';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import {
  Container, Typography, Box, Paper, Grid, Chip, Stack, Button,
} from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import ForumIcon from '@mui/icons-material/Forum';
import ContactsIcon from '@mui/icons-material/Contacts';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import HubIcon from '@mui/icons-material/Hub';
import ApiIcon from '@mui/icons-material/Api';
import VerifiedIcon from '@mui/icons-material/Verified';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

const FeatureCard = ({ icon, title, description }) => (
  <Paper
    elevation={0}
    sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}
    component={motion.div}
    whileHover={{ y: -4 }}
    transition={{ duration: 0.2 }}
  >
    <Box sx={{ color: 'primary.main', mb: 1.5 }}>{icon}</Box>
    <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>{title}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>{description}</Typography>
  </Paper>
);

const Step = ({ number, title, description }) => (
  <Box sx={{ textAlign: 'center', px: 2 }}>
    <Box
      sx={{
        width: 48, height: 48, borderRadius: '50%', bgcolor: 'primary.main', color: '#05260f',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20,
        mx: 'auto', mb: 2,
      }}
    >
      {number}
    </Box>
    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>{title}</Typography>
    <Typography variant="body2" color="text.secondary">{description}</Typography>
  </Box>
);

const FEATURES = [
  {
    icon: <ForumIcon sx={{ fontSize: 32 }} />,
    title: 'Unified inbox',
    description: 'One shared inbox for every conversation, with real-time delivery, read receipts, and media support.',
  },
  {
    icon: <WhatsAppIcon sx={{ fontSize: 32 }} />,
    title: 'Templates & broadcast',
    description: 'Send approved WhatsApp templates and broadcast to many contacts at once, with the 24-hour customer-service window handled for you.',
  },
  {
    icon: <ContactsIcon sx={{ fontSize: 32 }} />,
    title: 'Built-in CRM',
    description: 'Tag, categorize, and assign contacts; import from Excel; hand any list straight into a broadcast.',
  },
  {
    icon: <AutoFixHighIcon sx={{ fontSize: 32 }} />,
    title: 'Auto-reply, including guided flows',
    description: 'Keyword auto-replies or multi-step, catalog-driven conversations that guide customers to the right answer automatically.',
  },
  {
    icon: <HubIcon sx={{ fontSize: 32 }} />,
    title: 'One webhook, many projects',
    description: 'A single Meta webhook URL per number — fan it out to as many of your own project URLs as you like, each with its own signing secret, self-service from your account settings.',
  },
  {
    icon: <ApiIcon sx={{ fontSize: 32 }} />,
    title: 'API access',
    description: 'A REST API secured by your own API keys, so external systems can send messages without touching the dashboard.',
  },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/whatsapp" replace />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
        <Box
          sx={{
            background: 'linear-gradient(135deg, #111b21 0%, #1a2e38 50%, #0b3d2e 100%)',
            color: 'white',
            py: { xs: 10, md: 16 },
            textAlign: 'center',
          }}
        >
          <Container maxWidth="md">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <WhatsAppIcon sx={{ color: '#25d366', fontSize: 40 }} />
                <Typography variant="h3" fontWeight={900} sx={{ color: 'white' }}>MetaBSP</Typography>
              </Box>
              <Typography variant="h4" fontWeight={700} sx={{ mb: 2, color: 'rgba(255,255,255,0.95)' }}>
                Run your WhatsApp business messaging from one place
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.75)', maxWidth: 620, mx: 'auto', lineHeight: 1.8 }}>
                Inbox, templates, broadcast, CRM, and auto-reply — over the official WhatsApp
                Cloud API — plus a self-service webhook that fans out to every project you run.
              </Typography>
              <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ mt: 4 }} flexWrap="wrap" useFlexGap>
                <Button component={RouterLink} to="/signup" variant="contained" size="large" sx={{ bgcolor: '#25d366', color: '#05260f', fontWeight: 700, px: 4, '&:hover': { bgcolor: '#1ebe5a' } }}>
                  Get started free
                </Button>
                <Button component={RouterLink} to="/login" variant="outlined" size="large" sx={{ borderColor: 'rgba(255,255,255,0.4)', color: 'white', px: 4, '&:hover': { borderColor: 'white' } }}>
                  Log in
                </Button>
              </Stack>
              <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ mt: 3 }} flexWrap="wrap" useFlexGap>
                <Chip label="Meta Technology Partner" icon={<VerifiedIcon />} sx={{ bgcolor: '#25d366', color: '#05260f', fontWeight: 700 }} />
                <Chip label="No credit card required" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'white' }} />
              </Stack>
            </motion.div>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ py: 10 }}>
          <Box sx={{ mb: 8 }}>
            <Typography variant="h4" fontWeight={800} sx={{ mb: 1, textAlign: 'center' }}>Everything you need to message at scale</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mb: 5, maxWidth: 640, mx: 'auto' }}>
              One dashboard for the official WhatsApp Cloud API — connect a number through Meta's
              own Embedded Signup and start sending in minutes.
            </Typography>
            <Grid container spacing={3}>
              {FEATURES.map((feature, i) => (
                <Grid item xs={12} sm={6} md={3} key={i}>
                  <FeatureCard {...feature} />
                </Grid>
              ))}
            </Grid>
          </Box>

          <Box sx={{ mb: 8, py: 6 }}>
            <Typography variant="h4" fontWeight={800} sx={{ mb: 1, textAlign: 'center' }}>How it works</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mb: 6 }}>
              From signup to your first message in three steps
            </Typography>
            <Grid container spacing={4}>
              <Grid item xs={12} sm={4}>
                <Step number={1} title="Create your account" description="Sign up with your mobile number — no WhatsApp Business account required to start." />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Step number={2} title="Connect a number" description="Connect your WhatsApp Business number through Meta's official Embedded Signup flow." />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Step number={3} title="Send and automate" description="Chat, broadcast, and route events to as many of your own projects as you need." />
              </Grid>
            </Grid>
          </Box>

          <Box
            sx={{
              textAlign: 'center',
              py: 6,
              px: 4,
              borderRadius: 4,
              background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)',
              color: 'white',
            }}
          >
            <Typography variant="h4" fontWeight={800} sx={{ mb: 1.5, color: 'white' }}>
              Ready to get started?
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)', mb: 3 }}>
              Create your account and connect your first WhatsApp number today.
            </Typography>
            <Button
              component={RouterLink}
              to="/signup"
              variant="contained"
              size="large"
              sx={{ bgcolor: 'white', color: '#128c7e', fontWeight: 700, px: 4, '&:hover': { bgcolor: '#f0f0f0' } }}
            >
              Start free
            </Button>
          </Box>
        </Container>
      </Box>
    </motion.div>
  );
}
