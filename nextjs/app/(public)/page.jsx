'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NextLink from 'next/link';
import { Box, Button, Chip, Container, Grid, Paper, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import HubRoundedIcon from '@mui/icons-material/HubRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/ui/AuthContext';
import BrandMark from '@/lib/ui/app/BrandMark';

/**
 * The landing page.
 *
 * Rebuilt on the theme rather than on hardcoded WhatsApp colours. The previous
 * version painted its hero in `linear-gradient(#111b21 … #0b3d2e)` with a
 * #25d366 call to action and WhatsApp's own icon beside the wordmark — the
 * consumer app's exact identity, on the front page a Meta reviewer opens
 * first. It also linked "Get started" at `/signup`, a route that did not
 * exist, so the primary conversion path on the site was a 404.
 */

const FEATURES = [
  {
    icon: ForumRoundedIcon,
    title: 'Shared inbox',
    description:
      'Every conversation in one place, with delivery and read receipts, media, and assignment so two people never answer the same customer.',
  },
  {
    icon: DescriptionRoundedIcon,
    title: 'Templates and broadcasts',
    description:
      'Submit templates for Meta review, then send to thousands. Each recipient is a queued job that retries on its own and respects rate limits.',
  },
  {
    icon: PeopleAltRoundedIcon,
    title: 'Contacts',
    description:
      'Tag and segment everyone who has messaged you, import from a spreadsheet, and send to a segment without leaving the dashboard.',
  },
  {
    icon: BoltRoundedIcon,
    title: 'Automations',
    description:
      'Keyword auto-replies for a single question, or multi-step workflows with delays for anything that needs more than one answer.',
  },
  {
    icon: HubRoundedIcon,
    title: 'One webhook, many systems',
    description:
      'A single Meta webhook per number, fanned out to as many of your own endpoints as you need — each with its own signing secret.',
  },
  {
    icon: CodeRoundedIcon,
    title: 'REST API',
    description:
      'Send from your own backend with an API key. Status, text, media and templates, with the 24-hour window handled explicitly.',
  },
];

const STEPS = [
  {
    title: 'Create an account',
    description: 'Sign up with your mobile number. You do not need a WhatsApp Business Account to start.',
  },
  {
    title: 'Connect a number',
    description:
      'Connect through Meta’s own Embedded Signup. Your credentials are entered on Meta, never here.',
  },
  {
    title: 'Send and automate',
    description: 'Reply from the shared inbox, broadcast a template, and route events into your own systems.',
  },
];

function FeatureCard({ icon: Icon, title, description }) {
  return (
    <Paper
      variant="outlined"
      component={motion.div}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      <Box
        sx={(theme) => ({
          width: 40,
          height: 40,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          bgcolor: alpha(theme.palette.primary.main, 0.1),
          color: 'primary.main',
        })}
      >
        <Icon fontSize="small" />
      </Box>
      <Typography variant="h6">{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
        {description}
      </Typography>
    </Paper>
  );
}

export default function LandingPage() {
  const { isAuthenticated, isSessionLoading } = useAuth();
  const router = useRouter();

  // Redirecting during render would fire on the server too, where
  // isAuthenticated is always false because the session lives in localStorage.
  // An effect keeps this a client-only decision, with the marketing page as
  // the server-rendered default.
  useEffect(() => {
    if (!isSessionLoading && isAuthenticated) router.replace('/inbox');
  }, [isAuthenticated, isSessionLoading, router]);

  return (
    <Box>
      {/* Hero */}
      <Box
        sx={(theme) => ({
          position: 'relative',
          overflow: 'hidden',
          bgcolor: theme.palette.mode === 'light' ? 'background.paper' : 'background.default',
          borderBottom: '1px solid',
          borderColor: 'divider',
          py: { xs: 9, md: 14 },
          // A single soft wash of the brand colour rather than a full-bleed
          // gradient: the eye should land on the headline, not the background.
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(1000px 420px at 50% -10%, ${alpha(
              theme.palette.primary.main,
              theme.palette.mode === 'light' ? 0.1 : 0.16
            )}, transparent 70%)`,
            pointerEvents: 'none',
          },
        })}
      >
        <Container maxWidth="md" sx={{ position: 'relative', textAlign: 'center' }}>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Stack alignItems="center" spacing={3}>
              <Chip
                icon={<VerifiedRoundedIcon />}
                label="Built on the official WhatsApp Business Platform"
                variant="outlined"
                color="primary"
                sx={{ fontWeight: 600 }}
              />

              <Box sx={{ color: 'primary.main' }}>
                <BrandMark size={44} wordmarkVariant="h3" />
              </Box>

              <Typography variant="h2" sx={{ maxWidth: 720 }}>
                Run your customer conversations on WhatsApp, properly
              </Typography>

              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 620, lineHeight: 1.8 }}>
                A shared inbox, approved templates, broadcasts, automations and a REST API — all on
                Meta&apos;s Cloud API, with your own number connected through Meta&apos;s Embedded Signup.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
                <Button component={NextLink} href="/signup" variant="contained" size="large" sx={{ px: 4 }}>
                  Get started
                </Button>
                <Button component={NextLink} href="/login" variant="outlined" size="large" sx={{ px: 4 }}>
                  Sign in
                </Button>
              </Stack>

              <Typography variant="caption" color="text.secondary">
                No credit card required to connect your first number.
              </Typography>
            </Stack>
          </motion.div>
        </Container>
      </Box>

      {/* Features */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <Stack spacing={1.5} sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h3">Everything the platform gives you</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640, mx: 'auto' }}>
            One dashboard for the Cloud API — connect a number through Meta and start sending in minutes.
          </Typography>
        </Stack>

        <Grid container spacing={3}>
          {FEATURES.map((feature) => (
            <Grid item xs={12} sm={6} md={4} key={feature.title}>
              <FeatureCard {...feature} />
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* How it works */}
      <Box sx={{ bgcolor: 'background.paper', borderBlock: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
          <Stack spacing={1.5} sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="h3">From signup to first message</Typography>
            <Typography variant="body1" color="text.secondary">
              Three steps, and none of them involve sending us a screenshot.
            </Typography>
          </Stack>

          <Grid container spacing={4}>
            {STEPS.map((step, index) => (
              <Grid item xs={12} md={4} key={step.title}>
                <Stack spacing={1.5} sx={{ textAlign: 'center', px: 2 }}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      mx: 'auto',
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      fontWeight: 800,
                      fontSize: 18,
                    }}
                  >
                    {index + 1}
                  </Box>
                  <Typography variant="h6">{step.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    {step.description}
                  </Typography>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Close */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <Paper
          variant="outlined"
          sx={(theme) => ({
            textAlign: 'center',
            py: { xs: 6, md: 8 },
            px: 4,
            borderRadius: 4,
            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.06 : 0.12),
            borderColor: alpha(theme.palette.primary.main, 0.25),
          })}
        >
          <Stack spacing={2.5} alignItems="center">
            <Typography variant="h3">Ready to connect your number?</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 520 }}>
              Create an account and complete Meta&apos;s Embedded Signup — it takes a few minutes.
            </Typography>
            <Button component={NextLink} href="/signup" variant="contained" size="large" sx={{ px: 5 }}>
              Get started
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
