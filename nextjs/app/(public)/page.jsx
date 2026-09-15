'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NextLink from 'next/link';
import { Box, Button, Chip, Container, Grid, Paper, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import InstagramIcon from '@mui/icons-material/Instagram';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import PhoneInTalkRoundedIcon from '@mui/icons-material/PhoneInTalkRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import MovieCreationRoundedIcon from '@mui/icons-material/MovieCreationRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import HubRoundedIcon from '@mui/icons-material/HubRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/ui/AuthContext';
import { ROUTES } from '@/lib/constants/routes';
import BrandMark from '@/lib/ui/app/BrandMark';

/**
 * The landing page.
 *
 * It used to sell one product: the WhatsApp Cloud API. Every feature card, both
 * calls to action and the headline itself were about connecting a number — which
 * was accurate when the dashboard had a single service, and became a steadily
 * worse description of the product as ten more shipped behind it. A visitor
 * comparing us against a WhatsApp-only vendor had no way to learn that the
 * reviews, the CRM, the invoices and the staff tasks were in the same box.
 *
 * So the page now leads with the workspace and treats WhatsApp as the first and
 * busiest channel in it. What has *not* changed is the compliance statement: the
 * Meta-review surface depends on this page saying plainly that messaging runs on
 * the official WhatsApp Business Platform, so that claim stays, in its own right
 * rather than as the whole identity.
 *
 * Nothing here is aspirational, and that is a standard this page has already
 * failed once: the first version of it claimed one customer record across every
 * channel, which is true of WhatsApp and not of Instagram, whose conversations
 * are read straight from the Graph API and never persisted against a Contact.
 * A claim about a service belongs here only once the code behind it is real —
 * so each card says what its own service does, the Pro ones say they are Pro,
 * and the two that are still partial say which part.
 */

/** The three places a customer can reach the business. */
const CHANNELS = [
  {
    icon: WhatsAppIcon,
    title: 'WhatsApp',
    description:
      'A shared inbox on Meta’s official Cloud API, on the same contact record as the CRM — delivery and read receipts, media, assignment so two people never answer the same customer, approved templates and broadcasts that retry on their own.',
  },
  {
    icon: InstagramIcon,
    title: 'Instagram',
    description:
      'Direct messages, comments and private replies from the same dashboard, and publishing without leaving it. Instagram conversations are not yet written to the shared contact record.',
  },
  {
    icon: StorefrontRoundedIcon,
    title: 'Google Business Profile',
    description:
      'The reviews and Search/Maps performance behind your listing, with AI-drafted replies and profile posts you approve before anything goes public.',
  },
];

/** The business the channels feed into. */
const WORKSPACE = [
  {
    icon: PeopleAltRoundedIcon,
    title: 'Customers and leads',
    description:
      'One contact record per customer, shared by WhatsApp and every business tool here. Tag and segment, import from a spreadsheet, and track a lead from first message to follow-up to quotation.',
  },
  {
    icon: Inventory2RoundedIcon,
    title: 'Products and stock',
    description: 'A catalogue, inventory movements and review requests, linked to the same customers and orders.',
  },
  {
    icon: PaymentsRoundedIcon,
    title: 'Quotations, invoices and payments',
    description: 'Quotations that become orders, customer invoices, collections, outstanding balances and expenses.',
    tier: 'Pro',
  },
  {
    icon: TaskAltRoundedIcon,
    title: 'Staff, tasks and attendance',
    description: 'Who is responsible for what, biometric and WhatsApp attendance, and the tasks that came out of a conversation.',
    tier: 'Pro',
  },
  {
    icon: PhoneInTalkRoundedIcon,
    title: 'Business dialer',
    description: 'Click-to-dial your leads and sync the call history back against the contact it belongs to.',
  },
  {
    icon: CampaignRoundedIcon,
    title: 'Marketing and publishing',
    description: 'Compose a post and publish it to Instagram from the shared workspace. Facebook Pages and Google Business Profile are in the publisher but stay locked until their connections are added.',
    tier: 'Pro',
  },
  {
    icon: MovieCreationRoundedIcon,
    title: 'Video studio',
    description: 'Turn one idea into a finished short — script, characters, scene stills, clips, voice-over and the final cut.',
  },
  {
    icon: SchoolRoundedIcon,
    title: 'Institute management',
    description: 'Admissions, academics, fees, attendance, ID cards and forms, for a coaching class or school on the same workspace.',
    tier: 'Pro',
  },
];

/** What makes it a platform rather than a set of screens. */
const PLATFORM = [
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
    description: 'Sign up with your mobile number. Nothing else is required to get in and look around.',
  },
  {
    title: 'Connect your channels',
    description:
      'Connect WhatsApp through Meta’s Embedded Signup or your own access token, then add Instagram and your Google Business Profile when you want them.',
  },
  {
    title: 'Run the business from one place',
    description: 'Answer customers, chase leads, raise an invoice, post to your listing and see what it all did.',
  },
];

function FeatureCard({ icon: Icon, title, description, tier }) {
  return (
    <Paper
      variant="outlined"
      component={motion.div}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
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
        {/* Said out loud rather than discovered at the lock screen. */}
        {tier ? <Chip label={tier} size="small" variant="outlined" sx={{ fontWeight: 700 }} /> : null}
      </Stack>
      <Typography variant="h6">{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
        {description}
      </Typography>
    </Paper>
  );
}

function Section({ title, subtitle, items, columns = 4 }) {
  return (
    <>
      <Stack spacing={1.5} sx={{ textAlign: 'center', mb: 6 }}>
        <Typography variant="h3">{title}</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 680, mx: 'auto' }}>
          {subtitle}
        </Typography>
      </Stack>
      <Grid container spacing={3}>
        {items.map((item) => (
          <Grid item xs={12} sm={6} md={12 / columns} key={item.title}>
            <FeatureCard {...item} />
          </Grid>
        ))}
      </Grid>
    </>
  );
}

export default function LandingPage() {
  const { isAuthenticated, isSessionLoading } = useAuth();
  const router = useRouter();

  // Redirecting during render would fire on the server too, where
  // isAuthenticated is always false because the session lives in localStorage.
  // An effect keeps this a client-only decision, with the marketing page as
  // the server-rendered default.
  //
  // The hub, not the inbox: a signed-in owner may be coming back for the
  // reviews or the invoices, and sending everyone to WhatsApp made the other
  // ten services something you had to already know were there.
  useEffect(() => {
    if (!isSessionLoading && isAuthenticated) router.replace(ROUTES.DASHBOARD);
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
                label="Messaging on the official WhatsApp Business Platform"
                variant="outlined"
                color="primary"
                sx={{ fontWeight: 600 }}
              />

              <Box sx={{ color: 'primary.main' }}>
                <BrandMark size={44} wordmarkVariant="h3" />
              </Box>

              <Typography variant="h2" sx={{ maxWidth: 760 }}>
                Run the whole business, not just the chat
              </Typography>

              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 660, lineHeight: 1.8 }}>
                WhatsApp, Instagram and your Google Business Profile in one dashboard — on top of the
                CRM, catalogue, invoices, staff tasks and automations behind them. One workspace and one
                bill, instead of a separate tool for each.
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
                No credit card required to create an account and connect your first channel.
              </Typography>
            </Stack>
          </motion.div>
        </Container>
      </Box>

      {/* Channels */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <Section
          title="Every channel, one dashboard"
          subtitle="Answer customers wherever they find you, without a browser tab and a login for each one."
          items={CHANNELS}
          columns={3}
        />
      </Container>

      {/* Workspace */}
      <Box sx={{ bgcolor: 'background.paper', borderBlock: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
          <Section
            title="And the business behind them"
            subtitle="The conversation is the start of the work, not the end of it. WhatsApp, the CRM, the catalogue and the invoices all share one customer record — no second database, no re-typing a name."
            items={WORKSPACE}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 4 }}>
            Services marked Pro are included on the Pro plan or enabled by your administrator. Everything else
            comes with the account.
          </Typography>
        </Container>
      </Box>

      {/* Platform */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <Section
          title="Built to connect to what you already run"
          subtitle="Your own backend, your own endpoints, and rules that answer customers while you are asleep."
          items={PLATFORM}
          columns={3}
        />
      </Container>

      {/* How it works */}
      <Box sx={{ bgcolor: 'background.paper', borderBlock: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
          <Stack spacing={1.5} sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="h3">From signup to running</Typography>
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
            <Typography variant="h3">Ready to put it all in one place?</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560 }}>
              Create an account, connect your first channel, and bring the rest across whenever you are ready.
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
