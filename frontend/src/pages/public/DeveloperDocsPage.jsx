import React, { useState } from 'react';
import {
  Container, Typography, Box, Paper, Divider, List, ListItem,
  ListItemButton, ListItemText, Chip, Stack, useTheme, useMediaQuery
} from '@mui/material';
import { motion } from 'framer-motion';

const CodeBlock = ({ code, language = 'javascript' }) => (
  <Box
    component="pre"
    sx={{
      bgcolor: '#1a2332',
      color: '#e2e8f0',
      p: 2.5,
      borderRadius: 2,
      overflowX: 'auto',
      fontSize: '0.82rem',
      fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
      lineHeight: 1.7,
      my: 2,
      border: '1px solid rgba(255,255,255,0.08)',
    }}
  >
    <Box component="span" sx={{ color: '#64748b', fontSize: '0.75rem', display: 'block', mb: 1 }}>// {language}</Box>
    <code>{code}</code>
  </Box>
);

const Section = ({ id, title, children }) => (
  <Box id={id} sx={{ mb: 6 }}>
    <Typography variant="h4" fontWeight={800} sx={{ mb: 2 }}>{title}</Typography>
    <Divider sx={{ mb: 3 }} />
    {children}
  </Box>
);

const SubSection = ({ title, children }) => (
  <Box sx={{ mb: 3 }}>
    <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>{title}</Typography>
    {children}
  </Box>
);

const Para = ({ children }) => (
  <Typography variant="body1" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.8 }}>
    {children}
  </Typography>
);

const NAV_ITEMS = [
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'send-messages', label: 'Sending Messages' },
  { id: 'templates', label: 'Template API' },
  { id: 'sdk-nodejs', label: 'Node.js SDK' },
  { id: 'sdk-python', label: 'Python SDK' },
  { id: 'error-codes', label: 'Error Codes' },
];

export default function DeveloperDocsPage() {
  const [activeSection, setActiveSection] = useState('getting-started');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleNav = (id) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
        <Box sx={{ bgcolor: '#111b21', color: 'white', py: { xs: 6, md: 8 }, textAlign: 'center' }}>
          <Container maxWidth="md">
            <Chip label="API v1" color="primary" size="small" sx={{ mb: 2 }} />
            <Typography variant="h3" fontWeight={800} sx={{ mb: 1.5, color: 'white' }}>Developer Documentation</Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Everything you need to integrate MetaBSP's WhatsApp API into your application
            </Typography>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ py: 6 }}>
          <Box sx={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
            {!isMobile && (
              <Box sx={{ width: 220, flexShrink: 0, position: 'sticky', top: 80 }}>
                <Paper elevation={0} sx={{ p: 1.5, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="caption" color="text.disabled" sx={{ px: 1.5, py: 1, display: 'block', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Contents
                  </Typography>
                  <List dense disablePadding>
                    {NAV_ITEMS.map((item) => (
                      <ListItem key={item.id} disablePadding>
                        <ListItemButton
                          onClick={() => handleNav(item.id)}
                          selected={activeSection === item.id}
                          sx={{ borderRadius: 2, py: 0.75 }}
                        >
                          <ListItemText
                            primary={item.label}
                            primaryTypographyProps={{ variant: 'body2', fontWeight: activeSection === item.id ? 700 : 400 }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Box>
            )}

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Section id="getting-started" title="Getting Started">
                <Para>
                  The MetaBSP API is a REST API that allows you to send and receive WhatsApp messages through Meta's WhatsApp Business Platform. All requests are made over HTTPS to our base URL.
                </Para>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'action.hover', mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight={700}>Base URL</Typography>
                  <CodeBlock code="https://api.metabsp.com/v1" language="Base URL" />
                </Paper>

                <SubSection title="Quick Start">
                  <Para>Follow these steps to send your first WhatsApp message:</Para>
                  <Box component="ol" sx={{ pl: 3 }}>
                    {[
                      'Create a MetaBSP account and connect your WhatsApp Business Account',
                      'Navigate to Settings → API Keys and generate your first API key',
                      'Use the API key to authenticate requests (Bearer token in Authorization header)',
                      'Send a test message using the /messages endpoint',
                    ].map((step, i) => (
                      <Box component="li" key={i} sx={{ mb: 0.75 }}>
                        <Typography variant="body2" color="text.secondary">{step}</Typography>
                      </Box>
                    ))}
                  </Box>
                </SubSection>
              </Section>

              <Section id="authentication" title="Authentication">
                <Para>
                  MetaBSP uses API keys to authenticate requests. Include your API key in the Authorization header of every request as a Bearer token.
                </Para>
                <SubSection title="API Key Authentication">
                  <CodeBlock
                    code={`curl -X GET https://api.metabsp.com/v1/account \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}
                    language="Shell"
                  />
                </SubSection>

                <SubSection title="JWT Authentication (Server-to-Server)">
                  <Para>
                    For server-to-server integrations, you can use short-lived JWT tokens. Request a token using your API key, then use the JWT for subsequent requests.
                  </Para>
                  <CodeBlock
                    code={`// Step 1: Exchange API key for JWT
const response = await fetch('https://api.metabsp.com/v1/auth/token', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ expires_in: 3600 }), // 1 hour
});
const { token } = await response.json();

// Step 2: Use JWT for requests
const messages = await fetch('https://api.metabsp.com/v1/messages', {
  headers: { 'Authorization': \`Bearer \${token}\` },
});`}
                    language="JavaScript"
                  />
                </SubSection>

                <SubSection title="API Key Scopes">
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label="messages:read" size="small" variant="outlined" />
                    <Chip label="messages:write" size="small" variant="outlined" />
                    <Chip label="templates:read" size="small" variant="outlined" />
                    <Chip label="templates:write" size="small" variant="outlined" />
                    <Chip label="contacts:read" size="small" variant="outlined" />
                    <Chip label="contacts:write" size="small" variant="outlined" />
                    <Chip label="webhooks:manage" size="small" variant="outlined" />
                    <Chip label="account:read" size="small" variant="outlined" />
                  </Stack>
                </SubSection>
              </Section>

              <Section id="webhooks" title="Webhook Setup">
                <Para>
                  Webhooks allow MetaBSP to push real-time events to your server when things happen — like a message being received or a delivery receipt arriving.
                </Para>

                <SubSection title="Configure a Webhook">
                  <Para>Set up a webhook endpoint in your dashboard or via API:</Para>
                  <CodeBlock
                    code={`curl -X POST https://api.metabsp.com/v1/webhooks \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-app.com/webhooks/whatsapp",
    "events": ["message.received", "message.delivered", "message.read", "template.approved"],
    "active": true
  }'`}
                    language="Shell"
                  />
                </SubSection>

                <SubSection title="Verifying Webhook Signatures">
                  <Para>
                    Every webhook request includes a signature in the <code>X-MetaBSP-Signature-256</code> header. Verify this signature to ensure the request is from MetaBSP.
                  </Para>
                  <CodeBlock
                    code={`const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
}

// Express.js middleware
app.post('/webhooks/whatsapp', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-metabsp-signature-256'];
  const webhookSecret = process.env.METABSP_WEBHOOK_SECRET;

  if (!verifyWebhookSignature(req.body, signature, webhookSecret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(req.body);
  console.log('Event type:', event.type);

  // Process the event...

  res.status(200).json({ received: true });
});`}
                    language="Node.js"
                  />
                </SubSection>

                <SubSection title="Webhook Event Schema">
                  <CodeBlock
                    code={`{
  "id": "evt_01H8X3K2P9Q7R4M5N6T8W1Y2Z3",
  "type": "message.received",
  "created_at": "2025-06-15T10:30:00Z",
  "phone_number_id": "pn_abc123",
  "data": {
    "message_id": "wamid.HBgLMTY1MDUyOTAzNTYVAgARGBI...",
    "from": "+14155552671",
    "timestamp": "2025-06-15T10:29:58Z",
    "type": "text",
    "text": {
      "body": "Hello! I'd like to know more about your products."
    }
  }
}`}
                    language="JSON"
                  />
                </SubSection>
              </Section>

              <Section id="send-messages" title="Sending Messages">
                <SubSection title="Send a Text Message">
                  <CodeBlock
                    code={`curl -X POST https://api.metabsp.com/v1/messages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone_number_id": "YOUR_PHONE_NUMBER_ID",
    "to": "+14155552671",
    "type": "text",
    "text": {
      "body": "Hello! Thanks for contacting us. How can we help you today?"
    }
  }'`}
                    language="Shell"
                  />
                </SubSection>

                <SubSection title="Send a Template Message">
                  <CodeBlock
                    code={`curl -X POST https://api.metabsp.com/v1/messages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone_number_id": "YOUR_PHONE_NUMBER_ID",
    "to": "+14155552671",
    "type": "template",
    "template": {
      "name": "order_confirmation",
      "language": { "code": "en_US" },
      "components": [
        {
          "type": "body",
          "parameters": [
            { "type": "text", "text": "John" },
            { "type": "text", "text": "ORD-12345" },
            { "type": "text", "text": "$49.99" }
          ]
        }
      ]
    }
  }'`}
                    language="Shell"
                  />
                </SubSection>

                <SubSection title="Send Media (Image)">
                  <CodeBlock
                    code={`curl -X POST https://api.metabsp.com/v1/messages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone_number_id": "YOUR_PHONE_NUMBER_ID",
    "to": "+14155552671",
    "type": "image",
    "image": {
      "link": "https://your-cdn.com/product-image.jpg",
      "caption": "Check out our new product!"
    }
  }'`}
                    language="Shell"
                  />
                </SubSection>
              </Section>

              <Section id="templates" title="Template API">
                <SubSection title="List Templates">
                  <CodeBlock
                    code={`const response = await fetch(
  'https://api.metabsp.com/v1/templates?status=APPROVED&limit=20',
  {
    headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
  }
);

const { templates, pagination } = await response.json();
// templates: [{ id, name, status, category, language, components }]`}
                    language="JavaScript"
                  />
                </SubSection>

                <SubSection title="Create a Template">
                  <CodeBlock
                    code={`const response = await fetch('https://api.metabsp.com/v1/templates', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'appointment_reminder',
    category: 'UTILITY',
    language: 'en_US',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Appointment Reminder',
      },
      {
        type: 'BODY',
        text: 'Hi {{1}}, this is a reminder for your appointment on {{2}} at {{3}}. Reply CONFIRM to confirm or CANCEL to cancel.',
      },
      {
        type: 'FOOTER',
        text: 'Reply STOP to unsubscribe',
      },
    ],
  }),
});

const template = await response.json();
// { id, name, status: 'PENDING', ... }`}
                    language="JavaScript"
                  />
                </SubSection>
              </Section>

              <Section id="sdk-nodejs" title="Node.js SDK">
                <SubSection title="Installation">
                  <CodeBlock code={`npm install @metabsp/sdk`} language="Shell" />
                </SubSection>

                <SubSection title="Basic Usage">
                  <CodeBlock
                    code={`const { MetaBSP } = require('@metabsp/sdk');

const client = new MetaBSP({
  apiKey: process.env.METABSP_API_KEY,
  phoneNumberId: process.env.PHONE_NUMBER_ID,
});

// Send a text message
const result = await client.messages.send({
  to: '+14155552671',
  type: 'text',
  text: { body: 'Hello from MetaBSP Node.js SDK!' },
});

console.log('Message ID:', result.messageId);

// Listen for incoming messages
client.on('message.received', (event) => {
  console.log('Received:', event.data.text.body);
  // Reply to the sender
  client.messages.send({
    to: event.data.from,
    type: 'text',
    text: { body: 'Thanks for your message! We\'ll be in touch soon.' },
  });
});

// Start webhook listener (development only)
await client.webhooks.startLocalServer({ port: 3001 });`}
                    language="JavaScript (Node.js)"
                  />
                </SubSection>

                <SubSection title="Template Sending">
                  <CodeBlock
                    code={`const result = await client.messages.sendTemplate({
  to: '+14155552671',
  templateName: 'order_shipped',
  languageCode: 'en_US',
  parameters: {
    body: ['John', 'ORD-12345', 'FedEx', 'Dec 20'],
  },
});`}
                    language="JavaScript (Node.js)"
                  />
                </SubSection>
              </Section>

              <Section id="sdk-python" title="Python SDK">
                <SubSection title="Installation">
                  <CodeBlock code={`pip install metabsp`} language="Shell" />
                </SubSection>

                <SubSection title="Basic Usage">
                  <CodeBlock
                    code={`import os
from metabsp import MetaBSP

client = MetaBSP(
    api_key=os.environ["METABSP_API_KEY"],
    phone_number_id=os.environ["PHONE_NUMBER_ID"],
)

# Send a text message
result = client.messages.send(
    to="+14155552671",
    type="text",
    text={"body": "Hello from MetaBSP Python SDK!"},
)
print(f"Message ID: {result.message_id}")

# Send a template
result = client.messages.send_template(
    to="+14155552671",
    template_name="order_confirmation",
    language_code="en_US",
    parameters={
        "body": ["Alice", "ORD-98765", "$120.00"],
    },
)

# List approved templates
templates = client.templates.list(status="APPROVED")
for template in templates:
    print(f"{template.name}: {template.status}")`}
                    language="Python"
                  />
                </SubSection>

                <SubSection title="Webhook Handler (Flask)">
                  <CodeBlock
                    code={`from flask import Flask, request, jsonify
from metabsp import verify_signature

app = Flask(__name__)
WEBHOOK_SECRET = os.environ["METABSP_WEBHOOK_SECRET"]

@app.route('/webhooks/whatsapp', methods=['POST'])
def handle_webhook():
    signature = request.headers.get('X-MetaBSP-Signature-256')
    payload = request.get_data()

    if not verify_signature(payload, signature, WEBHOOK_SECRET):
        return jsonify({"error": "Invalid signature"}), 401

    event = request.get_json()

    if event["type"] == "message.received":
        message = event["data"]
        print(f"Received message from {message['from']}: {message['text']['body']}")

    return jsonify({"received": True}), 200`}
                    language="Python (Flask)"
                  />
                </SubSection>
              </Section>

              <Section id="error-codes" title="Error Codes">
                <Para>All API errors return a JSON body with an error code and message. HTTP status codes follow standard conventions.</Para>
                <Box sx={{ overflowX: 'auto' }}>
                  <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <Box component="thead">
                      <Box component="tr" sx={{ bgcolor: 'action.hover' }}>
                        {['HTTP Status', 'Error Code', 'Description'].map((h) => (
                          <Box component="th" key={h} sx={{ p: 1.5, textAlign: 'left', fontWeight: 700, borderBottom: '2px solid', borderColor: 'divider' }}>
                            {h}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                    <Box component="tbody">
                      {[
                        ['400', 'INVALID_REQUEST', 'Request body is malformed or missing required fields'],
                        ['401', 'UNAUTHORIZED', 'Missing or invalid API key'],
                        ['403', 'FORBIDDEN', 'API key does not have permission for this action'],
                        ['404', 'NOT_FOUND', 'The requested resource was not found'],
                        ['422', 'VALIDATION_ERROR', 'Request failed validation (details in errors array)'],
                        ['429', 'RATE_LIMITED', 'Too many requests. Check Retry-After header'],
                        ['500', 'INTERNAL_ERROR', 'Internal server error. Contact support if persistent'],
                        ['503', 'SERVICE_UNAVAILABLE', 'MetaBSP or WhatsApp API is temporarily unavailable'],
                      ].map(([status, code, desc], i) => (
                        <Box component="tr" key={i} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                          <Box component="td" sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                            <Chip label={status} size="small" color={status.startsWith('4') || status.startsWith('5') ? 'error' : 'success'} variant="outlined" />
                          </Box>
                          <Box component="td" sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', fontFamily: 'monospace', fontSize: '0.8rem' }}>{code}</Box>
                          <Box component="td" sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', color: 'text.secondary' }}>{desc}</Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Box>
              </Section>
            </Box>
          </Box>
        </Container>
      </Box>
    </motion.div>
  );
}
