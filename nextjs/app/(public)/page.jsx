'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NextLink from 'next/link';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
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
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import ReviewsRoundedIcon from '@mui/icons-material/ReviewsRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import { useAuth } from '@/lib/ui/AuthContext';
import { ROUTES } from '@/lib/constants/routes';

const ODOO_PLUM = '#714B67';
const ODOO_PLUM_DARK = '#5B3C53';
const INK = '#26212A';
const MUTED = '#6D6871';
const SOFT = '#F7F6F8';
const LINE = '#E9E5EA';
const YELLOW = '#F5C451';
const AQUA = '#39C7B3';

const SERVICES = [
  { icon: WhatsAppIcon, title: 'WhatsApp', badge: 'Core', bg: '#E5F8ED', ink: '#147A48', text: 'Shared inbox, templates, broadcasts, automations and Meta Cloud API workflows.' },
  { icon: InstagramIcon, title: 'Instagram', badge: 'Beta', bg: '#FCE9F3', ink: '#B63D75', text: 'Messages, comments, private replies and publishing from the same workspace.' },
  { icon: StorefrontRoundedIcon, title: 'Google Business', badge: 'Beta', bg: '#EAF1FF', ink: '#3667B4', text: 'Reviews, AI reply drafts, posts and local Search/Maps performance.' },
  { icon: PeopleAltRoundedIcon, title: 'CRM', badge: 'Core', bg: '#F1EBFF', ink: '#7250B5', text: 'Leads, follow-ups, quotations, orders and customer history.' },
  { icon: Inventory2RoundedIcon, title: 'E-Store', badge: 'Core', bg: '#E8F8F6', ink: '#178E82', text: 'Catalogue, branded storefront, categories and customer enquiries.' },
  { icon: PhoneInTalkRoundedIcon, title: 'Dialer', badge: 'Beta', bg: '#FFF1E6', ink: '#B9662A', text: 'Click-to-call leads and connected call-history workflows.' },
  { icon: CampaignRoundedIcon, title: 'Marketing', badge: 'Pro', bg: '#FFF4D8', ink: '#9E6A00', text: 'Content planning, reusable assets and connected-channel publishing.' },
  { icon: TaskAltRoundedIcon, title: 'Staff & Tasks', badge: 'Pro', bg: '#EAF6FF', ink: '#2D7BAA', text: 'My Day, SOPs, responsibilities and attendance workflows.' },
  { icon: PaymentsRoundedIcon, title: 'Payments', badge: 'Pro', bg: '#F4ECF2', ink: '#714B67', text: 'Quotations, invoices, collections, reminders and business documents.' },
  { icon: SchoolRoundedIcon, title: 'Institute', badge: 'Pro', bg: '#EAF5E7', ink: '#4A8442', text: 'Admissions, fees, attendance, forms, ID cards and academic operations.' },
  { icon: MovieCreationRoundedIcon, title: 'Video Studio', badge: 'Beta', bg: '#F3EDFF', ink: '#6F51AA', text: 'Short-form video projects with scripts, scenes, voice and rendering workflows.' },
];

const PLATFORM_FEATURES = [
  { icon: BoltRoundedIcon, title: 'Automation without complexity', text: 'Start manual, then add schedules, rules and triggers only where they save real time.' },
  { icon: AutoAwesomeRoundedIcon, title: 'AI where it helps', text: 'Draft replies, posts and content with approval controls and practical guardrails.' },
  { icon: CodeRoundedIcon, title: 'Developer-ready', text: 'REST API keys, provider integrations, webhook destinations and signed delivery.' },
  { icon: SecurityRoundedIcon, title: 'One secure workspace', text: 'Tenant-scoped data, role-aware access and encrypted provider credentials.' },
];

const PLANS = [
  {
    name: 'Starter',
    price: '₹999',
    suffix: '/month',
    description: 'For micro and small businesses that want the essential customer and communication workspace.',
    features: ['WhatsApp workspace', 'Instagram workspace', 'Google Business Profile', 'Mini CRM', 'E-Store', 'Business Dialer', 'Video Studio', '1,000 included platform messages', 'REST API & webhooks'],
  },
  {
    name: 'Growth',
    price: '₹2,999',
    suffix: '/month',
    description: 'For teams that also need structured operations, finance, staff and publishing tools.',
    highlight: true,
    features: ['Everything in Starter', 'Marketing & Publisher', 'Staff & Tasks', 'Payments & Documents', 'Institute Management', '5,000 included platform messages', 'Lower platform overage rate', 'Built for regular campaigns and workflows'],
  },
];

const FAQS = [
  ['Is this only a WhatsApp tool?', 'No. WhatsApp is one channel inside a broader SMB workspace that also includes Instagram, Google Business Profile, CRM, store, staff, payments, institute tools, marketing, dialer and video workflows.'],
  ['Do I need a WhatsApp number before signing up?', 'No. You can create an account first, choose your business type and connect only the services you need.'],
  ['Can I keep using the WhatsApp Business app?', 'For eligible numbers, Meta’s coexistence flow can allow the WhatsApp Business app and Cloud API to work with the same number. Eligibility depends on Meta’s onboarding flow and account state.'],
  ['Are Meta charges included in the plan price?', 'The plan price is for the SanjuSK platform. Meta messaging charges and any applicable third-party provider usage are separate and follow the provider’s current pricing.'],
  ['Can I use my own domain for the E-Store?', 'The store supports public storefront URLs, and custom-domain support can be configured for businesses that need their own domain.'],
  ['Does Google review automation post every AI reply automatically?', 'No by default. Auto-reply is opt-in. You can set a minimum star rating, while lower-rated reviews can stay in an approval queue for manual review.'],
];

function AppTile({ service, compact = false }) {
  const Icon = service.icon;
  return (
    <Stack alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
      <Box
        sx={{
          width: compact ? { xs: 58, sm: 64 } : { xs: 64, sm: 72 },
          height: compact ? { xs: 58, sm: 64 } : { xs: 64, sm: 72 },
          borderRadius: 2.25,
          display: 'grid',
          placeItems: 'center',
          bgcolor: service.bg,
          color: service.ink,
          border: '1px solid rgba(37,32,40,0.05)',
          boxShadow: '0 9px 24px rgba(34, 26, 34, 0.08)',
          transition: 'transform .18s ease, box-shadow .18s ease',
          '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 14px 30px rgba(34, 26, 34, 0.12)' },
        }}
      >
        <Icon sx={{ fontSize: compact ? 30 : 34 }} />
      </Box>
      <Typography
        variant="caption"
        align="center"
        sx={{ color: INK, fontWeight: 700, lineHeight: 1.2, maxWidth: 92 }}
      >
        {service.title}
      </Typography>
    </Stack>
  );
}

function Highlight({ children, tone = 'yellow' }) {
  const color = tone === 'aqua' ? AQUA : YELLOW;
  return (
    <Box
      component="span"
      sx={{
        position: 'relative',
        display: 'inline-block',
        zIndex: 0,
        '&:after': {
          content: '""',
          position: 'absolute',
          left: '-2%',
          right: '-2%',
          bottom: '4%',
          height: '34%',
          bgcolor: color,
          opacity: 0.76,
          transform: 'rotate(-1.3deg)',
          borderRadius: '45% 55% 42% 58%',
          zIndex: -1,
        },
      }}
    >
      {children}
    </Box>
  );
}

function DashboardMock() {
  const rows = [
    ['New leads', 72],
    ['Follow-ups', 54],
    ['Payments due', 36],
  ];
  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: 3.5,
        borderColor: '#e7e3e8',
        boxShadow: '0 22px 60px rgba(54, 41, 53, 0.12)',
        bgcolor: '#fff',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Stack direction="row" spacing={0.7}>
          {[0, 1, 2].map((i) => <Box key={i} sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: i === 0 ? '#E46B65' : i === 1 ? '#E4B654' : '#54B878' }} />)}
        </Stack>
        <Typography variant="caption" sx={{ color: MUTED, fontWeight: 700 }}>Workspace overview</Typography>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.15fr .85fr' }, gap: 1.4 }}>
        <Box sx={{ p: 1.4, borderRadius: 2.5, bgcolor: SOFT }}>
          <Typography variant="caption" sx={{ color: MUTED, fontWeight: 700 }}>TODAY</Typography>
          <Typography sx={{ fontSize: { xs: 28, sm: 34 }, lineHeight: 1.1, fontWeight: 850, color: INK, mt: 0.4 }}>128</Typography>
          <Typography variant="caption" sx={{ color: MUTED }}>customer actions completed</Typography>
          <Stack spacing={1.2} sx={{ mt: 1.8 }}>
            {rows.map(([label, value]) => (
              <Box key={label}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
                  <Typography variant="caption" sx={{ color: INK, fontWeight: 650 }}>{label}</Typography>
                  <Typography variant="caption" sx={{ color: MUTED }}>{value}%</Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={value}
                  sx={{ height: 6, bgcolor: '#e6e1e7', '& .MuiLinearProgress-bar': { bgcolor: ODOO_PLUM } }}
                />
              </Box>
            ))}
          </Stack>
        </Box>
        <Stack spacing={1.1}>
          {[
            [ForumRoundedIcon, 'Inbox', '12 open'],
            [ReviewsRoundedIcon, 'Reviews', '4 new'],
            [ReceiptLongRoundedIcon, 'Invoices', '₹18.4k'],
          ].map(([Icon, label, value]) => (
            <Box key={label} sx={{ p: 1.25, border: `1px solid ${LINE}`, borderRadius: 2.4 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 2, bgcolor: '#F1EAF0', color: ODOO_PLUM }}>
                  <Icon sx={{ fontSize: 19 }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ display: 'block', color: MUTED }}>{label}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: INK }}>{value}</Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>
    </Paper>
  );
}

function PricingCard({ plan }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 3, md: 4 },
        height: '100%',
        borderRadius: 4,
        borderWidth: plan.highlight ? 2 : 1,
        borderColor: plan.highlight ? ODOO_PLUM : LINE,
        bgcolor: plan.highlight ? '#FBF7FA' : '#fff',
        position: 'relative',
      }}
    >
      {plan.highlight ? <Chip label="Popular" size="small" sx={{ position: 'absolute', top: 18, right: 18, bgcolor: ODOO_PLUM, color: '#fff', fontWeight: 800 }} /> : null}
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h5" sx={{ color: INK, fontWeight: 850 }}>{plan.name}</Typography>
          <Typography variant="body2" sx={{ color: MUTED, mt: 1, lineHeight: 1.65 }}>{plan.description}</Typography>
        </Box>
        <Stack direction="row" alignItems="baseline" spacing={0.75}>
          <Typography sx={{ fontSize: { xs: 36, md: 42 }, fontWeight: 850, color: INK }}>{plan.price}</Typography>
          <Typography sx={{ color: MUTED }}>{plan.suffix}</Typography>
        </Stack>
        <Stack spacing={1.15}>
          {plan.features.map((feature) => (
            <Stack key={feature} direction="row" spacing={1} alignItems="flex-start">
              <CheckCircleRoundedIcon sx={{ color: ODOO_PLUM, fontSize: 19, mt: '2px' }} />
              <Typography variant="body2" sx={{ color: '#4e4950' }}>{feature}</Typography>
            </Stack>
          ))}
        </Stack>
        <Button
          component={NextLink}
          href="/signup"
          variant={plan.highlight ? 'contained' : 'outlined'}
          size="large"
          fullWidth
          sx={plan.highlight ? { bgcolor: ODOO_PLUM, '&:hover': { bgcolor: ODOO_PLUM_DARK } } : { borderColor: ODOO_PLUM, color: ODOO_PLUM }}
        >
          Create account
        </Button>
      </Stack>
    </Paper>
  );
}

export default function LandingPage() {
  const { isAuthenticated, isSessionLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isSessionLoading && isAuthenticated) router.replace(ROUTES.DASHBOARD);
  }, [isAuthenticated, isSessionLoading, router]);

  return (
    <Box sx={{ bgcolor: '#fff', color: INK }}>
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          pt: { xs: 6.5, sm: 8, md: 10 },
          pb: { xs: 7, md: 10 },
          borderBottom: `1px solid ${LINE}`,
          '&:before': {
            content: '""',
            position: 'absolute',
            width: { xs: 260, md: 520 },
            height: { xs: 260, md: 520 },
            borderRadius: '50%',
            bgcolor: '#F3ECF1',
            right: { xs: -150, md: -170 },
            top: { xs: -130, md: -220 },
          },
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative' }}>
          <Grid container spacing={{ xs: 5, md: 8 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <Stack spacing={2.6} alignItems={{ xs: 'center', md: 'flex-start' }} textAlign={{ xs: 'center', md: 'left' }}>
                <Chip
                  label="One account · 11 connected business apps"
                  sx={{ bgcolor: '#F3ECF1', color: ODOO_PLUM, fontWeight: 800, borderRadius: 999 }}
                />
                <Typography
                  component="h1"
                  sx={{
                    fontSize: { xs: '2.55rem', sm: '3.4rem', md: '4.35rem' },
                    lineHeight: { xs: 1.06, md: 1.02 },
                    letterSpacing: '-0.045em',
                    fontWeight: 850,
                    maxWidth: 720,
                  }}
                >
                  All your business tools on <Highlight>one platform.</Highlight>
                </Typography>
                <Typography
                  sx={{
                    color: MUTED,
                    fontSize: { xs: '1.05rem', md: '1.2rem' },
                    lineHeight: 1.65,
                    maxWidth: 650,
                  }}
                >
                  WhatsApp, Instagram, Google Business Profile, CRM, store, staff, payments, marketing and more — connected in a workspace built for small businesses.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                  <Button
                    component={NextLink}
                    href="/signup"
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForwardRoundedIcon />}
                    sx={{ bgcolor: ODOO_PLUM, px: 3.25, minWidth: 170, '&:hover': { bgcolor: ODOO_PLUM_DARK } }}
                  >
                    Start free
                  </Button>
                  <Button
                    component={NextLink}
                    href="/#pricing"
                    variant="outlined"
                    size="large"
                    sx={{ borderColor: '#D7CFD5', color: INK, px: 3.25, minWidth: 170 }}
                  >
                    See pricing
                  </Button>
                </Stack>
                <Typography variant="caption" sx={{ color: MUTED }}>
                  No credit card to create an account · Choose only the services you need
                </Typography>
              </Stack>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  maxWidth: 560,
                  mx: 'auto',
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
                  gap: { xs: 2.2, sm: 2.7 },
                  p: { xs: 1.5, sm: 2 },
                }}
              >
                {SERVICES.slice(0, 11).map((service) => <AppTile key={service.title} service={service} />)}
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box id="services" sx={{ bgcolor: SOFT, py: { xs: 7, md: 10 }, borderBottom: `1px solid ${LINE}` }}>
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 5, md: 8 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Stack spacing={2.2}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography sx={{ color: ODOO_PLUM, fontWeight: 850 }}>View all Apps</Typography>
                  <ArrowForwardRoundedIcon sx={{ color: ODOO_PLUM }} />
                </Stack>
                <Typography sx={{ fontSize: { xs: '2rem', md: '3rem' }, lineHeight: 1.1, fontWeight: 850, letterSpacing: '-0.035em' }}>
                  A full business toolkit, without the usual <Highlight tone="aqua">complexity.</Highlight>
                </Typography>
                <Typography sx={{ color: MUTED, lineHeight: 1.8, fontSize: '1.02rem' }}>
                  Each app handles a real process, while customer data and account access stay connected. Start small, then add tools when your workflow needs them.
                </Typography>
                <Button component={NextLink} href="/signup" endIcon={<ArrowOutwardRoundedIcon />} sx={{ alignSelf: 'flex-start', color: ODOO_PLUM, fontWeight: 800, px: 0 }}>
                  Build your workspace
                </Button>
              </Stack>
            </Grid>
            <Grid item xs={12} md={7}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(3, minmax(0,1fr))', sm: 'repeat(4, minmax(0,1fr))' },
                  gap: { xs: 2, sm: 2.5 },
                }}
              >
                {SERVICES.map((service) => <AppTile key={service.title} service={service} compact />)}
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <Grid container spacing={{ xs: 5, md: 9 }} alignItems="center">
          <Grid item xs={12} md={6}>
            <DashboardMock />
          </Grid>
          <Grid item xs={12} md={6}>
            <Stack spacing={2.2}>
              <Typography variant="overline" sx={{ color: ODOO_PLUM, fontWeight: 900, letterSpacing: '.12em' }}>OPTIMIZED FOR PRODUCTIVITY</Typography>
              <Typography sx={{ fontSize: { xs: '2.2rem', md: '3.2rem' }, fontWeight: 850, lineHeight: 1.08, letterSpacing: '-0.04em' }}>
                Less switching. Less repeated entry. More work finished.
              </Typography>
              <Typography sx={{ color: MUTED, lineHeight: 1.8, fontSize: '1.02rem' }}>
                Keep conversations, leads, follow-ups, reviews, invoices and operations close together, so the team does not have to rebuild context in separate apps.
              </Typography>
              <Stack spacing={1.2}>
                {['Shared customer context across modules', 'Responsive mobile and desktop workspace', 'Human-first automation with optional AI'].map((item) => (
                  <Stack key={item} direction="row" spacing={1.1} alignItems="center">
                    <CheckCircleRoundedIcon sx={{ color: ODOO_PLUM, fontSize: 20 }} />
                    <Typography sx={{ color: '#49444b', fontWeight: 650 }}>{item}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Grid>
        </Grid>
      </Container>

      <Box sx={{ bgcolor: '#FBF8FB', borderBlock: `1px solid ${LINE}` }}>
        <Container maxWidth="lg" sx={{ py: { xs: 8, md: 11 } }}>
          <Stack spacing={1.5} textAlign="center" sx={{ mb: 5.5 }}>
            <Typography variant="overline" sx={{ color: ODOO_PLUM, fontWeight: 900, letterSpacing: '.12em' }}>NATIVE AUTOMATION</Typography>
            <Typography sx={{ fontSize: { xs: '2.15rem', md: '3.1rem' }, fontWeight: 850, letterSpacing: '-0.035em' }}>
              Build a system that does more of the routine work.
            </Typography>
          </Stack>
          <Grid container spacing={2.5}>
            {PLATFORM_FEATURES.map(({ icon: Icon, title, text }) => (
              <Grid item xs={12} sm={6} md={3} key={title}>
                <Paper variant="outlined" sx={{ p: 3, height: '100%', borderRadius: 3.5, borderColor: LINE, bgcolor: '#fff' }}>
                  <Box sx={{ width: 46, height: 46, borderRadius: 2.4, display: 'grid', placeItems: 'center', bgcolor: '#F1EAF0', color: ODOO_PLUM }}>
                    <Icon />
                  </Box>
                  <Typography variant="h6" sx={{ mt: 2, fontWeight: 800, color: INK }}>{title}</Typography>
                  <Typography variant="body2" sx={{ mt: 1, color: MUTED, lineHeight: 1.75 }}>{text}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 11 } }}>
        <Stack spacing={1.5} textAlign="center" sx={{ mb: 5 }}>
          <Typography variant="overline" sx={{ color: ODOO_PLUM, fontWeight: 900, letterSpacing: '.12em' }}>EVERYDAY WORKFLOWS</Typography>
          <Typography sx={{ fontSize: { xs: '2.1rem', md: '3rem' }, fontWeight: 850, letterSpacing: '-0.035em' }}>
            One workspace from first enquiry to final payment.
          </Typography>
          <Typography sx={{ maxWidth: 760, mx: 'auto', color: MUTED, lineHeight: 1.75 }}>
            Connect the work that normally gets scattered across chats, spreadsheets and disconnected tools.
          </Typography>
        </Stack>
        <Grid container spacing={2.4}>
          {SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <Grid item xs={12} sm={6} md={4} key={service.title}>
                <Paper variant="outlined" sx={{ p: 2.75, height: '100%', borderRadius: 3.2, borderColor: LINE }}>
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: 2.2, display: 'grid', placeItems: 'center', bgcolor: service.bg, color: service.ink }}><Icon /></Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 800, color: INK }}>{service.title}</Typography>
                      <Typography variant="caption" sx={{ color: MUTED }}>{service.badge}</Typography>
                    </Box>
                  </Stack>
                  <Typography variant="body2" sx={{ color: MUTED, lineHeight: 1.72 }}>{service.text}</Typography>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      </Container>

      <Box id="pricing" sx={{ bgcolor: SOFT, borderBlock: `1px solid ${LINE}` }}>
        <Container maxWidth="md" sx={{ py: { xs: 8, md: 11 } }}>
          <Stack spacing={1.5} textAlign="center" sx={{ mb: 5 }}>
            <Typography variant="overline" sx={{ color: ODOO_PLUM, fontWeight: 900, letterSpacing: '.12em' }}>SIMPLE PRICING</Typography>
            <Typography sx={{ fontSize: { xs: '2.2rem', md: '3.1rem' }, fontWeight: 850, letterSpacing: '-0.035em' }}>Start small. Add more when you need it.</Typography>
            <Typography sx={{ color: MUTED }}>Create your account first, then choose a paid plan when you are ready for production use.</Typography>
          </Stack>
          <Grid container spacing={3}>
            {PLANS.map((plan) => (
              <Grid item xs={12} md={6} key={plan.name}>
                <PricingCard plan={plan} />
              </Grid>
            ))}
          </Grid>
          <Alert severity="info" sx={{ mt: 3, borderRadius: 3 }}>
            Platform pricing does not replace charges from Meta or other connected providers. WhatsApp messaging charges and optional third-party usage follow the provider’s current rates.
          </Alert>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 11 } }}>
        <Grid container spacing={4}>
          {[
            ['01', 'Create your account', 'Sign up and choose your business type.'],
            ['02', 'Pick your apps', 'Use only the tools that match your workflow.'],
            ['03', 'Connect providers', 'Link WhatsApp, Instagram, Google and optional services.'],
            ['04', 'Automate gradually', 'Add AI, schedules and rules when they clearly save time.'],
          ].map(([n, title, text]) => (
            <Grid item xs={12} sm={6} md={3} key={n}>
              <Box sx={{ borderTop: `3px solid ${n === '01' ? YELLOW : ODOO_PLUM}`, pt: 2 }}>
                <Typography sx={{ color: MUTED, fontWeight: 800 }}>{n}</Typography>
                <Typography variant="h6" sx={{ fontWeight: 850, mt: 1, color: INK }}>{title}</Typography>
                <Typography variant="body2" sx={{ color: MUTED, mt: 1, lineHeight: 1.7 }}>{text}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Box id="faq" sx={{ bgcolor: '#FBF8FB', borderTop: `1px solid ${LINE}` }}>
        <Container maxWidth="md" sx={{ py: { xs: 8, md: 11 } }}>
          <Stack spacing={1.5} textAlign="center" sx={{ mb: 4.5 }}>
            <Typography variant="overline" sx={{ color: ODOO_PLUM, fontWeight: 900, letterSpacing: '.12em' }}>FAQ</Typography>
            <Typography sx={{ fontSize: { xs: '2.05rem', md: '2.85rem' }, fontWeight: 850, letterSpacing: '-0.035em' }}>Questions before you sign up</Typography>
          </Stack>
          <Stack spacing={1.15}>
            {FAQS.map(([q, a]) => (
              <Accordion key={q} disableGutters elevation={0} sx={{ bgcolor: '#fff', border: `1px solid ${LINE}`, borderRadius: '14px !important', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} sx={{ px: { xs: 2, sm: 2.5 } }}>
                  <Typography sx={{ fontWeight: 800, color: INK }}>{q}</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: { xs: 2, sm: 2.5 }, pb: 2.5 }}>
                  <Divider sx={{ mb: 2 }} />
                  <Typography sx={{ color: MUTED, lineHeight: 1.75 }}>{a}</Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 11 } }}>
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            bgcolor: '#F0E7EE',
            borderRadius: { xs: 3.5, md: 5 },
            px: { xs: 3, sm: 5, md: 8 },
            py: { xs: 5, md: 7 },
            textAlign: 'center',
          }}
        >
          <Box sx={{ position: 'absolute', width: 170, height: 170, borderRadius: '50%', bgcolor: YELLOW, opacity: 0.28, top: -90, right: -30 }} />
          <Stack spacing={2.2} alignItems="center" sx={{ position: 'relative' }}>
            <Typography sx={{ fontSize: { xs: '2.05rem', md: '3.35rem' }, fontWeight: 850, lineHeight: 1.08, letterSpacing: '-0.04em', maxWidth: 850 }}>
              Simplify the everyday work and make room for your <Highlight tone="aqua">next big idea.</Highlight>
            </Typography>
            <Typography sx={{ color: '#625b64', maxWidth: 680, lineHeight: 1.75 }}>
              One login, one customer workspace and fewer disconnected tools for your team.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ width: { xs: '100%', sm: 'auto' } }}>
              <Button component={NextLink} href="/signup" variant="contained" size="large" sx={{ bgcolor: ODOO_PLUM, px: 3.2, '&:hover': { bgcolor: ODOO_PLUM_DARK } }}>Start now — it’s free</Button>
              <Button component={NextLink} href="/contact" variant="outlined" size="large" sx={{ color: ODOO_PLUM, borderColor: ODOO_PLUM, px: 3.2 }}>Talk to us</Button>
            </Stack>
            <Typography variant="caption" sx={{ color: MUTED }}>No credit card required · Instant account access</Typography>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
