import React, { useState } from 'react';
import {
  Container, Typography, Box, Paper, Grid, Chip, Divider, Stack,
  Accordion, AccordionSummary, AccordionDetails, Alert
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import LoginIcon from '@mui/icons-material/Login';
import MessageIcon from '@mui/icons-material/Message';
import WebhookIcon from '@mui/icons-material/Webhook';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import VideoLabelIcon from '@mui/icons-material/VideoLabel';
import { motion } from 'framer-motion';

const FeatureSection = ({ icon, number, title, description, steps, screenshotLabel }) => (
  <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, border: '1px solid', borderColor: 'divider', mb: 3 }}>
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 2,
          bgcolor: 'primary.main',
          color: '#05260f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 900,
          fontSize: '1.2rem',
          flexShrink: 0,
        }}
      >
        {number}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box sx={{ color: 'primary.main' }}>{icon}</Box>
          <Typography variant="h6" fontWeight={700}>{title}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.8 }}>
          {description}
        </Typography>
        {steps && (
          <Box component="ol" sx={{ pl: 2.5, mb: 2 }}>
            {steps.map((step, i) => (
              <Box component="li" key={i} sx={{ mb: 0.75 }}>
                <Typography variant="body2" color="text.secondary">{step}</Typography>
              </Box>
            ))}
          </Box>
        )}
        {screenshotLabel && (
          <Box
            sx={{
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              bgcolor: 'action.hover',
            }}
          >
            <PlayCircleOutlineIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.disabled">{screenshotLabel}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  </Paper>
);

const PERMISSIONS = [
  {
    permission: 'whatsapp_business_management',
    reason: 'Required to manage WhatsApp Business Accounts, phone numbers, and message templates on behalf of the connected business.',
    required: true,
  },
  {
    permission: 'whatsapp_business_messaging',
    reason: 'Required to send and receive WhatsApp messages through the WhatsApp Cloud API.',
    required: true,
  },
  {
    permission: 'business_management',
    reason: 'Required to access Business Manager to list businesses, verify business identity, and complete the Embedded Signup flow.',
    required: true,
  },
  {
    permission: 'pages_show_list',
    reason: 'Required during Embedded Signup to allow users to select their Facebook Page to associate with the WhatsApp Business Account.',
    required: true,
  },
  {
    permission: 'public_profile',
    reason: 'Used during login to display the user\'s name and profile picture in the MetaBSP dashboard for identity confirmation.',
    required: false,
  },
];

export default function MetaAppReviewPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
        <Box sx={{ bgcolor: '#111b21', color: 'white', py: { xs: 8, md: 12 } }}>
          <Container maxWidth="lg">
            <Grid container spacing={4} alignItems="center">
              <Grid item xs={12} md={7}>
                <Chip label="Meta App Review Documentation" sx={{ bgcolor: '#25d366', color: '#05260f', fontWeight: 700, mb: 2 }} />
                <Typography variant="h3" fontWeight={800} sx={{ color: 'white', mb: 2 }}>
                  MetaBSP — WhatsApp Business Solution Provider
                </Typography>
                <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, mb: 3 }}>
                  MetaBSP is a SaaS platform that enables businesses to integrate with the WhatsApp Business Platform through Meta's official WhatsApp Cloud API. We provide a web-based dashboard and REST API that allow businesses to manage their WhatsApp Business Accounts, send messages, manage templates, configure webhooks, and analyze messaging performance.
                </Typography>
                <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                  <Chip label="Authorized BSP" icon={<VerifiedUserIcon />} sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'white' }} />
                  <Chip label="Embedded Signup" icon={<LoginIcon />} sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'white' }} />
                  <Chip label="Cloud API" icon={<WhatsAppIcon />} sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'white' }} />
                </Stack>
              </Grid>
              <Grid item xs={12} md={5}>
                <Paper sx={{ p: 3, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: 'white', mb: 2 }}>
                    App Review Contact
                  </Typography>
                  <Stack spacing={1.5}>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Contact for Review Team</Typography>
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 600 }}>review@metabsp.com</Typography>
                    </Box>
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                    <Box>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Test Account Email</Typography>
                      <Typography variant="body2" sx={{ color: '#25d366', fontFamily: 'monospace', fontWeight: 700 }}>demo@metabsp.com</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>Test Account Password</Typography>
                      <Typography variant="body2" sx={{ color: '#25d366', fontFamily: 'monospace', fontWeight: 700 }}>Demo123!</Typography>
                    </Box>
                    <Alert severity="info" sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: 'white', '& .MuiAlert-icon': { color: '#25d366' } }}>
                      The demo account has a pre-connected sandbox WABA with test phone numbers and sample templates.
                    </Alert>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ py: 8 }}>
          <Box sx={{ mb: 6 }}>
            <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>App Overview</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
              MetaBSP implements the following flows that require Meta app permissions. Each flow is documented below with step-by-step instructions for the review team.
            </Typography>
          </Box>

          <Box sx={{ mb: 8 }}>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>Feature Walkthrough</Typography>

            <FeatureSection
              number="1"
              icon={<LoginIcon />}
              title="Embedded Signup Flow (Facebook OAuth)"
              description="MetaBSP uses Meta's Embedded Signup to allow businesses to connect their WhatsApp Business Account to our platform. This is a standard Meta-approved flow that uses Facebook Login to authenticate the business owner and obtain authorization to manage their WABA."
              steps={[
                'User clicks "Connect WhatsApp Account" from the MetaBSP onboarding screen or Account Settings.',
                'The Embedded Signup modal opens, presenting the Facebook Login dialog.',
                'User logs into Facebook (or uses their existing session) and selects the Business Manager that owns their WABA.',
                'Meta guides the user through WABA selection or creation, phone number registration, and business profile setup.',
                'Upon completion, Meta calls our OAuth callback URL with an authorization code.',
                'MetaBSP exchanges the code for a System User Access Token and stores it securely (AES-256 encrypted).',
                'The user is redirected to their MetaBSP dashboard where their WABA is now connected and ready to use.',
              ]}
              screenshotLabel="Screenshot: Embedded Signup Modal → Facebook Login → WABA Selection → Success"
            />

            <FeatureSection
              number="2"
              icon={<MessageIcon />}
              title="Template Message Management"
              description="Businesses use MetaBSP to create, submit, and manage WhatsApp message templates. Templates are required for initiating conversations (business-initiated messages) and must be approved by Meta before use."
              steps={[
                'Navigate to Templates in the left sidebar of the MetaBSP dashboard.',
                'Click "Create Template" and select a category (Utility, Marketing, or Authentication).',
                'Enter the template name, select language, and compose the template body with optional variables ({{1}}, {{2}}).',
                'Optionally add a header (text, image, video, or document) and footer text.',
                'Add interactive buttons (Call to Action or Quick Reply) if needed.',
                'Click "Submit for Approval" — MetaBSP submits the template to Meta via the WhatsApp Cloud API.',
                'Template status updates (PENDING → APPROVED or REJECTED) are shown in real-time via webhook.',
                'Approved templates appear in the "Active Templates" list and are available for use in the API.',
              ]}
              screenshotLabel="Screenshot: Template Editor → Submit → Pending Status → Approved Status"
            />

            <FeatureSection
              number="3"
              icon={<WebhookIcon />}
              title="Webhook Configuration"
              description="MetaBSP receives webhook events from Meta's WhatsApp Cloud API and forwards them to the business's configured endpoint. Businesses configure their webhook URLs in the MetaBSP dashboard."
              steps={[
                'Navigate to Settings → Webhooks in the MetaBSP dashboard.',
                'Click "Add Webhook Endpoint" and enter the destination URL.',
                'Select which events to receive (message.received, message.delivered, message.read, template.approved, etc.).',
                'MetaBSP displays the webhook secret — copy this to verify incoming requests in your application.',
                'Click "Save" — MetaBSP internally registers as the webhook receiver with Meta\'s Cloud API.',
                'When Meta sends an event to MetaBSP, we verify the signature and forward it to your configured URL with our own signature.',
                'Delivery status, retry count, and response codes are visible in the Webhook Logs tab.',
              ]}
              screenshotLabel="Screenshot: Webhook Configuration Form → Event Selection → Webhook Logs"
            />

            <FeatureSection
              number="4"
              icon={<AnalyticsIcon />}
              title="Message Analytics"
              description="MetaBSP provides analytics dashboards showing message delivery performance, read rates, template usage, and contact engagement metrics."
              steps={[
                'Navigate to Analytics in the left sidebar.',
                'Select a date range and optionally filter by phone number or template.',
                'View the overview dashboard showing total messages sent, delivered, read, and failed.',
                'Click "Templates" tab to see per-template performance (send count, read rate, opt-out rate).',
                'Click "Contacts" tab to see messaging history with individual contacts.',
                'Export data as CSV using the download icon in the top right of any chart.',
              ]}
              screenshotLabel="Screenshot: Analytics Dashboard → Delivery Rates Chart → Template Performance Table"
            />

            <FeatureSection
              number="5"
              icon={<VerifiedUserIcon />}
              title="Business Verification"
              description="MetaBSP assists businesses with Meta's business verification process, which is required to send messages at scale and access higher messaging tiers."
              steps={[
                'Navigate to Account → Verification Status in the MetaBSP dashboard.',
                'The current verification status is shown (Unverified, Pending, Verified).',
                'Click "Start Verification" to be guided through Meta\'s Business Verification process.',
                'MetaBSP links to the Meta Business Manager where the user can submit business documents.',
                'Once Meta approves verification, the status updates automatically in MetaBSP.',
                'Messaging tier limits are displayed alongside verification status.',
              ]}
              screenshotLabel="Screenshot: Verification Status Page → Business Manager Link → Verified Badge"
            />
          </Box>

          <Divider sx={{ mb: 6 }} />

          <Box sx={{ mb: 8 }}>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>Test Credentials & Demo Account</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Use the following credentials to test all features of the MetaBSP platform without needing a real WhatsApp Business Account.
            </Typography>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '2px solid', borderColor: 'primary.main' }}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.disabled">Demo Account Email</Typography>
                  <Typography variant="h6" sx={{ fontFamily: 'monospace', color: 'primary.main', fontWeight: 700 }}>
                    demo@metabsp.com
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.disabled">Demo Account Password</Typography>
                  <Typography variant="h6" sx={{ fontFamily: 'monospace', color: 'primary.main', fontWeight: 700 }}>
                    Demo123!
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Divider />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>What's pre-configured in the demo account:</Typography>
                  <Grid container spacing={1}>
                    {[
                      'Pre-connected sandbox WhatsApp Business Account',
                      'Sample phone number: +1 (415) 555-0100 (test number)',
                      '5 pre-approved message templates (utility and marketing)',
                      'Sample message history with test contacts',
                      'Pre-configured webhook endpoint (logs events only)',
                      'Sample analytics data for the past 30 days',
                    ].map((item, i) => (
                      <Grid item xs={12} sm={6} key={i}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                          <CheckCircleIcon sx={{ color: 'success.main', fontSize: 18, mt: 0.25 }} />
                          <Typography variant="body2" color="text.secondary">{item}</Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
              </Grid>
            </Paper>
          </Box>

          <Box sx={{ mb: 8 }}>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>Sample Workflow: Send First WhatsApp Message</Typography>
            <Stack spacing={2}>
              {[
                { step: 1, action: 'Log in to MetaBSP', detail: 'Go to app.metabsp.com, click Login, and enter demo@metabsp.com / Demo123!' },
                { step: 2, action: 'View Dashboard', detail: 'You will see the main dashboard with message stats and the pre-connected sandbox WABA.' },
                { step: 3, action: 'Navigate to Messages', detail: 'Click "Messages" in the left sidebar to open the message composer.' },
                { step: 4, action: 'Select a Template', detail: 'Click "Send Template Message", choose "order_confirmation" from the template dropdown.' },
                { step: 5, action: 'Enter Recipient', detail: 'Enter a test phone number (for sandbox, use +14155552671 which is always valid).' },
                { step: 6, action: 'Fill Template Variables', detail: 'Fill in the template variables: Name: "Test User", Order ID: "ORD-001", Amount: "$50.00".' },
                { step: 7, action: 'Send Message', detail: 'Click "Send Message". The message appears in the message list with status "Sent" → "Delivered".' },
                { step: 8, action: 'View Analytics', detail: 'Navigate to Analytics to see the message reflected in the delivery stats.' },
              ].map((item) => (
                <Paper key={item.step} elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                    <Chip label={`Step ${item.step}`} color="primary" size="small" sx={{ mt: 0.25, minWidth: 64 }} />
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700}>{item.action}</Typography>
                      <Typography variant="body2" color="text.secondary">{item.detail}</Typography>
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Stack>
          </Box>

          <Divider sx={{ mb: 6 }} />

          <Box sx={{ mb: 8 }}>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>App Capabilities & Permission Justifications</Typography>
            <Stack spacing={2}>
              {PERMISSIONS.map((perm, i) => (
                <Paper key={i} elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ fontFamily: 'monospace', color: 'primary.main' }}>
                      {perm.permission}
                    </Typography>
                    <Chip
                      label={perm.required ? 'Required' : 'Optional'}
                      size="small"
                      color={perm.required ? 'error' : 'default'}
                      variant="outlined"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">{perm.reason}</Typography>
                </Paper>
              ))}
            </Stack>
          </Box>

          <Divider sx={{ mb: 6 }} />

          <Box sx={{ mb: 8 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <VideoLabelIcon sx={{ color: 'primary.main', fontSize: 28 }} />
              <Typography variant="h5" fontWeight={700}>Video Recording Checklist</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Use this checklist to ensure your screen recording covers all required flows for each permission requested.
            </Typography>
            <Stack spacing={2}>
              {[
                {
                  permission: 'whatsapp_business_management + whatsapp_business_messaging',
                  items: [
                    'Show the Embedded Signup button on the onboarding page',
                    'Demonstrate clicking "Connect WhatsApp Account" and the Facebook Login modal appearing',
                    'Show the WABA selection / creation screen within the Embedded Signup flow',
                    'Show the MetaBSP dashboard after successful connection with WABA details visible',
                    'Navigate to Templates and show creating and submitting a template',
                    'Show the template status updating to APPROVED',
                    'Send a test message using a template and show delivery status',
                  ],
                },
                {
                  permission: 'business_management',
                  items: [
                    'Show the Embedded Signup flow selecting a Business Manager',
                    'Show the business profile section in MetaBSP dashboard',
                  ],
                },
                {
                  permission: 'pages_show_list',
                  items: [
                    'Show the page selection step during Embedded Signup',
                  ],
                },
              ].map((section, i) => (
                <Accordion key={i} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px !important', '&:before': { display: 'none' } }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ fontFamily: 'monospace', color: 'primary.main' }}>
                      {section.permission}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0 }}>
                    <Stack spacing={1}>
                      {section.items.map((item, j) => (
                        <Box key={j} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                          <Box sx={{ width: 20, height: 20, border: '2px solid', borderColor: 'primary.main', borderRadius: 0.5, flexShrink: 0, mt: 0.1 }} />
                          <Typography variant="body2" color="text.secondary">{item}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
          </Box>

          <Paper elevation={0} sx={{ p: 4, borderRadius: 3, bgcolor: '#111b21', color: 'white', textAlign: 'center' }}>
            <Typography variant="h6" fontWeight={700} sx={{ color: 'white', mb: 1 }}>Questions for the Review Team?</Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
              We are happy to schedule a live walkthrough, provide additional documentation, or answer any questions about our implementation.
            </Typography>
            <Typography variant="subtitle1" sx={{ color: '#25d366', fontWeight: 700 }}>review@metabsp.com</Typography>
          </Paper>
        </Container>
      </Box>
    </motion.div>
  );
}
