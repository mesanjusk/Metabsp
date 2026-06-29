import { useState } from 'react';
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Paper, Stack, Divider, Chip, IconButton, Tooltip,
  useMediaQuery, AppBar, Toolbar, Accordion, AccordionSummary,
  AccordionDetails, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import LockIcon from '@mui/icons-material/Lock';
import SendIcon from '@mui/icons-material/Send';
import ArticleIcon from '@mui/icons-material/Article';
import WebhookIcon from '@mui/icons-material/Webhook';
import PeopleIcon from '@mui/icons-material/People';
import BarChartIcon from '@mui/icons-material/BarChart';
import BuildIcon from '@mui/icons-material/Build';
import HelpIcon from '@mui/icons-material/Help';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const DRAWER_WIDTH = 260;

const NAV_SECTIONS = [
  { id: 'getting-started', label: 'Getting Started', icon: <RocketLaunchIcon fontSize="small" /> },
  { id: 'authentication', label: 'Authentication', icon: <LockIcon fontSize="small" /> },
  { id: 'sending-messages', label: 'Sending Messages', icon: <SendIcon fontSize="small" /> },
  { id: 'templates', label: 'Templates', icon: <ArticleIcon fontSize="small" /> },
  { id: 'webhooks', label: 'Webhooks', icon: <WebhookIcon fontSize="small" /> },
  { id: 'contacts', label: 'Contacts', icon: <PeopleIcon fontSize="small" /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChartIcon fontSize="small" /> },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: <BuildIcon fontSize="small" /> },
  { id: 'faq', label: 'FAQ', icon: <HelpIcon fontSize="small" /> },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
      <IconButton size="small" onClick={handle} sx={{ color: copied ? 'success.main' : 'rgba(255,255,255,0.5)' }}>
        {copied ? <CheckCircleOutlineIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}

function CodeBlock({ code, language = 'javascript' }) {
  return (
    <Box sx={{ position: 'relative', mb: 2 }}>
      <Box
        sx={{
          bgcolor: '#1e1e1e',
          color: '#d4d4d4',
          p: 2,
          pt: 1.5,
          borderRadius: 1,
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          overflowX: 'auto',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1, pb: 1, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
            {language}
          </Typography>
          <CopyButton text={code} />
        </Stack>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{code}</pre>
      </Box>
    </Box>
  );
}

function SectionHeading({ children }) {
  return (
    <Typography variant="h5" fontWeight={700} sx={{ mb: 2, mt: 1 }}>
      {children}
    </Typography>
  );
}

function SubHeading({ children }) {
  return (
    <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5, mt: 3 }}>
      {children}
    </Typography>
  );
}

// ─── Section Content ──────────────────────────────────────────────────────────

function GettingStarted() {
  return (
    <Box>
      <SectionHeading>Getting Started</SectionHeading>
      <Typography color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
        MetaBSP lets your business send and receive WhatsApp messages using Meta's official Cloud API.
        Follow these steps to get up and running in minutes.
      </Typography>

      <SubHeading>Prerequisites</SubHeading>
      <Box component="ul" sx={{ color: 'text.secondary', pl: 3, lineHeight: 2, mb: 3 }}>
        <li>A verified Meta Business Account</li>
        <li>A WhatsApp Business Account (WABA) with a verified phone number</li>
        <li>An HTTPS-accessible webhook URL (required for receiving messages)</li>
        <li>A MetaBSP account — sign up at metabsp.com/signup</li>
      </Box>

      <SubHeading>4-Step Setup</SubHeading>
      {[
        { step: '1', title: 'Create your MetaBSP account', desc: 'Sign up and verify your email at metabsp.com. Choose a plan that fits your messaging volume.' },
        { step: '2', title: 'Connect WhatsApp via Embedded Signup', desc: 'Navigate to "WhatsApp Connect" and click the "Connect" button. Complete Meta\'s official OAuth flow to link your WhatsApp Business Account.' },
        { step: '3', title: 'Configure your webhook', desc: 'Go to Settings → Webhooks and enter your HTTPS webhook URL and a verification token. MetaBSP will send a challenge request to verify ownership.' },
        { step: '4', title: 'Send your first message', desc: 'Use the dashboard or API to send a template message to an opted-in contact. Check the analytics page to confirm delivery.' },
      ].map(({ step, title, desc }) => (
        <Paper key={step} elevation={0} sx={{ p: 2.5, mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, display: 'flex', gap: 2 }}>
          <Box
            sx={{
              width: 36, height: 36, borderRadius: '50%', bgcolor: 'primary.main', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 15, flexShrink: 0,
            }}
          >
            {step}
          </Box>
          <Box>
            <Typography fontWeight={700}>{title}</Typography>
            <Typography variant="body2" color="text.secondary">{desc}</Typography>
          </Box>
        </Paper>
      ))}
    </Box>
  );
}

function Authentication() {
  const jwtCode = `// All API requests require a Bearer token in the Authorization header
const response = await fetch('https://api.metabsp.com/v1/messages', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ ... }),
});`;

  const apiKeyCode = `// Alternatively, use an API Key in the X-Api-Key header
const response = await fetch('https://api.metabsp.com/v1/messages', {
  method: 'POST',
  headers: {
    'X-Api-Key': 'mbsp_live_xxxxxxxxxxxxxxxxxxxx',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ ... }),
});`;

  const loginCode = `// Obtain a JWT token by logging in
const res = await fetch('https://api.metabsp.com/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'you@example.com', password: 'yourpassword' }),
});
const { token } = await res.json();
// token is valid for 24 hours`;

  return (
    <Box>
      <SectionHeading>Authentication</SectionHeading>
      <Typography color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
        MetaBSP supports two authentication methods: JWT Bearer tokens (for web/user sessions)
        and API Keys (for server-to-server integrations).
      </Typography>

      <SubHeading>JWT Bearer Token</SubHeading>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Obtain a JWT by calling the login endpoint. Include it as a Bearer token in subsequent requests.
      </Typography>
      <CodeBlock code={loginCode} />
      <CodeBlock code={jwtCode} />

      <SubHeading>API Key (X-Api-Key Header)</SubHeading>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Generate API keys in Settings → API Keys. Use the <code>X-Api-Key</code> header for server integrations.
        API keys never expire unless rotated manually.
      </Typography>
      <CodeBlock code={apiKeyCode} />

      <Paper elevation={0} sx={{ p: 2, bgcolor: 'warning.light', borderRadius: 2, border: '1px solid', borderColor: 'warning.main' }}>
        <Typography variant="body2" color="warning.dark" fontWeight={600}>
          Security note: Never expose API keys or JWT tokens in client-side code or public repositories.
          Use environment variables and server-side request proxying for production applications.
        </Typography>
      </Paper>
    </Box>
  );
}

function SendingMessages() {
  const textCode = `// Send a plain text message
const res = await fetch('https://api.metabsp.com/v1/messages', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: '+15551234567',
    type: 'text',
    text: { body: 'Hello from MetaBSP!' },
  }),
});
const data = await res.json();
console.log(data.messageId); // wamid.XXX`;

  const templateCode = `// Send a pre-approved template message
const res = await fetch('https://api.metabsp.com/v1/messages', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: '+15551234567',
    type: 'template',
    template: {
      name: 'order_confirmation',
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'John Doe' },
            { type: 'text', text: '#ORD-98765' },
          ],
        },
      ],
    },
  }),
});`;

  const mediaCode = `// Send an image message
const res = await fetch('https://api.metabsp.com/v1/messages', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: '+15551234567',
    type: 'image',
    image: {
      link: 'https://example.com/product-image.jpg',
      caption: 'Check out our new product!',
    },
  }),
});`;

  return (
    <Box>
      <SectionHeading>Sending Messages</SectionHeading>
      <Typography color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
        The <code>/v1/messages</code> endpoint supports text, template, and media messages.
        All messages must be sent to contacts who have opted in to receive WhatsApp communications
        from your business.
      </Typography>

      <SubHeading>Text Message</SubHeading>
      <CodeBlock code={textCode} />

      <SubHeading>Template Message</SubHeading>
      <CodeBlock code={templateCode} />

      <SubHeading>Media Message (Image)</SubHeading>
      <CodeBlock code={mediaCode} />
    </Box>
  );
}

function Templates() {
  const listCode = `// List all templates for your WABA
const res = await fetch('https://api.metabsp.com/v1/templates', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' },
});
const { templates } = await res.json();
// templates[].status: APPROVED | PENDING | REJECTED`;

  const createCode = `// Create a new template (submitted to Meta for approval)
const res = await fetch('https://api.metabsp.com/v1/templates', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'shipping_update',
    category: 'UTILITY',
    language: 'en_US',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Shipping Update',
      },
      {
        type: 'BODY',
        text: 'Hi {{1}}, your order {{2}} has shipped and will arrive by {{3}}.',
      },
      {
        type: 'FOOTER',
        text: 'MetaBSP Notifications',
      },
    ],
  }),
});`;

  return (
    <Box>
      <SectionHeading>Templates</SectionHeading>
      <Typography color="text.secondary" sx={{ mb: 2, lineHeight: 1.8 }}>
        WhatsApp requires pre-approved message templates for business-initiated conversations.
        Templates are reviewed by Meta and typically approved within 24 hours.
      </Typography>

      <SubHeading>Template Categories</SubHeading>
      <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ mb: 3 }}>
        {[
          { label: 'MARKETING', color: 'warning', desc: 'Promotions, offers, announcements' },
          { label: 'UTILITY', color: 'info', desc: 'Transactional updates, order confirmations' },
          { label: 'AUTHENTICATION', color: 'success', desc: 'OTPs, login verification codes' },
        ].map(({ label, color, desc }) => (
          <Paper key={label} elevation={0} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, minWidth: 160 }}>
            <Chip label={label} color={color} size="small" sx={{ mb: 0.75 }} />
            <Typography variant="caption" display="block" color="text.secondary">{desc}</Typography>
          </Paper>
        ))}
      </Stack>

      <SubHeading>Template Variables</SubHeading>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Use <code>{'{{1}}'}</code>, <code>{'{{2}}'}</code>, etc. as positional placeholders in template body text.
        Pass the actual values in the <code>parameters</code> array when sending the message.
      </Typography>

      <SubHeading>List Templates API</SubHeading>
      <CodeBlock code={listCode} />

      <SubHeading>Create Template API</SubHeading>
      <CodeBlock code={createCode} />
    </Box>
  );
}

function Webhooks() {
  const verifyCode = `// Express.js webhook verification handler
app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});`;

  const sigCode = `// Verify webhook signature (Node.js / Express)
const crypto = require('crypto');

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const body      = JSON.stringify(req.body);
  const expected  = 'sha256=' + crypto
    .createHmac('sha256', process.env.APP_SECRET)
    .update(body)
    .digest('hex');

  if (signature !== expected) {
    return res.sendStatus(401); // Invalid signature
  }

  // Process the verified event
  const { entry } = req.body;
  entry.forEach((e) => {
    e.changes.forEach((change) => {
      const messages = change.value?.messages || [];
      messages.forEach((msg) => {
        console.log('Received:', msg.type, 'from', msg.from);
      });
    });
  });

  res.sendStatus(200);
});`;

  return (
    <Box>
      <SectionHeading>Webhooks</SectionHeading>
      <Typography color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
        MetaBSP forwards WhatsApp webhook events to your configured URL in real time.
        You must verify your webhook endpoint and validate payload signatures for security.
      </Typography>

      <SubHeading>Setup: Webhook URL & Verify Token</SubHeading>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        In Settings → Webhooks, enter your HTTPS URL and a secret verify token.
        MetaBSP will call your URL with a GET request containing <code>hub.challenge</code>.
        Your server must return the challenge value to confirm ownership.
      </Typography>
      <CodeBlock code={verifyCode} />

      <SubHeading>Signature Verification</SubHeading>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        All incoming webhook payloads include an <code>X-Hub-Signature-256</code> header.
        Always verify this signature before processing events.
      </Typography>
      <CodeBlock code={sigCode} />

      <SubHeading>Event Types</SubHeading>
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Event</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[
              ['messages', 'Incoming message from a contact (text, image, audio, etc.)'],
              ['message_deliveries', 'Delivery receipt — message reached the recipient\'s device'],
              ['message_reads', 'Read receipt — recipient opened the message'],
              ['message_echoes', 'Copy of outbound messages sent via the API'],
              ['statuses', 'Status changes: sent, delivered, read, failed'],
            ].map(([event, desc]) => (
              <TableRow key={event} hover>
                <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'primary.main' }}>{event}</Typography></TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{desc}</Typography></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function Contacts() {
  const listCode = `// List contacts
const res = await fetch('https://api.metabsp.com/v1/contacts?page=1&limit=50', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' },
});
const { contacts, total } = await res.json();`;

  const createCode = `// Create a contact
const res = await fetch('https://api.metabsp.com/v1/contacts', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    phone: '+15551234567',
    name: 'Jane Smith',
    tags: ['customer', 'vip'],
    metadata: { customerId: 'CUS-001' },
  }),
});`;

  const updateCode = `// Update a contact
const res = await fetch('https://api.metabsp.com/v1/contacts/CONTACT_ID', {
  method: 'PATCH',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ name: 'Jane Smith-Jones', tags: ['customer', 'vip', 'renewed'] }),
});

// Delete a contact
await fetch('https://api.metabsp.com/v1/contacts/CONTACT_ID', {
  method: 'DELETE',
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' },
});`;

  return (
    <Box>
      <SectionHeading>Contacts</SectionHeading>
      <Typography color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
        Manage your contact list via the Contacts API. Contacts can be tagged, searched,
        and enriched with custom metadata.
      </Typography>
      <SubHeading>List Contacts</SubHeading>
      <CodeBlock code={listCode} />
      <SubHeading>Create Contact</SubHeading>
      <CodeBlock code={createCode} />
      <SubHeading>Update &amp; Delete</SubHeading>
      <CodeBlock code={updateCode} />
    </Box>
  );
}

function Analytics() {
  return (
    <Box>
      <SectionHeading>Analytics</SectionHeading>
      <Typography color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
        MetaBSP's analytics dashboard and API provide insight into your messaging performance.
        All metrics are derived from webhook delivery events and the WhatsApp Business Management API.
      </Typography>

      <SubHeading>Available Metrics</SubHeading>
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Metric</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Endpoint</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[
              ['messages_sent', 'Total messages dispatched via the API', '/v1/analytics/messages'],
              ['messages_delivered', 'Messages confirmed delivered to device', '/v1/analytics/messages'],
              ['messages_read', 'Messages opened by the recipient', '/v1/analytics/messages'],
              ['delivery_rate', 'delivered / sent × 100', '/v1/analytics/summary'],
              ['read_rate', 'read / delivered × 100', '/v1/analytics/summary'],
              ['template_performance', 'Per-template delivery and read breakdown', '/v1/analytics/templates'],
              ['failed_messages', 'Messages that failed with error codes', '/v1/analytics/failures'],
            ].map(([metric, desc, endpoint]) => (
              <TableRow key={metric} hover>
                <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'primary.main' }}>{metric}</Typography></TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{desc}</Typography></TableCell>
                <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{endpoint}</Typography></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
        Analytics data is available with up to 90-day history. Time-series data is returned in hourly
        or daily buckets depending on the <code>granularity</code> query parameter.
        Use <code>?from=2024-01-01&to=2024-01-31&granularity=daily</code> to scope the range.
      </Typography>
    </Box>
  );
}

function Troubleshooting() {
  const issues = [
    {
      error: '401 Unauthorized',
      cause: 'Missing, expired, or malformed Authorization token.',
      fix: 'Ensure the Authorization header is present and formatted as "Bearer <token>". JWT tokens expire after 24 hours — re-authenticate to get a fresh token.',
    },
    {
      error: '403 Forbidden',
      cause: 'Your account or API key does not have permission to perform this action.',
      fix: 'Check that your plan includes the feature you are trying to use. For template creation, ensure the connected WABA has completed Meta Business Verification.',
    },
    {
      error: 'Template REJECTED by Meta',
      cause: 'Meta\'s automated review flagged policy violations in the template content.',
      fix: 'Review Meta\'s template guidelines. Common rejections: promotional language in UTILITY templates, missing opt-out language in MARKETING templates, or vague variable placeholders. Edit and resubmit.',
    },
    {
      error: 'Webhook not receiving events',
      cause: 'Webhook URL unreachable, failed signature verification, or subscription not active.',
      fix: 'Verify your URL returns 200 to GET challenge requests. Check firewall rules allow inbound HTTPS from Meta IP ranges. Re-verify the webhook URL in Settings → Webhooks if subscription appears inactive.',
    },
  ];

  return (
    <Box>
      <SectionHeading>Troubleshooting</SectionHeading>
      <Typography color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
        Common errors and how to resolve them.
      </Typography>
      <Stack spacing={2}>
        {issues.map(({ error, cause, fix }) => (
          <Paper key={error} elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
              <Chip label={error} color="error" size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontWeight: 700 }} />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
              <strong>Cause:</strong> {cause}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Fix:</strong> {fix}
            </Typography>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}

function FAQ() {
  const faqs = [
    {
      q: 'Do contacts need to opt in before I can message them?',
      a: 'Yes. WhatsApp requires explicit opt-in consent before a business can send messages to a user. You are responsible for collecting and recording opt-in consent via your own channels (website, app, etc.).',
    },
    {
      q: 'How long does template approval take?',
      a: 'Meta typically reviews templates within a few minutes to 24 hours. Complex or borderline templates may take longer. You will be notified via webhook and email when status changes.',
    },
    {
      q: 'What message types can I send outside a 24-hour window?',
      a: 'Outside the 24-hour customer service window you may only send pre-approved template messages. Free-form text, media, and interactive messages are restricted to the window opened by an inbound user message.',
    },
    {
      q: 'Can I connect multiple WhatsApp Business Accounts?',
      a: 'Yes. MetaBSP supports multi-WABA setups. Each connected account appears as a separate workspace in the dashboard with its own templates, contacts, and analytics.',
    },
    {
      q: 'How do I handle rate limits?',
      a: 'MetaBSP API enforces a default limit of 1000 requests per minute per account. If you exceed this, you will receive a 429 Too Many Requests response. WhatsApp Cloud API also enforces per-phone-number messaging limits based on your quality rating.',
    },
    {
      q: 'Is my data stored by MetaBSP?',
      a: 'Message content is stored temporarily (72 hours) to support delivery tracking and analytics. After 72 hours, message bodies are purged and only aggregate metrics are retained. See our Privacy Policy for full details.',
    },
    {
      q: 'What happens if a message fails to deliver?',
      a: 'Failed messages generate a status webhook event with an error code. Common codes: 131047 (recipient not on WhatsApp), 131026 (message undeliverable), 130429 (rate limit exceeded). MetaBSP surfaces these in the analytics dashboard.',
    },
    {
      q: 'How do I disconnect a WhatsApp Business Account?',
      a: 'Go to Settings → Connected Accounts, find the WABA you want to disconnect, and click "Disconnect". This removes MetaBSP\'s System User token from your WABA and stops all webhook events.',
    },
  ];

  return (
    <Box>
      <SectionHeading>FAQ</SectionHeading>
      <Typography color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
        Frequently asked questions about MetaBSP and the WhatsApp Business Platform.
      </Typography>
      <Stack spacing={1}>
        {faqs.map(({ q, a }) => (
          <Accordion key={q} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5, py: 1 }}>
              <Typography fontWeight={600} variant="body2">{q}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2.5, pb: 2.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>{a}</Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Stack>
    </Box>
  );
}

const SECTION_COMPONENTS = {
  'getting-started': GettingStarted,
  'authentication': Authentication,
  'sending-messages': SendingMessages,
  'templates': Templates,
  'webhooks': Webhooks,
  'contacts': Contacts,
  'analytics': Analytics,
  'troubleshooting': Troubleshooting,
  'faq': FAQ,
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocumentationPage() {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const ActiveComponent = SECTION_COMPONENTS[activeSection] || GettingStarted;

  const sidebarContent = (
    <Box sx={{ width: DRAWER_WIDTH, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle1" fontWeight={800}>Documentation</Typography>
        <Typography variant="caption" color="text.secondary">MetaBSP API Reference</Typography>
      </Box>
      <List sx={{ px: 1, py: 1, flexGrow: 1, overflowY: 'auto' }}>
        {NAV_SECTIONS.map(({ id, label, icon }) => (
          <ListItemButton
            key={id}
            selected={activeSection === id}
            onClick={() => { setActiveSection(id); setDrawerOpen(false); }}
            sx={{ borderRadius: 2, mb: 0.5, px: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: activeSection === id ? 'primary.main' : 'text.secondary' }}>
              {icon}
            </ListItemIcon>
            <ListItemText
              primary={label}
              primaryTypographyProps={{ fontSize: 14, fontWeight: activeSection === id ? 700 : 500 }}
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
      {/* Mobile top bar */}
      {isMobile && (
        <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', top: 0 }}>
          <Toolbar sx={{ gap: 1, minHeight: 52 }}>
            <IconButton size="small" onClick={() => setDrawerOpen(true)}>
              <MenuIcon />
            </IconButton>
            <Typography variant="subtitle2" fontWeight={700}>
              {NAV_SECTIONS.find((s) => s.id === activeSection)?.label}
            </Typography>
          </Toolbar>
        </AppBar>
      )}

      {/* Sidebar — permanent on desktop, temporary drawer on mobile */}
      {isMobile ? (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          PaperProps={{ sx: { width: DRAWER_WIDTH } }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
            <IconButton size="small" onClick={() => setDrawerOpen(false)}><CloseIcon fontSize="small" /></IconButton>
          </Box>
          {sidebarContent}
        </Drawer>
      ) : (
        <Box
          component="nav"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            borderRight: '1px solid',
            borderColor: 'divider',
            position: 'sticky',
            top: 0,
            alignSelf: 'flex-start',
            height: '100vh',
            overflowY: 'auto',
          }}
        >
          {sidebarContent}
        </Box>
      )}

      {/* Main content */}
      <Box
        component="main"
        sx={{ flexGrow: 1, p: { xs: 3, md: 5 }, maxWidth: '100%', overflowX: 'hidden' }}
      >
        <Box sx={{ maxWidth: 780 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
            <Divider sx={{ flexGrow: 1 }} />
            <Chip
              label={`v1.0`}
              size="small"
              variant="outlined"
              color="primary"
            />
          </Stack>
          <ActiveComponent />
        </Box>
      </Box>
    </Box>
  );
}
