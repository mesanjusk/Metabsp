import React, { useState, useMemo } from 'react';
import {
  Container, Typography, Box, Paper, TextField, Accordion, AccordionSummary,
  AccordionDetails, Chip, InputAdornment, Stack, Button, Divider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { Link as RouterLink } from 'react-router-dom';
import { motion } from 'framer-motion';

const FAQ_DATA = [
  {
    category: 'Getting Started',
    color: 'primary',
    items: [
      {
        q: 'What is MetaBSP and how does it work?',
        a: 'MetaBSP is a WhatsApp Business Solution Provider (BSP) authorized by Meta. We provide API access to the WhatsApp Business Platform, allowing your business to send and receive WhatsApp messages at scale. You connect your WhatsApp Business Account to our platform, and we handle the API infrastructure, authentication, and message delivery.',
      },
      {
        q: 'How do I create an account?',
        a: 'Click "Sign Up" in the top navigation, enter your business email and create a password. You\'ll receive a verification email. After verifying, you can connect your WhatsApp Business Account using our Embedded Signup flow — this takes about 5-10 minutes.',
      },
      {
        q: 'Do I need an existing WhatsApp Business Account?',
        a: 'No. You can create a new WhatsApp Business Account directly through MetaBSP\'s Embedded Signup flow using your Facebook Business Manager account. If you already have a WABA, you can connect it during onboarding.',
      },
      {
        q: 'What phone number can I use for WhatsApp Business?',
        a: 'You can use any phone number that can receive a verification code (SMS or voice call) and is not already registered with WhatsApp personal or WhatsApp Business app. This can be a mobile, landline, or VoIP number. Once used for the API, the number cannot simultaneously be used on the WhatsApp app.',
      },
      {
        q: 'What is the difference between MetaBSP plans?',
        a: 'Our Starter plan includes 1 phone number and 1,000 conversations/month. The Business plan supports up to 5 phone numbers and unlimited conversations. Enterprise plans offer dedicated infrastructure, SLA guarantees, and custom pricing. All plans include API access, template management, and webhook support.',
      },
      {
        q: 'Is there a free trial available?',
        a: 'Yes, we offer a 14-day free trial on the Business plan with no credit card required. You get access to all features including API access, template submission, and webhook configuration during the trial.',
      },
    ],
  },
  {
    category: 'WhatsApp Setup',
    color: 'success',
    items: [
      {
        q: 'What is the Embedded Signup process?',
        a: 'Embedded Signup is Meta\'s official flow for connecting a WhatsApp Business Account to a BSP like MetaBSP. During this process, you log in with Facebook, select or create a Business Manager, verify your business phone number, and authorize MetaBSP to send messages on your behalf. The entire process takes about 5-10 minutes.',
      },
      {
        q: 'How long does business verification take?',
        a: 'Meta\'s business verification typically takes 1-3 business days. During this time, you can use your account in limited mode (up to 250 conversations per day). After verification, your messaging tier may increase based on quality ratings.',
      },
      {
        q: 'What are WhatsApp messaging tiers?',
        a: 'Meta limits how many unique contacts you can message per 24 hours based on your business quality and verification status. Tier 1: 1,000 contacts/day. Tier 2: 10,000 contacts/day. Tier 3: 100,000 contacts/day. Tier 4: Unlimited. Your tier increases automatically as you send more messages with high quality.',
      },
      {
        q: 'My WhatsApp number was rejected. What can I do?',
        a: 'If your number was rejected, the most common reasons are: the number is already registered on WhatsApp (personal or Business app), the number is on a platform\'s blocklist, or there was a verification code delivery failure. Try using a different number or contact our support team at support@metabsp.com for help.',
      },
      {
        q: 'Can I use the same number on the WhatsApp app and the API?',
        a: 'No. A phone number can only be registered in one of: the WhatsApp personal app, the WhatsApp Business app, or the WhatsApp Business API. If you want to use a number on the API, you must first delete it from any existing WhatsApp app installation.',
      },
    ],
  },
  {
    category: 'Templates',
    color: 'warning',
    items: [
      {
        q: 'What are WhatsApp message templates?',
        a: 'Message templates are pre-approved message formats required for initiating conversations with customers (business-initiated messages). They must be approved by Meta before use. Templates can include text, media (images, videos, documents), and interactive buttons. Session messages (replies within 24 hours of customer contact) do not require templates.',
      },
      {
        q: 'How long does template approval take?',
        a: 'Meta typically reviews template submissions within a few minutes to 24 hours. Complex templates or those in sensitive categories may take longer. You\'ll receive an email and in-dashboard notification when your template is approved or rejected.',
      },
      {
        q: 'Why was my template rejected?',
        a: 'Common rejection reasons include: content that violates WhatsApp Business Policy (gambling, adult content, alcohol promotions to minors), misleading content, poor grammar, templates that try to collect sensitive information, or templates that look like phishing. MetaBSP provides rejection feedback to help you revise and resubmit.',
      },
      {
        q: 'How do I use variables in templates?',
        a: 'Template variables are represented as {{1}}, {{2}}, etc. in the template body. When sending, you provide the corresponding values in order. For example, a template "Hello {{1}}, your order {{2}} has shipped" would receive values ["John", "#12345"] to produce "Hello John, your order #12345 has shipped."',
      },
      {
        q: 'What is the difference between template categories?',
        a: 'WhatsApp has three template categories: UTILITY (transactional messages like order confirmations, shipping updates, appointment reminders — lowest cost), AUTHENTICATION (OTP messages), and MARKETING (promotional content, offers — higher cost per conversation). MetaBSP displays the pricing difference when you create templates.',
      },
      {
        q: 'Can I edit an approved template?',
        a: 'You cannot edit an approved template. You must create a new template with the desired changes and submit it for approval. The old template remains active until the new one is approved. We recommend creating new templates with version identifiers (e.g., order_confirmation_v2) to keep track of iterations.',
      },
    ],
  },
  {
    category: 'Billing',
    color: 'error',
    items: [
      {
        q: 'How does WhatsApp conversation-based pricing work?',
        a: 'WhatsApp charges per 24-hour conversation session, not per message. There are two types: business-initiated (you start the conversation, higher cost) and user-initiated (customer sends first message within 24 hours, lower cost). MetaBSP passes through Meta\'s conversation costs plus a platform fee based on your plan.',
      },
      {
        q: 'When am I charged?',
        a: 'Platform subscription fees are charged monthly at the beginning of each billing cycle. Meta\'s conversation charges are billed by MetaBSP at the end of each month based on actual usage. You can view real-time usage estimates in your dashboard.',
      },
      {
        q: 'What payment methods do you accept?',
        a: 'We accept all major credit cards (Visa, Mastercard, American Express, Discover) and ACH bank transfers for annual plans. Enterprise customers can request invoice-based net-30 payment terms. We do not accept cryptocurrency payments.',
      },
      {
        q: 'How do I cancel my subscription?',
        a: 'You can cancel your subscription at any time from Account Settings → Subscription → Cancel Plan. Your access continues until the end of the current billing period. No refunds are provided for partial months. After cancellation, your data is retained for 30 days before deletion.',
      },
      {
        q: 'Are there free conversations included each month?',
        a: 'Meta provides 1,000 free user-initiated conversations per WhatsApp Business Account per month. These free conversations are automatically applied before your paid conversation usage. MetaBSP surfaces these free conversation credits in your billing dashboard.',
      },
    ],
  },
  {
    category: 'API',
    color: 'info',
    items: [
      {
        q: 'How do I get my API key?',
        a: 'After signing in, navigate to Settings → API Keys → Generate New Key. Give the key a descriptive name and select the appropriate permission scope (read-only or full access). Copy the key immediately — it is only shown once for security. You can rotate or revoke keys at any time.',
      },
      {
        q: 'What is the base URL for the MetaBSP API?',
        a: 'The base URL is https://api.metabsp.com/v1. All API requests must include your API key in the Authorization header as a Bearer token: "Authorization: Bearer YOUR_API_KEY". The API returns JSON responses and accepts JSON request bodies.',
      },
      {
        q: 'What are the API rate limits?',
        a: 'Rate limits vary by plan: Starter: 60 requests/minute, Business: 300 requests/minute, Enterprise: Custom. Rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset) are included in every response. When rate limited, the API returns HTTP 429 with a Retry-After header.',
      },
      {
        q: 'How do webhooks work?',
        a: 'Webhooks are HTTP POST requests sent to your server when events occur (message received, delivery receipt, template status change). Configure your webhook URL in Settings → Webhooks. Each webhook includes an HMAC-SHA256 signature in the X-MetaBSP-Signature-256 header for verification. See our developer docs for verification code examples.',
      },
      {
        q: 'Does MetaBSP have an official SDK?',
        a: 'Yes, we offer official SDKs for Node.js (npm install @metabsp/sdk) and Python (pip install metabsp). Community SDKs for PHP and Ruby are maintained by the community. All SDKs are open source and available on our GitHub. See our Developer Docs for usage examples.',
      },
      {
        q: 'How do I handle webhook delivery failures?',
        a: 'MetaBSP retries failed webhook deliveries up to 5 times with exponential backoff (1min, 5min, 15min, 1hr, 4hr). You can view delivery attempts and manually retry failed webhooks from the Webhooks dashboard. Events are retained for 72 hours.',
      },
    ],
  },
  {
    category: 'Troubleshooting',
    color: 'secondary',
    items: [
      {
        q: 'Messages are not being delivered. What should I check?',
        a: 'First, check the message status in your dashboard — it will show queued, sent, delivered, or failed with an error code. Common issues: (1) Phone number not registered with WhatsApp. (2) Recipient has blocked your number. (3) Template not approved or content mismatch. (4) Your messaging tier limit reached. (5) Your phone number has been flagged for quality. Check our error code reference in the docs.',
      },
      {
        q: 'I\'m getting a "Message Failed" error. What does the error code mean?',
        a: 'Error codes from Meta are documented at developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes. Common codes: 130429 (rate limit hit), 131030 (recipient number not WhatsApp), 131047 (message expired), 131051 (unsupported message type). MetaBSP also shows human-readable descriptions alongside error codes in the dashboard.',
      },
      {
        q: 'My webhook is not receiving events.',
        a: 'Troubleshooting steps: (1) Verify the webhook URL is publicly accessible (not localhost). (2) Confirm your server returns HTTP 200 within 10 seconds. (3) Check the webhook logs in MetaBSP dashboard for delivery attempts. (4) Verify your server is validating the HMAC signature correctly (signature mismatch causes delivery to stop). (5) Check that your server is not blocking our IP ranges.',
      },
      {
        q: 'My phone number quality rating dropped. What does this mean?',
        a: 'Meta monitors the quality of messages sent by each phone number based on user feedback (blocks, reports, opt-outs). A yellow or red quality rating means users are reporting your messages negatively. This can reduce your messaging tier. To improve: review your message content, ensure proper opt-in, honor opt-outs promptly, and reduce sending frequency.',
      },
      {
        q: 'How do I migrate from another WhatsApp BSP?',
        a: 'You can migrate your existing WABA to MetaBSP by connecting it through our Embedded Signup flow and selecting "Connect Existing WABA." You will need access to the Facebook Business Manager that owns the WABA. Phone numbers, templates, and business profile settings will carry over. Message history is not migrated. Contact support@metabsp.com for migration assistance.',
      },
    ],
  },
];

export default function HelpCenterPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const categories = ['All', ...FAQ_DATA.map((d) => d.category)];

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return FAQ_DATA.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          (activeCategory === 'All' || activeCategory === section.category) &&
          (q === '' || item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q))
      ),
    })).filter((s) => s.items.length > 0);
  }, [search, activeCategory]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
        <Box sx={{ bgcolor: '#111b21', color: 'white', py: { xs: 8, md: 12 }, textAlign: 'center' }}>
          <Container maxWidth="md">
            <Typography variant="h3" fontWeight={800} sx={{ mb: 1.5, color: 'white' }}>Help Center</Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', mb: 4 }}>
              Find answers to common questions about MetaBSP and the WhatsApp Business Platform
            </Typography>
            <TextField
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search help articles..."
              variant="outlined"
              fullWidth
              sx={{
                maxWidth: 560,
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'white',
                  borderRadius: 3,
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ py: 6 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 5 }}>
            {categories.map((cat) => (
              <Chip
                key={cat}
                label={cat}
                onClick={() => setActiveCategory(cat)}
                color={activeCategory === cat ? 'primary' : 'default'}
                variant={activeCategory === cat ? 'filled' : 'outlined'}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Stack>

          {filtered.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary">No results found for "{search}"</Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
                Try different keywords or browse all categories
              </Typography>
              <Button sx={{ mt: 2 }} onClick={() => { setSearch(''); setActiveCategory('All'); }}>
                Clear Filters
              </Button>
            </Box>
          ) : (
            <Stack spacing={6}>
              {filtered.map((section) => (
                <Box key={section.category}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                    <Typography variant="h5" fontWeight={700}>{section.category}</Typography>
                    <Chip label={`${section.items.length} articles`} size="small" color={section.color} variant="outlined" />
                  </Box>
                  <Stack spacing={1}>
                    {section.items.map((item, idx) => (
                      <Accordion
                        key={idx}
                        elevation={0}
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: '12px !important',
                          '&:before': { display: 'none' },
                          '&.Mui-expanded': { borderColor: 'primary.main' },
                        }}
                      >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ borderRadius: 3 }}>
                          <Typography variant="subtitle1" fontWeight={600}>{item.q}</Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 0 }}>
                          <Divider sx={{ mb: 1.5 }} />
                          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                            {item.a}
                          </Typography>
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}

          <Paper
            elevation={0}
            sx={{ mt: 8, p: 4, borderRadius: 3, textAlign: 'center', border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}
          >
            <SupportAgentIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1.5 }} />
            <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>Still need help?</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2.5 }}>
              Our support team is ready to assist you with any questions not covered here.
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap" useFlexGap>
              <Button variant="contained" component={RouterLink} to="/contact">
                Contact Support
              </Button>
              <Button variant="outlined" component={RouterLink} to="/docs">
                Developer Docs
              </Button>
            </Stack>
          </Paper>
        </Container>
      </Box>
    </motion.div>
  );
}
