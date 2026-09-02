'use client';

import React, { useState, useMemo } from 'react';
import {
  Container, Typography, Box, Paper, TextField, Accordion, AccordionSummary,
  AccordionDetails, Chip, InputAdornment, Stack, Button, Divider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import NextLink from 'next/link';
import { motion } from 'framer-motion';

const FAQ_DATA = [
  {
    category: 'Getting Started',
    color: 'primary',
    items: [
      {
        q: 'What is SanjuSK and how does it work?',
        a: 'SanjuSK is a messaging platform built on Meta\'s official WhatsApp Business Platform (Cloud API). It lets your business send and receive WhatsApp messages at scale. You connect your own WhatsApp Business Account to our platform — you keep ownership of it — and we handle the API infrastructure, authentication, and message delivery.',
      },
      {
        q: 'How do I create an account?',
        a: 'Click "Sign Up" in the top navigation, enter your business email and create a password. You\'ll receive a verification email. After verifying, you can connect your WhatsApp Business Account using our Embedded Signup flow — this takes about 5-10 minutes.',
      },
      {
        q: 'Do I need an existing WhatsApp Business Account?',
        a: 'No. You can create a new WhatsApp Business Account directly through SanjuSK\'s Embedded Signup flow using your Facebook Business Manager account. If you already have a WABA, you can connect it during onboarding.',
      },
      {
        q: 'What phone number can I use for WhatsApp Business?',
        a: 'You can use any phone number that can receive a verification code (SMS or voice call) and is not already registered with WhatsApp personal or WhatsApp Business app. This can be a mobile, landline, or VoIP number. Once used for the API, the number cannot simultaneously be used on the WhatsApp app.',
      },
      {
        q: 'What is the difference between SanjuSK plans?',
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
        a: 'Embedded Signup is Meta\'s official flow for connecting a WhatsApp Business Account to a platform like SanjuSK. During this process, you log in with Facebook, select or create a Business Manager, verify your business phone number, and authorize SanjuSK to send messages on your behalf. The entire process takes about 5-10 minutes.',
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
        a: 'If your number was rejected, the most common reasons are: the number is already registered on WhatsApp (personal or Business app), the number is on a platform\'s blocklist, or there was a verification code delivery failure. Try using a different number or contact our support team at support@meta.sanjusk.in for help.',
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
        a: 'Common rejection reasons include: content that violates WhatsApp Business Policy (gambling, adult content, alcohol promotions to minors), misleading content, poor grammar, templates that try to collect sensitive information, or templates that look like phishing. SanjuSK provides rejection feedback to help you revise and resubmit.',
      },
      {
        q: 'How do I use variables in templates?',
        a: 'Template variables are represented as {{1}}, {{2}}, etc. in the template body. When sending, you provide the corresponding values in order. For example, a template "Hello {{1}}, your order {{2}} has shipped" would receive values ["John", "#12345"] to produce "Hello John, your order #12345 has shipped."',
      },
      {
        q: 'What is the difference between template categories?',
        a: 'WhatsApp has three template categories: UTILITY (transactional messages like order confirmations, shipping updates, appointment reminders — lowest cost), AUTHENTICATION (OTP messages), and MARKETING (promotional content, offers — higher cost per conversation). SanjuSK displays the pricing difference when you create templates.',
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
        a: 'WhatsApp charges per 24-hour conversation session, not per message. There are two types: business-initiated (you start the conversation, higher cost) and user-initiated (customer sends first message within 24 hours, lower cost). SanjuSK passes through Meta\'s conversation costs plus a platform fee based on your plan.',
      },
      {
        q: 'When am I charged?',
        a: 'Platform subscription fees are charged monthly at the beginning of each billing cycle. Meta\'s conversation charges are billed by SanjuSK at the end of each month based on actual usage. You can view real-time usage estimates in your dashboard.',
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
        a: 'Meta provides 1,000 free user-initiated conversations per WhatsApp Business Account per month. These free conversations are automatically applied before your paid conversation usage. SanjuSK surfaces these free conversation credits in your billing dashboard.',
      },
    ],
  },
  {
    category: 'API',
    color: 'info',
    items: [
      {
        q: 'How do I get my API key?',
        a: 'Sign in and go to Developers → API keys → Create key. Give it a name so you can tell your integrations apart. The key is shown once, at that moment — copy it straight into wherever your code reads its secrets. If you lose it, revoke it and create another; revocation takes effect immediately.',
      },
      {
        q: 'Is the API available on my account, or does an administrator enable it?',
        a: 'It is available to every account with no extra step. A key acts as its owner, on the WhatsApp number that owner connected, and can never see or send from anyone else\'s — an account or phone number in a request body is never trusted to widen that.',
      },
      {
        q: 'What is the base URL for the SanjuSK API?',
        a: 'https://meta.sanjusk.in/api/v1. Every request carries your API key as a bearer token: "Authorization: Bearer mbsp_your_key_here". Requests and responses are JSON. Start with GET /api/v1/status — it confirms the key works and names the number it sends from.',
      },
      {
        q: 'What are the API rate limits?',
        a: '60 requests per minute per key for the sending endpoints, and 120 per minute for GET /api/v1/messages. Going over returns HTTP 429 with a Retry-After header giving the seconds to wait. The limit is counted per key rather than per account, so one runaway integration cannot exhaust another one\'s budget.',
      },
      {
        q: 'How do I receive incoming messages?',
        a: 'Two ways, delivering the same messages — pick whichever matches where your code runs. If your server has a public URL, add it under Developers → Webhook destinations and we POST each message to it as it arrives. If it does not — a desktop tool, a script behind NAT, a scheduled job — poll GET /api/v1/messages instead, passing the nextSince value from the previous response so you cannot miss a message or receive one twice.',
      },
      {
        q: 'How do I verify a webhook came from you?',
        a: 'Every delivery carries an HMAC-SHA256 of the raw request body in the X-Metabsp-Signature-256 header, computed with that destination\'s own secret. Compute the same HMAC over the raw body, compare in constant time, and only parse the JSON once it matches. Your URL is reachable by anyone who guesses it, so this check is what makes the request trustworthy. The Developers → API reference tab has working code.',
      },
      {
        q: 'I registered several webhook destinations and one is not getting messages.',
        a: 'That is keyword routing. Give each destination an entry keyword: a message starting with that keyword goes to that destination, and the rest of the conversation stays with it until the person goes quiet or sends STOP. A message matching no keyword goes to every destination that has no keyword of its own, plus any marked as a fan-out fallback. With a single destination and no keyword you simply receive everything.',
      },
      {
        q: 'What happens if my endpoint is down when a message arrives?',
        a: 'The delivery is retried twice more, after 5 seconds and again after 15. If all three attempts fail, the destination is marked failing and the last error is shown against it in Developers → Webhook destinations. Answer within a few seconds and do your real work afterwards — a slow endpoint is treated the same as a broken one.',
      },
      {
        q: 'Does SanjuSK have an official SDK?',
        a: 'Not yet. The API is plain HTTPS with JSON, so any HTTP client works — the Developers → API reference tab has copy-paste curl for every endpoint, and the developer docs include a Node.js webhook handler you can lift directly.',
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
        a: 'Error codes from Meta are documented at developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes. Common codes: 130429 (rate limit hit), 131030 (recipient number not WhatsApp), 131047 (message expired), 131051 (unsupported message type). SanjuSK also shows human-readable descriptions alongside error codes in the dashboard.',
      },
      {
        q: 'My webhook is not receiving events.',
        a: 'Troubleshooting steps: (1) Verify the webhook URL is publicly accessible (not localhost). (2) Confirm your server returns HTTP 200 within 10 seconds. (3) Check the webhook logs in SanjuSK dashboard for delivery attempts. (4) Verify your server is validating the HMAC signature correctly (signature mismatch causes delivery to stop). (5) Check that your server is not blocking our IP ranges.',
      },
      {
        q: 'My phone number quality rating dropped. What does this mean?',
        a: 'Meta monitors the quality of messages sent by each phone number based on user feedback (blocks, reports, opt-outs). A yellow or red quality rating means users are reporting your messages negatively. This can reduce your messaging tier. To improve: review your message content, ensure proper opt-in, honor opt-outs promptly, and reduce sending frequency.',
      },
      {
        q: 'How do I migrate from another WhatsApp provider?',
        a: 'You can migrate your existing WABA to SanjuSK by connecting it through our Embedded Signup flow and selecting "Connect Existing WABA." You will need access to the Facebook Business Manager that owns the WABA. Phone numbers, templates, and business profile settings will carry over. Message history is not migrated. Contact support@meta.sanjusk.in for migration assistance.',
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
              Find answers to common questions about SanjuSK and the WhatsApp Business Platform
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
              <Button variant="contained" component={NextLink} href="/contact">
                Contact Support
              </Button>
              <Button variant="outlined" component={NextLink} href="/developer-docs">
                Developer Docs
              </Button>
            </Stack>
          </Paper>
        </Container>
      </Box>
    </motion.div>
  );
}
