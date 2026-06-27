import { useState, useRef } from 'react';
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Paper, Stack, Divider, Chip, IconButton, Tooltip,
  Accordion, AccordionSummary, AccordionDetails, useMediaQuery,
  AppBar, Toolbar, alpha,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

// Icons
import RocketLaunchIcon    from '@mui/icons-material/RocketLaunch';
import LockIcon            from '@mui/icons-material/Lock';
import SendIcon            from '@mui/icons-material/Send';
import DescriptionIcon     from '@mui/icons-material/Description';
import WebhookIcon         from '@mui/icons-material/Webhook';
import ContactsIcon        from '@mui/icons-material/Contacts';
import BarChartIcon        from '@mui/icons-material/BarChart';
import CodeIcon            from '@mui/icons-material/Code';
import BuildIcon           from '@mui/icons-material/Build';
import HelpOutlineIcon     from '@mui/icons-material/HelpOutline';
import ContentCopyIcon     from '@mui/icons-material/ContentCopy';
import CheckIcon           from '@mui/icons-material/Check';
import MenuIcon            from '@mui/icons-material/Menu';
import ExpandMoreIcon      from '@mui/icons-material/ExpandMore';
import CheckCircleIcon     from '@mui/icons-material/CheckCircle';
import ArrowRightIcon      from '@mui/icons-material/ArrowRight';
import MenuBookIcon        from '@mui/icons-material/MenuBook';

const DRAWER_WIDTH = 256;

// ─── Sidebar items ────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'getting-started', label: 'Getting Started',  icon: <RocketLaunchIcon /> },
  { id: 'authentication',  label: 'Authentication',   icon: <LockIcon /> },
  { id: 'sending',         label: 'Sending Messages', icon: <SendIcon /> },
  { id: 'templates',       label: 'Templates',        icon: <DescriptionIcon /> },
  { id: 'webhooks',        label: 'Webhooks',         icon: <WebhookIcon /> },
  { id: 'contacts',        label: 'Contacts',         icon: <ContactsIcon /> },
  { id: 'analytics',       label: 'Analytics',        icon: <BarChartIcon /> },
  { id: 'sdk',             label: 'SDK Examples',     icon: <CodeIcon /> },
  { id: 'troubleshooting', label: 'Troubleshooting',  icon: <BuildIcon /> },
  { id: 'faq',             label: 'FAQ',              icon: <HelpOutlineIcon /> },
];

// ─── Code Block ───────────────────────────────────────────────────────────────
function CodeBlock({ code, language = 'http' }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Box sx={{ position: 'relative', mb: 2 }}>
      <Paper
        elevation={0}
        sx={{
          bgcolor: '#1e1e2e',
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: alpha('#fff', 0.08),
        }}
      >
        {/* Header bar */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2, py: 1, bgcolor: alpha('#fff', 0.05), borderBottom: '1px solid', borderColor: alpha('#fff', 0.08) }}
        >
          <Chip
            label={language}
            size="small"
            sx={{ bgcolor: alpha('#cba6f7', 0.2), color: '#cba6f7', fontSize: 11, height: 20 }}
          />
          <Tooltip title={copied ? 'Copied!' : 'Copy code'}>
            <IconButton size="small" onClick={copy} sx={{ color: '#cdd6f4' }}>
              {copied ? <CheckIcon fontSize="small" sx={{ color: '#a6e3a1' }} /> : <ContentCopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 2,
            overflowX: 'auto',
            fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
            fontSize: 13,
            lineHeight: 1.7,
            color: '#cdd6f4',
            '& .comment': { color: '#6c7086' },
            '& .keyword': { color: '#cba6f7' },
            '& .string':  { color: '#a6e3a1' },
            '& .number':  { color: '#fab387' },
          }}
        >
          {code}
        </Box>
      </Paper>
    </Box>
  );
}

// ─── Section: Getting Started ─────────────────────────────────────────────────
function GettingStartedSection() {
  return (
    <Box>
      <SectionTitle icon={<RocketLaunchIcon color="primary" />} title="Getting Started" badge="Quick Start" />
      <Typography variant="body1" color="text.secondary" mb={3}>
        MetaBSP is a WhatsApp Business SaaS platform that lets you send messages, manage templates, run bulk campaigns,
        and automate customer conversations — all through the official Meta Cloud API.
      </Typography>

      <SubHeading>Prerequisites</SubHeading>
      <List disablePadding sx={{ mb: 3 }}>
        {[
          'A Meta Business Account (business.facebook.com)',
          'A verified WhatsApp Business Account (WABA)',
          'A phone number approved for WhatsApp Business API',
          'A MetaBSP account (sign up at app.metabsp.com)',
          'An API access token from your MetaBSP dashboard',
        ].map((item, i) => (
          <Stack key={i} direction="row" alignItems="flex-start" gap={1} mb={1}>
            <CheckCircleIcon fontSize="small" color="success" sx={{ mt: 0.25 }} />
            <Typography variant="body2">{item}</Typography>
          </Stack>
        ))}
      </List>

      <SubHeading>Quick Setup Steps</SubHeading>
      {[
        { step: '1', title: 'Create your MetaBSP account', desc: 'Sign up and verify your email address at metabsp.com.' },
        { step: '2', title: 'Connect your Meta Business Account', desc: 'Navigate to Settings → WhatsApp Accounts and click "Connect Account". Complete the Meta OAuth flow.' },
        { step: '3', title: 'Register your phone number', desc: 'Add and verify a phone number in the WhatsApp Accounts section. You\'ll receive a 6-digit OTP via call or SMS.' },
        { step: '4', title: 'Create your first API token', desc: 'Go to Settings → API Tokens and generate a key. Store it securely — it won\'t be shown again.' },
        { step: '5', title: 'Send your first message', desc: 'Use the dashboard\'s "Send Message" panel or the REST API to send a test message to yourself.' },
      ].map(item => (
        <Paper key={item.step} variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: 2, display: 'flex', gap: 2 }}>
          <Box
            sx={{
              width: 32, height: 32, borderRadius: '50%', bgcolor: 'primary.main',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <Typography variant="caption" fontWeight={700} color="white">{item.step}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" fontWeight={700}>{item.title}</Typography>
            <Typography variant="body2" color="text.secondary">{item.desc}</Typography>
          </Box>
        </Paper>
      ))}
    </Box>
  );
}

// ─── Section: Authentication ──────────────────────────────────────────────────
function AuthenticationSection() {
  return (
    <Box>
      <SectionTitle icon={<LockIcon color="primary" />} title="Authentication" />
      <Typography variant="body2" color="text.secondary" mb={3}>
        MetaBSP supports two authentication methods for API access. All requests must be made over HTTPS.
      </Typography>

      <SubHeading>JWT Bearer Token</SubHeading>
      <Typography variant="body2" color="text.secondary" mb={1.5}>
        Obtain a JWT by logging in via the <code>/api/auth/login</code> endpoint. The token expires after 24 hours.
        Use the <code>Authorization</code> header with a <code>Bearer</code> prefix.
      </Typography>
      <CodeBlock language="http" code={`POST /api/auth/login HTTP/1.1
Content-Type: application/json

{
  "username": "alice@example.com",
  "password": "your_password"
}

# Response
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": "usr_123", "email": "alice@example.com", "role": "admin" }
}

# Use in subsequent requests:
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`} />

      <SubHeading>API Key Authentication</SubHeading>
      <Typography variant="body2" color="text.secondary" mb={1.5}>
        Long-lived API keys are suitable for server-to-server integrations. Generate them in{' '}
        <strong>Settings → API Tokens</strong>. Keys begin with the prefix <code>mbsp_</code>.
      </Typography>
      <CodeBlock language="http" code={`# Pass via header
GET /api/contacts HTTP/1.1
X-Api-Key: mbsp_your_api_key_here

# Or via Authorization header (alternative)
Authorization: Bearer mbsp_your_api_key_here`} />

      <Paper
        variant="outlined"
        sx={{ p: 2, borderRadius: 2, bgcolor: alpha('#FF9800', 0.06), borderColor: alpha('#FF9800', 0.3) }}
      >
        <Typography variant="body2">
          <strong>Security tip:</strong> Never expose API keys in client-side code or public repositories.
          Use environment variables and rotate keys regularly. If a key is compromised, revoke it immediately
          from the Security dashboard.
        </Typography>
      </Paper>
    </Box>
  );
}

// ─── Section: Sending Messages ────────────────────────────────────────────────
function SendingSection() {
  return (
    <Box>
      <SectionTitle icon={<SendIcon color="primary" />} title="Sending Messages" />

      <SubHeading>Text Message</SubHeading>
      <Typography variant="body2" color="text.secondary" mb={1.5}>
        Send a plain text message to a recipient. The phone number must be in E.164 format.
      </Typography>
      <CodeBlock language="javascript" code={`// Node.js example
const axios = require('axios');

const response = await axios.post('https://api.metabsp.com/api/messages/send', {
  to: '+14155552671',
  type: 'text',
  text: { body: 'Hello from MetaBSP! 👋' },
}, {
  headers: {
    'X-Api-Key': process.env.METABSP_API_KEY,
    'Content-Type': 'application/json',
  },
});

console.log(response.data);
// { messageId: 'msg_abc123', status: 'queued', timestamp: '2026-06-27T09:00:00Z' }`} />

      <SubHeading>Template Message</SubHeading>
      <Typography variant="body2" color="text.secondary" mb={1.5}>
        Template messages must be pre-approved by Meta. Pass the template name, language, and any variable components.
      </Typography>
      <CodeBlock language="javascript" code={`const response = await axios.post('https://api.metabsp.com/api/messages/send', {
  to: '+14155552671',
  type: 'template',
  template: {
    name: 'order_confirmation',
    language: { code: 'en_US' },
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'John Doe' },
          { type: 'text', text: 'ORD-98765' },
          { type: 'text', text: '$49.99' },
        ],
      },
    ],
  },
}, { headers: { 'X-Api-Key': process.env.METABSP_API_KEY } });`} />

      <SubHeading>Media Message</SubHeading>
      <Typography variant="body2" color="text.secondary" mb={1.5}>
        Send images, documents, audio, or video. Provide a publicly accessible URL or upload via the Media API first.
      </Typography>
      <CodeBlock language="javascript" code={`// Send an image
await axios.post('https://api.metabsp.com/api/messages/send', {
  to: '+14155552671',
  type: 'image',
  image: {
    link: 'https://cdn.example.com/invoice-preview.png',
    caption: 'Your invoice is ready',
  },
}, { headers: { 'X-Api-Key': process.env.METABSP_API_KEY } });

// Send a PDF document
await axios.post('https://api.metabsp.com/api/messages/send', {
  to: '+14155552671',
  type: 'document',
  document: {
    link: 'https://cdn.example.com/invoice.pdf',
    filename: 'Invoice_2026.pdf',
    caption: 'Please find your invoice attached',
  },
}, { headers: { 'X-Api-Key': process.env.METABSP_API_KEY } });`} />
    </Box>
  );
}

// ─── Section: Templates ───────────────────────────────────────────────────────
function TemplatesSection() {
  return (
    <Box>
      <SectionTitle icon={<DescriptionIcon color="primary" />} title="Message Templates" />
      <Typography variant="body2" color="text.secondary" mb={3}>
        Message templates are pre-approved message formats required for initiating conversations with customers.
        All templates must be approved by Meta before use.
      </Typography>

      <SubHeading>Template Categories</SubHeading>
      <Stack direction="row" flexWrap="wrap" gap={1.5} mb={3}>
        {[
          { cat: 'MARKETING', color: '#FF9800', desc: 'Promotions, offers, announcements' },
          { cat: 'UTILITY',   color: '#2196F3', desc: 'Order updates, alerts, account info' },
          { cat: 'AUTHENTICATION', color: '#4CAF50', desc: 'OTPs, verification codes' },
        ].map(item => (
          <Paper key={item.cat} variant="outlined" sx={{ p: 1.5, borderRadius: 2, minWidth: 160 }}>
            <Chip label={item.cat} size="small" sx={{ bgcolor: alpha(item.color, 0.12), color: item.color, fontWeight: 700, mb: 0.5 }} />
            <Typography variant="caption" color="text.secondary" display="block">{item.desc}</Typography>
          </Paper>
        ))}
      </Stack>

      <SubHeading>Creating a Template</SubHeading>
      <CodeBlock language="javascript" code={`const response = await axios.post('https://api.metabsp.com/api/templates', {
  name: 'order_shipped',
  category: 'UTILITY',
  language: 'en_US',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Your order has shipped! 🚚',
    },
    {
      type: 'BODY',
      text: 'Hi {{1}}, your order #{{2}} has been shipped and is on its way. Expected delivery: {{3}}.',
    },
    {
      type: 'FOOTER',
      text: 'Reply STOP to unsubscribe from shipping updates.',
    },
  ],
}, { headers: { 'X-Api-Key': process.env.METABSP_API_KEY } });

// Response: { templateId: 'tpl_xyz', status: 'PENDING', message: 'Submitted to Meta for review' }`} />

      <SubHeading>Variable Handling</SubHeading>
      <Typography variant="body2" color="text.secondary" mb={1.5}>
        Variables are referenced as <code>{'{{1}}'}</code>, <code>{'{{2}}'}</code>, etc. in template body text.
        When sending, supply matching parameters in the <code>components[].parameters</code> array.
      </Typography>

      <SubHeading>Approval Process</SubHeading>
      {[
        { status: 'PENDING',  color: '#FF9800', desc: 'Submitted and awaiting Meta review (typically 24–48 hours)' },
        { status: 'APPROVED', color: '#4CAF50', desc: 'Template is approved and ready to use' },
        { status: 'REJECTED', color: '#f44336', desc: 'Template was rejected. Edit and resubmit with corrections.' },
        { status: 'DISABLED', color: '#9E9E9E', desc: 'Template has been paused by Meta or manually disabled' },
      ].map(item => (
        <Stack key={item.status} direction="row" gap={2} alignItems="flex-start" mb={1}>
          <Chip label={item.status} size="small" sx={{ bgcolor: alpha(item.color, 0.12), color: item.color, fontWeight: 700, minWidth: 90 }} />
          <Typography variant="body2" color="text.secondary">{item.desc}</Typography>
        </Stack>
      ))}
    </Box>
  );
}

// ─── Section: Webhooks ────────────────────────────────────────────────────────
function WebhooksSection() {
  return (
    <Box>
      <SectionTitle icon={<WebhookIcon color="primary" />} title="Webhooks" />
      <Typography variant="body2" color="text.secondary" mb={3}>
        MetaBSP forwards real-time events from the Meta API to your webhook endpoints.
        Configure webhooks in <strong>Settings → Webhooks</strong>.
      </Typography>

      <SubHeading>Setup</SubHeading>
      <CodeBlock language="javascript" code={`// Register a webhook endpoint
const response = await axios.post('https://api.metabsp.com/api/webhooks', {
  url: 'https://yourapp.example.com/webhooks/whatsapp',
  events: ['message.received', 'message.delivered', 'message.read', 'message.failed'],
  secret: 'your_webhook_signing_secret',
}, { headers: { 'X-Api-Key': process.env.METABSP_API_KEY } });`} />

      <SubHeading>Webhook Payload — Incoming Message</SubHeading>
      <CodeBlock language="json" code={`{
  "event": "message.received",
  "timestamp": "2026-06-27T09:15:42.000Z",
  "wabaId": "waba_123456",
  "data": {
    "messageId": "wamid.ABCDef1234567890",
    "from": "+14155552671",
    "to": "+14155550100",
    "type": "text",
    "text": { "body": "Hello, I have a question about my order." },
    "timestamp": "2026-06-27T09:15:41.000Z",
    "contact": {
      "name": "Jane Smith",
      "waId": "14155552671"
    }
  }
}`} />

      <SubHeading>Webhook Payload — Message Status</SubHeading>
      <CodeBlock language="json" code={`{
  "event": "message.delivered",
  "timestamp": "2026-06-27T09:16:00.000Z",
  "data": {
    "messageId": "msg_abc123",
    "to": "+14155552671",
    "status": "delivered",
    "timestamp": "2026-06-27T09:15:59.000Z"
  }
}`} />

      <SubHeading>Signature Verification</SubHeading>
      <Typography variant="body2" color="text.secondary" mb={1.5}>
        MetaBSP signs every webhook request with HMAC-SHA256 using your webhook secret.
        Always verify the signature before processing the payload.
      </Typography>
      <CodeBlock language="javascript" code={`const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSig, 'hex')
  );
}

// Express.js middleware
app.post('/webhooks/whatsapp', express.json(), (req, res) => {
  const sig = req.headers['x-metabsp-signature'];
  if (!verifyWebhookSignature(req.body, sig, process.env.WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  // Process event
  console.log('Event:', req.body.event);
  res.status(200).json({ ok: true });
});`} />

      <SubHeading>Event Types</SubHeading>
      {[
        'message.received', 'message.delivered', 'message.read',
        'message.failed', 'template.approved', 'template.rejected',
        'account.connected', 'account.disconnected',
      ].map(evt => (
        <Chip key={evt} label={evt} size="small" variant="outlined" sx={{ mr: 1, mb: 1, fontFamily: 'monospace', fontSize: 12 }} />
      ))}
    </Box>
  );
}

// ─── Section: Contacts ────────────────────────────────────────────────────────
function ContactsSection() {
  return (
    <Box>
      <SectionTitle icon={<ContactsIcon color="primary" />} title="Contacts" />
      <Typography variant="body2" color="text.secondary" mb={3}>
        MetaBSP maintains a contact directory synced with your WhatsApp Business conversations.
        Contacts can be tagged, segmented, and targeted in bulk campaigns.
      </Typography>

      <SubHeading>List Contacts</SubHeading>
      <CodeBlock language="javascript" code={`// GET /api/contacts
const { data } = await axios.get('https://api.metabsp.com/api/contacts', {
  params: { page: 1, limit: 50, tag: 'vip', search: 'john' },
  headers: { 'X-Api-Key': process.env.METABSP_API_KEY },
});
// Returns: { contacts: [...], total: 1240, page: 1, pages: 25 }`} />

      <SubHeading>Create / Update a Contact</SubHeading>
      <CodeBlock language="javascript" code={`await axios.post('https://api.metabsp.com/api/contacts', {
  phone: '+14155552671',
  name: 'Jane Smith',
  email: 'jane@example.com',
  tags: ['customer', 'vip'],
  customFields: { orderId: 'ORD-98765', tier: 'gold' },
}, { headers: { 'X-Api-Key': process.env.METABSP_API_KEY } });`} />

      <SubHeading>Bulk Import via CSV</SubHeading>
      <Typography variant="body2" color="text.secondary">
        Upload a CSV file with columns: <code>phone</code>, <code>name</code>, <code>email</code>, <code>tags</code> (comma-separated inside quotes).
        The import is processed asynchronously; check status at <code>GET /api/contacts/imports/:importId</code>.
      </Typography>
    </Box>
  );
}

// ─── Section: Analytics ───────────────────────────────────────────────────────
function AnalyticsSection() {
  return (
    <Box>
      <SectionTitle icon={<BarChartIcon color="primary" />} title="Analytics" />
      <Typography variant="body2" color="text.secondary" mb={3}>
        Track message performance, campaign metrics, and account health through the Analytics API.
      </Typography>

      <SubHeading>Overview Metrics</SubHeading>
      <CodeBlock language="javascript" code={`const { data } = await axios.get('https://api.metabsp.com/api/analytics/overview', {
  params: { from: '2026-06-01', to: '2026-06-27', wabaId: 'waba_123456' },
  headers: { 'X-Api-Key': process.env.METABSP_API_KEY },
});

/*
{
  sent: 12450,
  delivered: 12100,
  read: 8930,
  failed: 350,
  deliveryRate: 97.2,
  readRate: 73.8,
  templateBreakdown: [...]
}
*/`} />

      <SubHeading>Campaign Analytics</SubHeading>
      <CodeBlock language="javascript" code={`const { data } = await axios.get('https://api.metabsp.com/api/analytics/campaigns/camp_xyz', {
  headers: { 'X-Api-Key': process.env.METABSP_API_KEY },
});`} />
    </Box>
  );
}

// ─── Section: SDK Examples ────────────────────────────────────────────────────
function SdkSection() {
  return (
    <Box>
      <SectionTitle icon={<CodeIcon color="primary" />} title="SDK Examples" />

      <SubHeading>Node.js</SubHeading>
      <CodeBlock language="javascript" code={`npm install @metabsp/sdk

// Usage
const MetaBSP = require('@metabsp/sdk');
const client = new MetaBSP({ apiKey: process.env.METABSP_API_KEY });

// Send a text message
const result = await client.messages.send({
  to: '+14155552671',
  type: 'text',
  text: { body: 'Hello from MetaBSP Node.js SDK!' },
});

// List templates
const templates = await client.templates.list({ status: 'APPROVED' });
console.log(templates);`} />

      <SubHeading>Python</SubHeading>
      <CodeBlock language="python" code={`pip install metabsp-sdk

# Usage
from metabsp import MetaBSP

client = MetaBSP(api_key=os.environ['METABSP_API_KEY'])

# Send a text message
result = client.messages.send(
    to='+14155552671',
    type='text',
    text={'body': 'Hello from MetaBSP Python SDK!'}
)

# Send a template message
result = client.messages.send(
    to='+14155552671',
    type='template',
    template={
        'name': 'order_confirmation',
        'language': {'code': 'en_US'},
        'components': [
            {
                'type': 'body',
                'parameters': [
                    {'type': 'text', 'text': 'Jane'},
                    {'type': 'text', 'text': 'ORD-001'},
                ],
            }
        ],
    }
)`} />

      <SubHeading>cURL</SubHeading>
      <CodeBlock language="bash" code={`# Send a text message
curl -X POST https://api.metabsp.com/api/messages/send \\
  -H "X-Api-Key: mbsp_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+14155552671",
    "type": "text",
    "text": { "body": "Hello from cURL!" }
  }'

# List templates
curl https://api.metabsp.com/api/templates?status=APPROVED \\
  -H "X-Api-Key: mbsp_your_api_key"

# Get analytics overview
curl "https://api.metabsp.com/api/analytics/overview?from=2026-06-01&to=2026-06-27" \\
  -H "X-Api-Key: mbsp_your_api_key"`} />
    </Box>
  );
}

// ─── Section: Troubleshooting ─────────────────────────────────────────────────
function TroubleshootingSection() {
  const items = [
    {
      problem: '401 Unauthorized on API requests',
      solution: 'Check that your API key or JWT token is correctly set in the Authorization or X-Api-Key header. JWTs expire after 24 hours — re-authenticate to get a fresh token.',
    },
    {
      problem: 'Messages stuck in "queued" status',
      solution: 'Verify that your WhatsApp Business Account is connected and the phone number is active. Check the account health in Settings → WhatsApp Accounts.',
    },
    {
      problem: 'Template rejected by Meta',
      solution: 'Common reasons: promotional content in UTILITY templates, use of restricted words (e.g. "free", "guaranteed"), or placeholder variables not matching expected types. Review Meta\'s template guidelines and resubmit.',
    },
    {
      problem: 'Webhook not receiving events',
      solution: 'Ensure your webhook URL is publicly accessible (not localhost). The endpoint must respond with HTTP 200 within 5 seconds. Check the webhook logs in Settings → Webhooks → Delivery History.',
    },
    {
      problem: '429 Rate Limit Exceeded',
      solution: 'MetaBSP enforces rate limits aligned with Meta\'s API limits. Implement exponential backoff with jitter in your retry logic. Check your current rate limit tier in Settings → Billing.',
    },
  ];

  return (
    <Box>
      <SectionTitle icon={<BuildIcon color="primary" />} title="Troubleshooting" />
      <Stack spacing={2}>
        {items.map((item, i) => (
          <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="body2" fontWeight={700} mb={0.5} color="error.main">
              Problem: {item.problem}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Solution: {item.solution}
            </Typography>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}

// ─── Section: FAQ ─────────────────────────────────────────────────────────────
function FaqSection() {
  const faqs = [
    {
      q: 'Do I need a Meta Business Account to use MetaBSP?',
      a: 'Yes. MetaBSP uses the official WhatsApp Cloud API, which requires a verified Meta Business Account and an approved WhatsApp Business Account (WABA). You can create one at business.facebook.com.',
    },
    {
      q: 'What is the difference between API keys and JWT tokens?',
      a: 'JWT tokens are short-lived (24 hours) and are obtained by logging in with your credentials. API keys are long-lived tokens best suited for server-to-server integrations where a human login is not practical. Use API keys in production backends.',
    },
    {
      q: 'How long does template approval take?',
      a: 'Meta typically reviews templates within 24–48 hours. Approval times can vary based on volume and template category. AUTHENTICATION templates are usually approved faster than MARKETING templates.',
    },
    {
      q: 'Can I send messages to users who have not messaged me first?',
      a: 'Yes, but only using pre-approved message templates. To initiate a conversation outside a 24-hour customer service window, you must use a template message. Free-form messages can only be sent within 24 hours of the customer\'s last message.',
    },
    {
      q: 'What file types are supported for media messages?',
      a: 'Image: JPEG, PNG (max 5MB). Video: MP4, 3GPP (max 16MB). Audio: AAC, MP4, AMR, OGG (max 16MB). Document: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX (max 100MB).',
    },
    {
      q: 'Is there a sandbox/test environment?',
      a: 'Yes. Enable test mode in Settings → WhatsApp Accounts → Test Mode. In test mode, messages are not actually sent to recipients, and you can use any phone number format for testing.',
    },
    {
      q: 'How do I handle opt-outs (STOP messages)?',
      a: 'MetaBSP automatically handles opt-out keywords (STOP, UNSUBSCRIBE, etc.) and marks contacts as opted out. Opted-out contacts are excluded from future campaigns. You can view and manage opt-outs in Contacts → Opt-Outs.',
    },
    {
      q: 'What are the pricing tiers?',
      a: 'MetaBSP charges per conversation (a 24-hour messaging window). Pricing varies by conversation category (marketing, utility, authentication, service) and destination country, following Meta\'s published pricing. See our billing page for the current rate card.',
    },
  ];

  return (
    <Box>
      <SectionTitle icon={<HelpOutlineIcon color="primary" />} title="Frequently Asked Questions" />
      {faqs.map((faq, i) => (
        <Accordion key={i} variant="outlined" sx={{ mb: 1, borderRadius: '8px !important', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2" fontWeight={600}>{faq.q}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Typography variant="body2" color="text.secondary">{faq.a}</Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SectionTitle({ icon, title, badge }) {
  return (
    <Stack direction="row" alignItems="center" gap={1.5} mb={2}>
      {icon}
      <Typography variant="h5" fontWeight={700}>{title}</Typography>
      {badge && <Chip label={badge} size="small" color="primary" />}
    </Stack>
  );
}

function SubHeading({ children }) {
  return (
    <Typography variant="subtitle1" fontWeight={700} mb={1} mt={2.5} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <ArrowRightIcon color="primary" fontSize="small" />
      {children}
    </Typography>
  );
}

// ─── Section map ──────────────────────────────────────────────────────────────
const SECTIONS = {
  'getting-started': GettingStartedSection,
  'authentication':  AuthenticationSection,
  'sending':         SendingSection,
  'templates':       TemplatesSection,
  'webhooks':        WebhooksSection,
  'contacts':        ContactsSection,
  'analytics':       AnalyticsSection,
  'sdk':             SdkSection,
  'troubleshooting': TroubleshootingSection,
  'faq':             FaqSection,
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DocumentationPage() {
  const [active, setActive]       = useState('getting-started');
  const [drawerOpen, setDrawer]   = useState(false);
  const theme                     = useTheme();
  const isMobile                  = useMediaQuery(theme.breakpoints.down('md'));

  const ActiveSection = SECTIONS[active];

  const sidebar = (
    <Box sx={{ width: DRAWER_WIDTH, pt: 1 }}>
      <Stack direction="row" alignItems="center" gap={1.5} px={2} py={1.5} mb={1}>
        <MenuBookIcon color="primary" />
        <Typography variant="subtitle1" fontWeight={700}>Documentation</Typography>
      </Stack>
      <Divider />
      <List dense disablePadding sx={{ pt: 1 }}>
        {NAV_ITEMS.map(item => (
          <ListItemButton
            key={item.id}
            selected={active === item.id}
            onClick={() => { setActive(item.id); if (isMobile) setDrawer(false); }}
            sx={{
              mx: 1,
              borderRadius: 1.5,
              mb: 0.25,
              '&.Mui-selected': {
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
                '& .MuiListItemIcon-root': { color: 'primary.main' },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={<Typography variant="body2" fontWeight={active === item.id ? 700 : 400}>{item.label}</Typography>} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100%' }}>
      {/* Desktop persistent sidebar */}
      {!isMobile && (
        <Box
          component="nav"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            borderRight: '1px solid',
            borderColor: 'divider',
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflowY: 'auto',
          }}
        >
          {sidebar}
        </Box>
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <Drawer open={drawerOpen} onClose={() => setDrawer(false)} sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}>
          {sidebar}
        </Drawer>
      )}

      {/* Main content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Mobile top bar */}
        {isMobile && (
          <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
            <Toolbar variant="dense">
              <IconButton edge="start" onClick={() => setDrawer(true)} sx={{ mr: 1 }}>
                <MenuIcon />
              </IconButton>
              <Typography variant="subtitle1" fontWeight={700}>
                {NAV_ITEMS.find(n => n.id === active)?.label || 'Docs'}
              </Typography>
            </Toolbar>
          </AppBar>
        )}

        <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 860, mx: 'auto' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <ActiveSection />
            </motion.div>
          </AnimatePresence>
        </Box>
      </Box>
    </Box>
  );
}
