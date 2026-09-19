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
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
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
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/ui/AuthContext';
import { ROUTES } from '@/lib/constants/routes';
import BrandMark from '@/lib/ui/app/BrandMark';

const SERVICES = [
  { icon: WhatsAppIcon, title: 'WhatsApp Business', badge: 'Core', text: 'Shared inbox, templates, broadcasts, automations, media, team assignment, API keys and webhooks on Meta’s official Cloud API.' },
  { icon: InstagramIcon, title: 'Instagram', badge: 'Beta', text: 'Read and respond to messages and comments, send private replies and publish content from the same dashboard.' },
  { icon: StorefrontRoundedIcon, title: 'Google Business Profile', badge: 'Beta', text: 'Reviews, AI reply drafts, optional review automation, profile posts and Search/Maps performance.' },
  { icon: PeopleAltRoundedIcon, title: 'Mini CRM', badge: 'Core', text: 'Leads, follow-ups, quotations, orders, customer history and a simple job board without maintaining a second customer database.' },
  { icon: Inventory2RoundedIcon, title: 'E-Store', badge: 'Core', text: 'Public product catalogue, branded store profile, categories, enquiries and customer-facing product discovery.' },
  { icon: PhoneInTalkRoundedIcon, title: 'Business Dialer', badge: 'Beta', text: 'Click-to-call leads and sync call history through the connected Business Call Manager service.' },
  { icon: CampaignRoundedIcon, title: 'Marketing & Publisher', badge: 'Pro', text: 'Plan content, keep a reusable content library and publish to connected channels from one workspace.' },
  { icon: TaskAltRoundedIcon, title: 'Staff & Tasks', badge: 'Pro', text: 'My Day, tasks, SOPs, responsibility tracking, WhatsApp attendance and biometric attendance integration.' },
  { icon: PaymentsRoundedIcon, title: 'Payments & Documents', badge: 'Pro', text: 'Quotations, customer invoices, collections, payment reminders, purchase orders, rate cards and printable documents.' },
  { icon: SchoolRoundedIcon, title: 'Institute Management', badge: 'Pro', text: 'Admissions, academics, fees, attendance, ID cards, forms, staff and institute operations.' },
  { icon: MovieCreationRoundedIcon, title: 'Video Studio', badge: 'Beta', text: 'Create short-form video projects with scripts, scenes, images, clips, voice and rendering workflows.' },
];

const PLATFORM_FEATURES = [
  { icon: BoltRoundedIcon, title: 'Automation', text: 'Keyword replies, scheduled workflows, delays and rule-based customer actions.' },
  { icon: AutoAwesomeRoundedIcon, title: 'AI assistance', text: 'Draft review replies, posts and other content with safety limits and human approval where appropriate.' },
  { icon: CodeRoundedIcon, title: 'Developer API', text: 'REST API keys, message APIs, webhook destinations and signed webhook delivery.' },
  { icon: SecurityRoundedIcon, title: 'Secure multi-tenant workspace', text: 'Tenant-scoped data, encrypted provider credentials, signed webhooks and role-aware access.' },
];

const USE_CASES = [
  ['Sales', 'Capture leads from WhatsApp, follow up, create quotations and convert confirmed work into orders.'],
  ['Support', 'Keep customer conversations in one shared inbox with assignment and delivery/read visibility.'],
  ['Local growth', 'Manage Google reviews, send review requests and publish updates to your business profile.'],
  ['Operations', 'Track jobs, staff responsibilities, SOP tasks, collections, vendors and due work.'],
  ['Retail & services', 'Publish a simple E-Store and connect enquiries back to the same business workspace.'],
  ['Education', 'Run admissions, fees, attendance, forms and ID-card workflows from the Institute module.'],
];

const PLANS = [
  {
    name: 'Starter',
    price: '₹999',
    suffix: '/month',
    description: 'For micro and small businesses that want the essential customer and communication workspace.',
    highlight: false,
    features: [
      'WhatsApp workspace',
      'Instagram workspace',
      'Google Business Profile',
      'Mini CRM',
      'E-Store',
      'Business Dialer',
      'Video Studio',
      '1,000 included platform messages',
      'REST API & webhooks',
    ],
  },
  {
    name: 'Growth',
    price: '₹2,999',
    suffix: '/month',
    description: 'For teams that also need structured operations, finance, staff and publishing tools.',
    highlight: true,
    features: [
      'Everything in Starter',
      'Marketing & Publisher',
      'Staff & Tasks',
      'Payments & Documents',
      'Institute Management',
      '5,000 included platform messages',
      'Lower platform overage rate',
      'Built for regular campaigns and workflows',
    ],
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

function ServiceCard({ icon: Icon, title, text, badge }) {
  return (
    <Paper
      variant="outlined"
      component={motion.div}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.18 }}
      sx={{ p: 3, height: '100%', borderRadius: 3 }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Box
            sx={(theme) => ({
              width: 44,
              height: 44,
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: 'primary.main',
            })}
          >
            <Icon />
          </Box>
          <Chip size="small" label={badge} variant={badge === 'Pro' ? 'filled' : 'outlined'} color={badge === 'Pro' ? 'primary' : 'default'} />
        </Stack>
        <Typography variant="h6" fontWeight={750}>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>{text}</Typography>
      </Stack>
    </Paper>
  );
}

function PricingCard({ plan }) {
  return (
    <Paper
      variant="outlined"
      sx={(theme) => ({
        p: { xs: 3, md: 4 },
        height: '100%',
        borderRadius: 4,
        borderWidth: plan.highlight ? 2 : 1,
        borderColor: plan.highlight ? 'primary.main' : 'divider',
        position: 'relative',
        bgcolor: plan.highlight ? alpha(theme.palette.primary.main, 0.04) : 'background.paper',
      })}
    >
      {plan.highlight ? <Chip label="Most complete" color="primary" size="small" sx={{ position: 'absolute', top: 18, right: 18 }} /> : null}
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h5" fontWeight={800}>{plan.name}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{plan.description}</Typography>
        </Box>
        <Box>
          <Stack direction="row" spacing={0.75} alignItems="baseline">
            <Typography variant="h3" fontWeight={850}>{plan.price}</Typography>
            <Typography color="text.secondary">{plan.suffix}</Typography>
          </Stack>
        </Box>
        <Stack spacing={1.25}>
          {plan.features.map((feature) => (
            <Stack direction="row" spacing={1} alignItems="flex-start" key={feature}>
              <CheckCircleRoundedIcon color="primary" sx={{ fontSize: 19, mt: '2px' }} />
              <Typography variant="body2">{feature}</Typography>
            </Stack>
          ))}
        </Stack>
        <Button component={NextLink} href="/signup" size="large" variant={plan.highlight ? 'contained' : 'outlined'} fullWidth>
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
    <Box>
      <Box
        sx={(theme) => ({
          position: 'relative',
          overflow: 'hidden',
          borderBottom: '1px solid',
          borderColor: 'divider',
          py: { xs: 8, md: 13 },
          background: theme.palette.mode === 'light'
            ? `radial-gradient(900px 420px at 70% 0%, ${alpha(theme.palette.primary.main, 0.14)}, transparent 72%), linear-gradient(180deg, #fff 0%, ${alpha(theme.palette.primary.main, 0.035)} 100%)`
            : `radial-gradient(900px 420px at 70% 0%, ${alpha(theme.palette.primary.main, 0.18)}, transparent 72%)`,
        })}
      >
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={7}>
              <Stack spacing={3} alignItems={{ xs: 'center', md: 'flex-start' }} textAlign={{ xs: 'center', md: 'left' }}>
                <Chip label="One workspace for customer communication + business operations" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
                <Box sx={{ color: 'primary.main' }}><BrandMark size={44} wordmarkVariant="h3" /></Box>
                <Typography variant="h2" sx={{ maxWidth: 780, fontWeight: 850 }}>
                  Run your business from one dashboard
                </Typography>
                <Typography variant="h6" color="text.secondary" fontWeight={400} sx={{ maxWidth: 760, lineHeight: 1.65 }}>
                  WhatsApp, Instagram and Google Business Profile together with CRM, E-Store, payments, staff, marketing,
                  institute tools, dialer and video workflows. Less switching between apps, more work completed in one system.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button component={NextLink} href="/signup" variant="contained" size="large" sx={{ px: 4 }}>Start free</Button>
                  <Button component="a" href="#pricing" variant="outlined" size="large" sx={{ px: 4 }}>See pricing</Button>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} color="text.secondary">
                  <Typography variant="body2">No credit card to create an account</Typography>
                  <Typography variant="body2">Official provider APIs</Typography>
                  <Typography variant="body2">Choose only the services you need</Typography>
                </Stack>
              </Stack>
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 4 }}>
                <Typography variant="overline" color="primary.main" fontWeight={800}>What one account can manage</Typography>
                <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                  {['Customer messages', 'Leads & follow-ups', 'Reviews & local presence', 'Orders & payments', 'Staff & tasks', 'Marketing & content'].map((item) => (
                    <Stack key={item} direction="row" spacing={1.2} alignItems="center">
                      <CheckCircleRoundedIcon color="primary" fontSize="small" />
                      <Typography fontWeight={650}>{item}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container id="use-cases" maxWidth="lg" sx={{ py: { xs: 8, md: 11 } }}>
        <Stack spacing={1.5} textAlign="center" sx={{ mb: 6 }}>
          <Typography variant="overline" color="primary.main" fontWeight={800}>What you can do</Typography>
          <Typography variant="h3" fontWeight={800}>From first enquiry to final payment</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 760, mx: 'auto' }}>
            Customer communication is only the beginning. SanjuSK connects the follow-up work that usually gets scattered across chats, spreadsheets and separate apps.
          </Typography>
        </Stack>
        <Grid container spacing={2.5}>
          {USE_CASES.map(([title, text]) => (
            <Grid item xs={12} sm={6} md={4} key={title}>
              <Paper variant="outlined" sx={{ p: 3, height: '100%', borderRadius: 3 }}>
                <Typography variant="h6" fontWeight={750}>{title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.7 }}>{text}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Box id="services" sx={{ bgcolor: 'background.paper', borderBlock: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg" sx={{ py: { xs: 8, md: 11 } }}>
          <Stack spacing={1.5} textAlign="center" sx={{ mb: 6 }}>
            <Typography variant="overline" color="primary.main" fontWeight={800}>All services</Typography>
            <Typography variant="h3" fontWeight={800}>11 services, one account</Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 760, mx: 'auto' }}>
              Start with the channels and tools your business needs now. Your business profile controls which services appear after signup.
            </Typography>
          </Stack>
          <Grid container spacing={2.5}>
            {SERVICES.map((service) => (
              <Grid item xs={12} sm={6} md={4} key={service.title}>
                <ServiceCard {...service} />
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 11 } }}>
        <Stack spacing={1.5} textAlign="center" sx={{ mb: 6 }}>
          <Typography variant="overline" color="primary.main" fontWeight={800}>Platform</Typography>
          <Typography variant="h3" fontWeight={800}>Built for automation, not more manual work</Typography>
        </Stack>
        <Grid container spacing={2.5}>
          {PLATFORM_FEATURES.map(({ icon: Icon, title, text }) => (
            <Grid item xs={12} sm={6} md={3} key={title}>
              <Paper variant="outlined" sx={{ p: 3, height: '100%', borderRadius: 3 }}>
                <Icon color="primary" />
                <Typography variant="h6" fontWeight={750} sx={{ mt: 1.5 }}>{title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.7 }}>{text}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Box id="pricing" sx={{ bgcolor: 'background.paper', borderBlock: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="md" sx={{ py: { xs: 8, md: 11 } }}>
          <Stack spacing={1.5} textAlign="center" sx={{ mb: 6 }}>
            <Typography variant="overline" color="primary.main" fontWeight={800}>Pricing</Typography>
            <Typography variant="h3" fontWeight={800}>Simple plans for small businesses</Typography>
            <Typography color="text.secondary">
              Create the account first. Choose a paid plan when you are ready to use the platform in production.
            </Typography>
          </Stack>
          <Grid container spacing={3}>
            {PLANS.map((plan) => (
              <Grid item xs={12} md={6} key={plan.name}>
                <PricingCard plan={plan} />
              </Grid>
            ))}
          </Grid>
          <Alert severity="info" sx={{ mt: 3 }}>
            Platform pricing does not replace charges from Meta or other connected providers. WhatsApp messaging charges and optional third-party usage are billed according to the provider’s current rates.
          </Alert>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 11 } }}>
        <Stack spacing={1.5} textAlign="center" sx={{ mb: 6 }}>
          <Typography variant="overline" color="primary.main" fontWeight={800}>How it works</Typography>
          <Typography variant="h3" fontWeight={800}>Setup without rebuilding your business</Typography>
        </Stack>
        <Grid container spacing={3}>
          {[
            ['1', 'Create your account', 'Sign up with your mobile number and choose your business type.'],
            ['2', 'Choose your toolkit', 'Select the services relevant to your business instead of seeing every module by default.'],
            ['3', 'Connect providers', 'Connect WhatsApp, Instagram, Google Business Profile and any optional providers you need.'],
            ['4', 'Automate gradually', 'Start with manual workflows, then enable AI, schedules and automation where they save real time.'],
          ].map(([n, title, text]) => (
            <Grid item xs={12} sm={6} md={3} key={n}>
              <Stack spacing={1.5} textAlign="center">
                <Box sx={{ width: 46, height: 46, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center', mx: 'auto', fontWeight: 850 }}>{n}</Box>
                <Typography variant="h6" fontWeight={750}>{title}</Typography>
                <Typography variant="body2" color="text.secondary">{text}</Typography>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Box id="faq" sx={{ bgcolor: 'background.paper', borderBlock: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="md" sx={{ py: { xs: 8, md: 11 } }}>
          <Stack spacing={1.5} textAlign="center" sx={{ mb: 5 }}>
            <Typography variant="overline" color="primary.main" fontWeight={800}>FAQ</Typography>
            <Typography variant="h3" fontWeight={800}>Questions before you sign up</Typography>
          </Stack>
          <Stack spacing={1.25}>
            {FAQS.map(([q, a]) => (
              <Accordion key={q} disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px !important', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                  <Typography fontWeight={700}>{q}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Divider sx={{ mb: 2 }} />
                  <Typography color="text.secondary" sx={{ lineHeight: 1.75 }}>{a}</Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 11 } }}>
        <Paper
          variant="outlined"
          sx={(theme) => ({
            p: { xs: 4, md: 7 },
            textAlign: 'center',
            borderRadius: 4,
            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.06 : 0.12),
            borderColor: alpha(theme.palette.primary.main, 0.3),
          })}
        >
          <Stack spacing={2.5} alignItems="center">
            <Typography variant="h3" fontWeight={850}>One login. One customer workspace. Fewer separate tools.</Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 700 }}>
              Start with the services that solve today’s problem and add the rest when your business needs them.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button component={NextLink} href="/signup" variant="contained" size="large">Create account</Button>
              <Button component={NextLink} href="/contact" variant="outlined" size="large">Talk to us</Button>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
