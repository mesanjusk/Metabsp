'use client';

import { useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import { toast } from '@/lib/ui/components/Toast';

/**
 * The API reference, in the product rather than only in a document.
 *
 * The Developers screen previously showed one send example and nothing about
 * receiving, which left the half integrators most often ask about — "how do I
 * get messages into my own system?" — undocumented anywhere they would look.
 *
 * Both directions are here, and the receive side covers both shapes: a push to
 * an endpoint you own, and a poll for the many callers that cannot host one.
 */
const origin = () => (typeof window === 'undefined' ? 'https://your-domain.example' : window.location.origin);

const CodeBlock = ({ children }) => {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      toast.success('Copied.');
    } catch {
      toast.error('Could not copy — select the text and copy it manually.');
    }
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 2,
          pr: 6,
          borderRadius: 2,
          bgcolor: 'action.hover',
          overflowX: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.8125rem',
          lineHeight: 1.7,
        }}
      >
        <code>{children}</code>
      </Box>
      <Tooltip title="Copy">
        <IconButton size="small" onClick={copy} sx={{ position: 'absolute', top: 8, right: 8 }}>
          <ContentCopyRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

const Endpoint = ({ method, path, summary, children }) => (
  <Stack spacing={1.5}>
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
      <Chip
        size="small"
        label={method}
        color={method === 'GET' ? 'info' : 'primary'}
        sx={{ fontFamily: 'monospace', fontWeight: 700 }}
      />
      <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
        {path}
      </Typography>
    </Stack>
    <Typography variant="body2" color="text.secondary">
      {summary}
    </Typography>
    {children}
  </Stack>
);

export default function ApiReferencePanel() {
  const [tab, setTab] = useState('send');
  const base = origin();

  return (
    <Card>
      <CardHeader
        title="API reference"
        subheader="Send messages from your own systems, and receive every inbound message into them."
        titleTypographyProps={{ variant: 'h6' }}
        subheaderTypographyProps={{ variant: 'body2' }}
      />
      <CardContent sx={{ pt: 0 }}>
        <Alert severity="info" sx={{ mb: 2.5 }}>
          Every request authenticates with an API key from the tab beside this one, sent as{' '}
          <code>Authorization: Bearer &lt;key&gt;</code>. A key can only ever act on the WhatsApp
          number its owner connected — an account or phone number in a request body is never trusted
          to widen that.
        </Alert>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tab} onChange={(_event, next) => setTab(next)} aria-label="API direction">
            <Tab value="send" label="Sending" />
            <Tab value="receive" label="Receiving" />
          </Tabs>
        </Box>

        {tab === 'send' ? (
          <Stack spacing={4}>
            <Endpoint
              method="POST"
              path="/api/v1/send-template"
              summary="An approved template. The only way to start a conversation with someone who has not messaged you in the last 24 hours — reach for this by default."
            >
              <CodeBlock>{`curl ${base}/api/v1/send-template \\
  -H "Authorization: Bearer mbsp_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "919876543210",
    "template": "order_shipped",
    "language": "en_US",
    "components": []
  }'`}</CodeBlock>
            </Endpoint>

            <Divider />

            <Endpoint
              method="POST"
              path="/api/v1/send-text"
              summary="Free-form text. Only reaches someone inside Meta's 24-hour customer service window; outside it you get a 403 with code OUTSIDE_24H_WINDOW telling you to send a template instead."
            >
              <CodeBlock>{`curl ${base}/api/v1/send-text \\
  -H "Authorization: Bearer mbsp_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{ "phone": "919876543210", "text": "Your order is on its way." }'`}</CodeBlock>
            </Endpoint>

            <Divider />

            <Endpoint
              method="POST"
              path="/api/v1/send-media"
              summary="An image, video, audio file, document or sticker by public HTTPS URL. Same 24-hour rule as text."
            >
              <CodeBlock>{`curl ${base}/api/v1/send-media \\
  -H "Authorization: Bearer mbsp_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "919876543210",
    "type": "image",
    "link": "https://example.com/invoice.png",
    "caption": "Your invoice"
  }'`}</CodeBlock>
            </Endpoint>

            <Divider />

            <Endpoint
              method="GET"
              path="/api/v1/templates"
              summary="The approved templates this key may send, so you do not have to copy names out of the dashboard by hand."
            >
              <CodeBlock>{`curl ${base}/api/v1/templates \\
  -H "Authorization: Bearer mbsp_your_key_here"`}</CodeBlock>
            </Endpoint>

            <Divider />

            <Endpoint
              method="GET"
              path="/api/v1/status"
              summary="Which number this key sends from, and its health. The first call to make when wiring up an integration."
            >
              <CodeBlock>{`curl ${base}/api/v1/status \\
  -H "Authorization: Bearer mbsp_your_key_here"`}</CodeBlock>
            </Endpoint>
          </Stack>
        ) : (
          <Stack spacing={4}>
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Option 1 — we push to you
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Add your endpoint under <strong>Webhook destinations</strong>. Every inbound message
                on your number is POSTed to it as JSON, as it arrives. You can register several — one
                per project — each with its own signing secret.
              </Typography>

              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                What you receive
              </Typography>
              <CodeBlock>{`POST https://your-app.example/webhooks/whatsapp
Content-Type: application/json
X-Metabsp-Signature-256: sha256=<hmac of the raw body, using your secret>

{
  "from": "919876543210",
  "to": "15550001111",
  "phoneNumberId": "123456789012345",
  "type": "text",
  "message": "Where is my order?",
  "messageId": "wamid.HBgM...",
  "timestamp": "2026-09-01T10:00:00.000Z"
}`}</CodeBlock>

              <Typography variant="subtitle2" sx={{ mt: 2.5, mb: 1 }}>
                Verify the signature before trusting it
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Your URL is reachable by anyone who guesses it. The header proves the request came
                from us. Compute the HMAC over the <em>raw</em> request body — parse the JSON only
                after it matches, and compare in constant time.
              </Typography>
              <CodeBlock>{`const crypto = require('crypto');

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
  // ... handle the message, then answer quickly.
  res.sendStatus(200);
});`}</CodeBlock>
              <Alert severity="warning" sx={{ mt: 2 }}>
                Answer within a few seconds and do your work afterwards. A slow endpoint is retried
                and eventually marked failing — you can see the last attempt and error against each
                destination.
              </Alert>
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Option 2 — you poll us
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                For anything that cannot host a public endpoint: a desktop tool, a script behind NAT,
                a scheduled job. Poll with the <code>nextSince</code> value from the previous
                response and you cannot miss a message or receive one twice.
              </Typography>

              <Endpoint
                method="GET"
                path="/api/v1/messages"
                summary="Messages on your number, oldest first. Optional: since (ISO timestamp), direction (incoming | outgoing), phone, limit (max 200)."
              >
                <CodeBlock>{`curl "${base}/api/v1/messages?since=2026-09-01T10:00:00Z&direction=incoming" \\
  -H "Authorization: Bearer mbsp_your_key_here"

# {
#   "success": true,
#   "data": [ { "id": "...", "from": "919876543210", "type": "text",
#               "text": "Where is my order?", "timestamp": "..." } ],
#   "nextSince": "2026-09-01T10:05:00.000Z",
#   "hasMore": false
# }`}</CodeBlock>
              </Endpoint>
            </Box>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
