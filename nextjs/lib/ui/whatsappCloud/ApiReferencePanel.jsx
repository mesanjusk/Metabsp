'use client';

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
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
 *
 * The "Start here" tab exists because the endpoint list answered the wrong
 * question first. Someone opening this screen does not yet know whether the
 * API is something their account can use or something an administrator has to
 * switch on, nor which of the two ways to receive messages applies to them.
 * A reference that opens on `POST /api/v1/send-template` leaves both unanswered.
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


const Step = ({ index, title, children, action }) => (
  <Stack direction="row" spacing={2} alignItems="flex-start">
    <Box
      sx={(theme) => ({
        width: 28,
        height: 28,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        bgcolor: alpha(theme.palette.primary.main, 0.12),
        color: 'primary.main',
        fontWeight: 700,
        fontSize: '0.8125rem',
        mt: 0.25,
      })}
    >
      {index}
    </Box>
    <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      {children}
      {action}
    </Stack>
  </Stack>
);

export default function ApiReferencePanel({ onOpenTab }) {
  const [tab, setTab] = useState('start');
  const base = origin();

  return (
    <Card>
      <CardContent sx={{ pt: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs
            value={tab}
            onChange={(_event, next) => setTab(next)}
            aria-label="API direction"
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
          >
            <Tab value="start" label="Start here" />
            <Tab value="send" label="Sending" />
            <Tab value="receive" label="Receiving" />
          </Tabs>
        </Box>

        {tab === 'start' ? (
          <Stack spacing={4}>
            <Alert severity="success">
              <strong>This is yours to use — no administrator has to enable it.</strong> Every
              account gets the same API. A key you create here acts as your own account, on the
              WhatsApp number you connected, and can never see or send from anyone else&apos;s.
            </Alert>

            <Step
              index={1}
              title="Create an API key"
              action={
                <Box>
                  <Button
                    size="small"
                    variant="outlined"
                    endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                    onClick={() => onOpenTab?.('keys')}
                  >
                    Go to API keys
                  </Button>
                </Box>
              }
            >
              <Typography variant="body2" color="text.secondary">
                The key is shown once, at the moment you create it. Store it where your code reads
                its secrets — never in a repository or a front-end bundle, because anyone holding it
                can send messages as you. Lost one? Revoke it and make another; a revoked key stops
                working immediately.
              </Typography>
            </Step>

            <Divider />

            <Step index={2} title="Send your first message">
              <Typography variant="body2" color="text.secondary">
                Check the key works, and see which number it sends from:
              </Typography>
              <CodeBlock>{`curl ${base}/api/v1/status \\
  -H "Authorization: Bearer mbsp_your_key_here"`}</CodeBlock>
              <Typography variant="body2" color="text.secondary">
                Then send. Which endpoint you need depends on one rule, not on preference: you may
                send free-form text only within 24 hours of that person&apos;s last message to you.
                Outside that window it must be an approved template. If you are starting the
                conversation, it is always a template.
              </Typography>
              <Box>
                <Button
                  size="small"
                  variant="outlined"
                  endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                  onClick={() => setTab('send')}
                >
                  See the sending endpoints
                </Button>
              </Box>
            </Step>

            <Divider />

            <Step index={3} title="Choose how you receive replies">
              <Typography variant="body2" color="text.secondary">
                Both options deliver the same messages. Pick the one that matches where your code
                runs — you do not need both.
              </Typography>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ '& > *': { flex: 1, minWidth: 0 } }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      Your server has a public URL
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Register it as a webhook destination and we POST each message to it the moment
                      it arrives. Nothing to poll, nothing to schedule.
                    </Typography>
                    <Button
                      size="small"
                      sx={{ mt: 1.5 }}
                      variant="outlined"
                      endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                      onClick={() => onOpenTab?.('webhooks')}
                    >
                      Add a destination
                    </Button>
                  </CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      It does not
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      A desktop tool, a script behind NAT, a scheduled job on someone else&apos;s
                      host: ask us for new messages on your own schedule instead.
                    </Typography>
                    <Button
                      size="small"
                      sx={{ mt: 1.5 }}
                      variant="outlined"
                      endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                      onClick={() => setTab('receive')}
                    >
                      See how to poll
                    </Button>
                  </CardContent>
                </Card>
              </Stack>
            </Step>
          </Stack>
        ) : tab === 'send' ? (
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
