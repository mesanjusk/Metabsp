import React, { useState } from 'react';
import {
  Box, Container, Typography, Paper, Accordion, AccordionSummary, AccordionDetails,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Stack, Divider, IconButton, Tooltip, Checkbox, FormControlLabel,
  List, ListItem, ListItemText, Alert, useTheme,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import VerifiedIcon from '@mui/icons-material/Verified';
import WebhookIcon from '@mui/icons-material/Webhook';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import MessageIcon from '@mui/icons-material/Message';
import BusinessIcon from '@mui/icons-material/Business';
import LoginIcon from '@mui/icons-material/Login';
import { motion } from 'framer-motion';
import PublicLayout from './PublicLayout';

const WEBHOOK_PAYLOAD = `{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15550001234",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "messages": [{
          "from": "15551234567",
          "id": "wamid.XXX",
          "timestamp": "1680000000",
          "type": "text",
          "text": { "body": "Hello!" }
        }]
      },
      "field": "messages"
    }]
  }]
}`;

const CHECKLIST_ITEMS = [
  'Login to MetaBSP platform',
  'Navigate to WhatsApp Connect',
  'Complete Embedded Signup flow',
  'Show template creation',
  'Show message sending',
  'Show webhook configuration',
  'Show analytics dashboard',
  'Disconnect account',
];

const CAPABILITIES = [
  {
    permission: 'whatsapp_business_messaging',
    purpose: 'Required to send and receive WhatsApp messages on behalf of the business',
    status: 'Requested',
  },
  {
    permission: 'business_management',
    purpose: 'Access Meta Business Manager account information and settings',
    status: 'Requested',
  },
  {
    permission: 'pages_messaging',
    purpose: 'Manage WhatsApp message templates and view approval status',
    status: 'Requested',
  },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Tooltip title={copied ? 'Copied!' : 'Copy'}>
      <IconButton size="small" onClick={handleCopy} sx={{ color: copied ? 'success.main' : 'text.secondary' }}>
        {copied ? <CheckCircleOutlineIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}

function AccordionItems({ theme }) {
  const items = [
    {
      icon: <LoginIcon color="primary" />,
      title: 'Embedded Signup Flow',
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Business owners connect their WhatsApp Business Account to MetaBSP through Meta's official
            OAuth-based Embedded Signup flow. This is the Meta-approved method for WhatsApp Business
            Solution Providers to onboard customers without requiring manual credential sharing.
          </Typography>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Steps performed during Embedded Signup:</Typography>
          <List dense disablePadding>
            {[
              "User clicks \"Connect WhatsApp\" on the MetaBSP dashboard",
              "Meta's Embedded Signup popup opens (official Facebook login dialog)",
              'User authenticates with their Facebook/Meta account',
              'User selects or creates a WhatsApp Business Account (WABA)',
              'User grants permissions: whatsapp_business_messaging, business_management',
              'Meta returns an authorization code to MetaBSP',
              'MetaBSP exchanges the code for a System User Access Token via the Graph API',
              'WhatsApp phone number is registered and webhook subscriptions are created',
              'Dashboard confirms successful connection',
            ].map((step, i) => (
              <ListItem key={i} sx={{ py: 0.25, pl: 0 }}>
                <ListItemText
                  primary={
                    <Typography variant="body2" color="text.secondary">
                      <strong style={{ color: '#1976d2', marginRight: 8 }}>{i + 1}.</strong>
                      {step}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      ),
    },
    {
      icon: <MessageIcon color="primary" />,
      title: 'Template Message Management',
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            MetaBSP provides a complete interface for creating, submitting, and managing WhatsApp
            message templates. All templates are submitted to Meta for approval before use.
          </Typography>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Template Categories:</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
            <Chip label="MARKETING" color="warning" size="small" />
            <Chip label="UTILITY" color="info" size="small" />
            <Chip label="AUTHENTICATION" color="success" size="small" />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Each template supports header (text, image, video, document), body with variable parameters,
            footer text, and interactive buttons (call-to-action, quick reply). Templates are submitted
            via the WhatsApp Business Management API and typically approved within 24 hours.
          </Typography>
        </Box>
      ),
    },
    {
      icon: <WebhookIcon color="primary" />,
      title: 'Webhook Configuration',
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            MetaBSP configures webhooks on the connected WhatsApp Business Account to receive real-time
            message delivery notifications, read receipts, and incoming messages. The webhook endpoint
            is registered through the Graph API using the System User token obtained during Embedded Signup.
          </Typography>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Example Webhook Payload:</Typography>
          <Box sx={{ bgcolor: '#1e1e1e', color: '#d4d4d4', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.78rem', overflowX: 'auto' }}>
            <pre style={{ margin: 0 }}>{WEBHOOK_PAYLOAD}</pre>
          </Box>
        </Box>
      ),
    },
    {
      icon: <AnalyticsIcon color="primary" />,
      title: 'Message Analytics',
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            MetaBSP provides a comprehensive analytics dashboard that tracks key messaging performance
            indicators in real time using data from webhook events and the WhatsApp Business Management API.
          </Typography>
          <List dense disablePadding>
            {[
              'Message delivery rate — percentage of sent messages successfully delivered',
              'Read rate — percentage of delivered messages opened by recipients',
              'Template performance — per-template delivery, read, and response breakdown',
              'Failed message analysis — error codes and retry statistics',
              'Time-series charts — hourly and daily volume trends',
              'Contact engagement — message history and interaction frequency per contact',
            ].map((item, i) => (
              <ListItem key={i} sx={{ py: 0.25, pl: 0 }}>
                <ListItemText primary={<Typography variant="body2" color="text.secondary">• {item}</Typography>} />
              </ListItem>
            ))}
          </List>
        </Box>
      ),
    },
    {
      icon: <BusinessIcon color="primary" />,
      title: 'Business Verification',
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            MetaBSP guides businesses through Meta's Business Verification process, which is required
            to access production-level messaging volumes and advanced WhatsApp API features.
          </Typography>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Verification Steps:</Typography>
          <List dense disablePadding>
            {[
              'Log in to Meta Business Manager (business.facebook.com)',
              'Navigate to Business Settings → Security Center',
              'Click "Start Verification" and select your country',
              'Provide legal business name matching official documents',
              'Upload business registration document or utility bill',
              'Verify the business phone number via automated call or SMS',
              'Await Meta review (typically 2–5 business days)',
              'MetaBSP dashboard reflects verified status automatically',
            ].map((step, i) => (
              <ListItem key={i} sx={{ py: 0.25, pl: 0 }}>
                <ListItemText
                  primary={
                    <Typography variant="body2" color="text.secondary">
                      <strong style={{ color: '#1976d2', marginRight: 8 }}>{i + 1}.</strong>
                      {step}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ mb: 5 }}>
      {items.map((item, index) => (
        <Accordion
          key={index}
          defaultExpanded={index === 0}
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '12px !important',
            mb: 1.5,
            '&:before': { display: 'none' },
            '&.Mui-expanded': { boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 3, py: 1 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              {item.icon}
              <Typography fontWeight={700}>{item.title}</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 3, pb: 3 }}>
            {item.content}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}

export default function MetaAppReviewPage() {
  const theme = useTheme();

  return (
    <PublicLayout>
      {/* Hero */}
      <Box
        sx={{
          background: theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, #0a1628 0%, #1a2744 100%)'
            : 'linear-gradient(135deg, #1565C0 0%, #1976D2 60%, #42A5F5 100%)',
          color: '#fff',
          py: { xs: 8, md: 12 },
        }}
      >
        <Container maxWidth="lg">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
              <VerifiedIcon sx={{ fontSize: 36, color: '#90CAF9' }} />
              <Chip label="Meta App Review" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700 }} />
            </Stack>
            <Typography variant="h3" fontWeight={800} sx={{ mb: 2, fontSize: { xs: '1.8rem', md: '2.6rem' } }}>
              Meta App Review — MetaBSP WhatsApp Business Solution Provider
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.88, maxWidth: 720, fontWeight: 400, lineHeight: 1.6 }}>
              This page provides Meta reviewers and evaluators with full documentation of MetaBSP's
              WhatsApp Business Platform capabilities, demo credentials, and a step-by-step walkthrough
              of all features submitted for App Review.
            </Typography>
          </motion.div>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
        {/* Introduction */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, mb: 5, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>About MetaBSP</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.8 }}>
              MetaBSP is a Meta-authorized <strong>WhatsApp Business Solution Provider (BSP)</strong> that
              enables businesses of all sizes to integrate WhatsApp messaging into their customer communication
              workflows. As a BSP, MetaBSP is registered with Meta and operates under the WhatsApp Business
              Platform Terms of Service. The platform provides APIs, dashboards, and developer tools that
              allow businesses to send template messages, receive real-time webhook events, manage contacts,
              and analyze messaging performance — all through Meta's official Graph API and Cloud API.
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              MetaBSP uses Meta's <strong>Embedded Signup flow</strong> so that business owners can securely
              connect their WhatsApp Business Accounts using Meta's official OAuth process. No credentials are
              shared with MetaBSP directly — authentication is handled entirely by Meta's identity platform.
            </Typography>
          </Paper>
        </motion.div>

        {/* Feature Walkthrough */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
          <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>Feature Walkthrough</Typography>
          <AccordionItems theme={theme} />
        </motion.div>

        {/* Test Credentials */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <Alert
            severity="info"
            icon={false}
            sx={{
              mb: 5,
              border: '2px solid',
              borderColor: 'info.main',
              borderRadius: 3,
              '& .MuiAlert-message': { width: '100%' },
            }}
          >
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: 'info.dark' }}>
              Test / Demo Credentials for App Review
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Use the following credentials to access a fully-configured demo account with sample data.
              All demo WhatsApp connections use Meta's test numbers and do not send real messages.
            </Typography>
            <Box
              sx={{
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#F0F7FF',
                borderRadius: 2,
                p: 2.5,
              }}
            >
              {[
                ['Application URL', 'https://metabsp.com'],
                ['Email', 'demo@metabsp.com'],
                ['Password', 'Demo123!'],
                ['Test WhatsApp Number', '+1-555-0100'],
                ['Business Manager ID', '123456789012345'],
              ].map(([label, value]) => (
                <Stack key={label} direction="row" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="body2" fontWeight={700} sx={{ minWidth: 200, color: 'text.primary' }}>
                    {label}:
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'primary.main', flexGrow: 1 }}>
                    {value}
                  </Typography>
                  <CopyButton text={value} />
                </Stack>
              ))}
            </Box>
          </Alert>
        </motion.div>

        {/* Demo Account Instructions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
          <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, mb: 5, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Demo Account Access Instructions</Typography>
            <List>
              {[
                { primary: 'Open the application', secondary: 'Navigate to https://metabsp.com in your browser.' },
                { primary: 'Log in with demo credentials', secondary: 'Use email demo@metabsp.com and password Demo123! on the login page.' },
                { primary: 'Navigate to WhatsApp Connect', secondary: 'From the left sidebar, select "WhatsApp" or "Connect WhatsApp Business".' },
                { primary: 'Initiate Embedded Signup', secondary: 'Click "Connect WhatsApp Business Account". The Meta Embedded Signup popup will open.' },
                { primary: 'Complete the OAuth flow', secondary: 'Log in with a Facebook account that has access to a WhatsApp Business Account, grant the requested permissions, and select a WABA.' },
                { primary: 'Explore features', secondary: 'After connection, explore template management, message sending, webhook logs, and the analytics dashboard.' },
                { primary: 'Disconnect (optional)', secondary: 'Use the "Disconnect" button on the WhatsApp settings page to remove the account connection.' },
              ].map((step, i) => (
                <ListItem key={i} alignItems="flex-start" sx={{ pl: 0 }}>
                  <Box
                    sx={{
                      width: 28, height: 28, borderRadius: '50%', bgcolor: 'primary.main', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, flexShrink: 0, mr: 2, mt: 0.25,
                    }}
                  >
                    {i + 1}
                  </Box>
                  <ListItemText
                    primary={<Typography fontWeight={700}>{step.primary}</Typography>}
                    secondary={step.secondary}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </motion.div>

        {/* App Capabilities */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
          <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>App Capabilities / Permissions</Typography>
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{ mb: 5, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}
          >
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#F8FAFC' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Permission</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Purpose</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {CAPABILITIES.map((row) => (
                  <TableRow key={row.permission} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'primary.main', fontWeight: 600 }}>
                        {row.permission}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{row.purpose}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={row.status} color="primary" size="small" variant="outlined" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </motion.div>

        {/* Video Recording Checklist */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.35 }}>
          <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, mb: 5, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>Video Recording Checklist</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              The screen recording submitted with this App Review demonstrates each of the following steps in order.
            </Typography>
            <Stack spacing={0.5}>
              {CHECKLIST_ITEMS.map((item, i) => (
                <FormControlLabel
                  key={i}
                  control={<Checkbox checked={false} disabled size="small" sx={{ color: 'text.disabled' }} />}
                  label={<Typography variant="body2" color="text.secondary">{item}</Typography>}
                  sx={{ ml: 0 }}
                />
              ))}
            </Stack>
          </Paper>
        </motion.div>

        {/* Contact */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.4 }}>
          <Divider sx={{ mb: 4 }} />
          <Typography variant="body1" color="text.secondary" align="center">
            For questions about this App Review submission, contact us at{' '}
            <Box component="a" href="mailto:review@metabsp.com" sx={{ color: 'primary.main', fontWeight: 600 }}>
              review@metabsp.com
            </Box>
          </Typography>
        </motion.div>
      </Container>
    </PublicLayout>
  );
}
