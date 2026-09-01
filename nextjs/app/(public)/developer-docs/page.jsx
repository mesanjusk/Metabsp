'use client';

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

/**
 * The public API reference.
 *
 * What was here before documented an API this platform does not have: a base
 * URL of /api with /api/messages, /api/webhooks, /api/account and
 * /api/auth/token, plus a Node SDK on npm and a Python package on PyPI that
 * were never published. Every request an integrator copied out of it returned
 * 404, and the two install commands failed outright. Documentation that
 * cannot be followed is worse than none — it costs a developer an afternoon
 * before they conclude the product is broken.
 *
 * Everything below is generated from the routes that actually exist under
 * app/api/v1 and the delivery code in lib/whatsapp/webhookProcessing.ts. When
 * an endpoint changes, this page changes with it.
 */
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://meta.sanjusk.in';

const NAV_ITEMS = [
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'send-messages', label: 'Sending Messages' },
  { id: 'receive-messages', label: 'Receiving Messages' },
  { id: 'templates', label: 'Templates' },
  { id: 'error-codes', label: 'Errors & Limits' },
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
              Send WhatsApp messages from your own systems, and receive every reply into them.
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
                  A REST API over HTTPS. It is available to every account — nothing has to be
                  enabled by an administrator. A key acts as its owner, on the WhatsApp number that
                  owner connected, and can never see or send from anyone else&apos;s.
                </Para>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'action.hover', mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight={700}>Base URL</Typography>
                  <CodeBlock code={`${BASE_URL}/api/v1`} language="Base URL" />
                </Paper>

                <SubSection title="Three steps to your first message">
                  <Box component="ol" sx={{ pl: 3 }}>
                    {[
                      'Sign in and connect a WhatsApp number under Platform → Numbers.',
                      'Go to Developers → API keys and create a key. It is shown once — store it where your code reads its secrets.',
                      'Call GET /api/v1/status to confirm the key works and see which number it sends from.',
                      'Send with POST /api/v1/send-template, or POST /api/v1/send-text if the person messaged you in the last 24 hours.',
                    ].map((step, i) => (
                      <Box component="li" key={i} sx={{ mb: 0.75 }}>
                        <Typography variant="body2" color="text.secondary">{step}</Typography>
                      </Box>
                    ))}
                  </Box>
                </SubSection>

                <SubSection title="Check your key">
                  <CodeBlock
                    language="Shell"
                    code={`curl ${BASE_URL}/api/v1/status \\
  -H "Authorization: Bearer mbsp_your_key_here"

# {
#   "success": true,
#   "data": {
#     "connected": true,
#     "phoneNumberId": "123456789012345",
#     "displayPhoneNumber": "+91 98765 43210",
#     "verifiedName": "Acme Support",
#     "connectionMode": "embedded_signup",
#     "qualityRating": "GREEN",
#     "status": "active"
#   }
# }`}
                  />
                </SubSection>
              </Section>

              <Section id="authentication" title="Authentication">
                <Para>
                  Every request carries an API key as a bearer token. There is no separate token
                  exchange step and no session to refresh — the key you create is the credential.
                </Para>
                <CodeBlock language="Shell" code={`Authorization: Bearer mbsp_your_key_here`} />
                <Para>
                  Keys are stored hashed, so a lost key cannot be recovered — revoke it and create
                  another. Revocation takes effect immediately. Never put a key in a repository, a
                  mobile app or a front-end bundle: anyone holding it can send messages as you.
                </Para>
                <SubSection title="Scopes">
                  <Para>Each key carries the scopes you granted it when you created it.</Para>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label="messages:send" size="small" variant="outlined" />
                    <Chip label="messages:read" size="small" variant="outlined" />
                    <Chip label="templates:read" size="small" variant="outlined" />
                  </Stack>
                </SubSection>
              </Section>

              <Section id="send-messages" title="Sending Messages">
                <Para>
                  Which endpoint you need is decided by Meta&apos;s rule, not by preference: you may
                  send free-form content only within 24 hours of that person&apos;s last message to
                  you. Outside that window it must be an approved template. If you are starting the
                  conversation, it is always a template.
                </Para>

                <SubSection title="Template message">
                  <Para>
                    Works at any time. Reach for this by default.
                  </Para>
                  <CodeBlock
                    language="Shell"
                    code={`curl -X POST ${BASE_URL}/api/v1/send-template \\
  -H "Authorization: Bearer mbsp_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "919876543210",
    "template": "order_shipped",
    "language": "en_US",
    "components": [
      {
        "type": "body",
        "parameters": [{ "type": "text", "text": "AC-1042" }]
      }
    ]
  }'`}
                  />
                </SubSection>

                <SubSection title="Free-form text">
                  <Para>
                    Inside the 24-hour window only. Outside it you get a 403 with{' '}
                    <code>code: &quot;OUTSIDE_24H_WINDOW&quot;</code> telling you to send a template
                    instead — handle that case rather than treating it as an outage.
                  </Para>
                  <CodeBlock
                    language="Shell"
                    code={`curl -X POST ${BASE_URL}/api/v1/send-text \\
  -H "Authorization: Bearer mbsp_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{ "phone": "919876543210", "text": "Your order is on its way." }'`}
                  />
                </SubSection>

                <SubSection title="Media">
                  <Para>
                    An image, video, audio file, document or sticker, by public HTTPS URL. Same
                    24-hour rule as text.
                  </Para>
                  <CodeBlock
                    language="Shell"
                    code={`curl -X POST ${BASE_URL}/api/v1/send-media \\
  -H "Authorization: Bearer mbsp_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "919876543210",
    "type": "image",
    "link": "https://example.com/invoice.png",
    "caption": "Your invoice",
    "filename": "invoice.png"
  }'`}
                  />
                </SubSection>
              </Section>

              <Section id="receive-messages" title="Receiving Messages">
                <Para>
                  Two ways in, delivering the same messages. Pick the one that matches where your
                  code runs — you do not need both.
                </Para>

                <SubSection title="Option 1 — we push to you">
                  <Para>
                    Add your endpoint under <strong>Developers → Webhook destinations</strong> in
                    the dashboard. Every inbound message on your number is POSTed to it as it
                    arrives. You can register several, one per project, each with its own signing
                    secret. A failed delivery is retried twice, after 5 and 15 seconds.
                  </Para>
                  <CodeBlock
                    language="HTTP"
                    code={`POST https://your-app.example/webhooks/whatsapp
Content-Type: application/json
X-Metabsp-Event: message.received
X-Metabsp-Signature-256: sha256=<hmac of the raw body, using your secret>

{
  "from": "919876543210",
  "to": "15550001111",
  "phoneNumberId": "123456789012345",
  "type": "text",
  "message": "Where is my order?",
  "messageId": "wamid.HBgM...",
  "timestamp": "2026-09-01T10:00:00.000Z"
}`}
                  />

                  <Para>
                    Your URL is reachable by anyone who guesses it, so the header is what proves the
                    request came from us. Compute the HMAC over the <em>raw</em> body — parse the
                    JSON only after it matches, and compare in constant time.
                  </Para>
                  <CodeBlock
                    language="Node.js"
                    code={`const crypto = require('crypto');

app.post('/webhooks/whatsapp', express.raw({ type: 'application/json' }), (req, res) => {
  const expected =
    'sha256=' + crypto.createHmac('sha256', process.env.METABSP_WEBHOOK_SECRET)
      .update(req.body)
      .digest('hex');
  const received = req.get('X-Metabsp-Signature-256') || '';

  const ok =
    received.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  if (!ok) return res.sendStatus(403);

  const event = JSON.parse(req.body);
  // Answer within a few seconds; do the real work afterwards.
  res.sendStatus(200);
});`}
                  />
                </SubSection>

                <SubSection title="Routing between several destinations">
                  <Para>
                    If you register more than one destination, give each an <strong>entry
                    keyword</strong>. A message starting with that keyword is routed to that
                    destination, and the rest of that conversation stays with it until the person
                    goes quiet or sends STOP. A message that matches no keyword goes to every
                    destination that has no keyword of its own, plus any marked as a fan-out
                    fallback. With a single destination and no keyword, you simply receive
                    everything.
                  </Para>
                </SubSection>

                <SubSection title="Option 2 — you poll us">
                  <Para>
                    For anything that cannot host a public endpoint: a desktop tool, a script behind
                    NAT, a scheduled job. Pass the <code>nextSince</code> value from the previous
                    response and you cannot miss a message or receive one twice. The cursor is a
                    timestamp, not an offset, so new messages never shift the page under you.
                  </Para>
                  <CodeBlock
                    language="Shell"
                    code={`curl "${BASE_URL}/api/v1/messages?since=2026-09-01T10:00:00Z&direction=incoming" \\
  -H "Authorization: Bearer mbsp_your_key_here"

# {
#   "success": true,
#   "data": [
#     { "id": "...", "from": "919876543210", "type": "text",
#       "text": "Where is my order?", "timestamp": "2026-09-01T10:05:00.000Z" }
#   ],
#   "nextSince": "2026-09-01T10:05:00.000Z",
#   "hasMore": false
# }`}
                  />
                  <Para>
                    Query parameters: <code>since</code> (ISO timestamp), <code>direction</code> (
                    <code>incoming</code> or <code>outgoing</code>), <code>phone</code>, and{' '}
                    <code>limit</code> (up to 200). Messages come back oldest first.
                  </Para>
                </SubSection>
              </Section>

              <Section id="templates" title="Templates">
                <Para>
                  The approved templates this key may send, so you do not have to copy names out of
                  the dashboard by hand. Read-only on purpose: creating a template is a reviewed,
                  consequential action that belongs behind a signed-in session rather than an
                  automation key.
                </Para>
                <CodeBlock
                  language="Shell"
                  code={`curl ${BASE_URL}/api/v1/templates \\
  -H "Authorization: Bearer mbsp_your_key_here"`}
                />
              </Section>

              <Section id="error-codes" title="Errors & Limits">
                <Para>
                  Every error is JSON with <code>success: false</code>, the <code>operation</code>{' '}
                  that failed, and a human-readable <code>message</code>. Where Meta returned a code
                  of its own it is passed through unchanged as <code>code</code>.
                </Para>

                <SubSection title="Rate limit">
                  <Para>
                    60 requests per minute per key for sending, 120 per minute for{' '}
                    <code>GET /api/v1/messages</code>. Exceeding it returns 429 with a{' '}
                    <code>Retry-After</code> header in seconds. The limit is per key, not per
                    account, so one runaway integration cannot consume another&apos;s budget.
                  </Para>
                </SubSection>

                <SubSection title="Status codes">
                  <Box sx={{ overflowX: 'auto' }}>
                    <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                      <Box component="thead">
                        <Box component="tr">
                          {['Status', 'Meaning', 'What to do'].map((h) => (
                            <Box
                              key={h}
                              component="th"
                              sx={{ textAlign: 'left', p: 1.5, borderBottom: '2px solid', borderColor: 'divider', fontWeight: 700 }}
                            >
                              {h}
                            </Box>
                          ))}
                        </Box>
                      </Box>
                      <Box component="tbody">
                        {[
                          ['400', 'A required field is missing or malformed', 'Fix the request body; retrying will not help'],
                          ['401', 'No API key, or the key was revoked', 'Send Authorization: Bearer <key>, or create a new key'],
                          ['403', 'OUTSIDE_24H_WINDOW', 'The 24-hour window has closed — send an approved template instead'],
                          ['409', 'No WhatsApp number connected for this key', 'Connect a number under Platform → Numbers'],
                          ['429', 'Rate limit exceeded', 'Back off for the seconds given in Retry-After'],
                          ['502', 'Meta rejected the request or was unreachable', 'Read message and code; retry transient failures with backoff'],
                          ['503', 'The database is temporarily unavailable', 'Retry with backoff'],
                        ].map(([status, code, desc], i) => (
                          <Box component="tr" key={i} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                            <Box component="td" sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                              <Chip label={status} size="small" color="error" variant="outlined" />
                            </Box>
                            <Box component="td" sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', fontFamily: 'monospace', fontSize: '0.8rem' }}>{code}</Box>
                            <Box component="td" sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', color: 'text.secondary' }}>{desc}</Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                </SubSection>
              </Section>
            </Box>
          </Box>
        </Container>
      </Box>
    </motion.div>
  );
}
