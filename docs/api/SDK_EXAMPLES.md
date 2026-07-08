# SDK / integration examples

Real, runnable examples against this platform's actual routes — cross-
reference `backend/src/docs/openapi.js` (served at `/api-docs`) for the
full schema of every field shown here.

## cURL

**Send a text message via the External API (API key auth):**

```bash
curl -X POST "$BASE_URL/api/v1/baileys/send" \
  -H "X-Api-Key: mbsp_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"to": "919876543210", "message": "Hello from the API!"}'
```

**Send to multiple recipients:**

```bash
curl -X POST "$BASE_URL/api/v1/baileys/send-bulk" \
  -H "X-Api-Key: mbsp_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": [
      {"to": "919876543210", "message": "Hi John!"},
      {"to": "919876543211", "message": "Hi Jane!"}
    ],
    "delay": 12000
  }'
```

**Check connection status:**

```bash
curl "$BASE_URL/api/v1/baileys/status" -H "X-Api-Key: mbsp_your_key_here"
```

**Send a WhatsApp Cloud API template message (JWT auth, first-party):**

```bash
curl -X POST "$BASE_URL/api/whatsapp/send-template" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"to": "919876543210", "templateName": "order_update", "language": "en_US", "components": []}'
```

## Node.js

```js
const axios = require('axios');

const client = axios.create({
  baseURL: process.env.METABSP_BASE_URL,
  headers: { 'X-Api-Key': process.env.METABSP_API_KEY },
});

async function sendMessage(to, message) {
  const { data } = await client.post('/api/v1/baileys/send', { to, message });
  return data; // { success: true, to: '919876543210' }
}

async function sendBulk(recipients, delayMs = 12000) {
  const { data } = await client.post('/api/v1/baileys/send-bulk', { recipients, delay: delayMs });
  return data; // { success: true, total, delay, message: 'Bulk send started' }
  // Note: send-bulk responds immediately and processes in the background —
  // it does not wait for every recipient before returning.
}

module.exports = { sendMessage, sendBulk };
```

**Verifying an inbound webhook you've registered (see `WEBHOOKS.md`):**

```js
const crypto = require('crypto');
const express = require('express');
const app = express();

app.post('/metabsp-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-metabsp-signature-256'];
  const expected = 'sha256=' + crypto.createHmac('sha256', process.env.METABSP_WEBHOOK_SECRET).update(req.body).digest('hex');

  const isValid = (() => {
    try { return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)); }
    catch { return false; }
  })();

  if (!isValid) return res.status(403).send('Invalid signature');

  const event = JSON.parse(req.body);
  console.log('Received event:', event);
  res.status(200).send('ok');
});
```

## React (first-party JWT usage, matching this repo's own pattern)

```jsx
import { useState } from 'react';
import apiClient from '../apiClient'; // frontend/src/apiClient.js — already attaches the JWT

export default function QuickSendForm() {
  const [to, setTo] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('');

  const handleSend = async (event) => {
    event.preventDefault();
    setStatus('Sending…');
    try {
      await apiClient.post('/api/whatsapp/send-text', { to, body });
      setStatus('Sent.');
    } catch (error) {
      setStatus(error?.response?.data?.message || 'Failed to send.');
    }
  };

  return (
    <form onSubmit={handleSend}>
      <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="919876543210" />
      <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message" />
      <button type="submit">Send</button>
      <p>{status}</p>
    </form>
  );
}
```

Note: `send-text` requires an open 24h customer-service window
(`enforceWhatsApp24hWindow` — see `docs/meta-tech-provider/TROUBLESHOOTING.md`);
use `send-template` outside that window.

## Postman

Import [`docs/api/postman_collection.json`](./postman_collection.json) —
covers every endpoint documented here plus the full Cloud API surface
from the OpenAPI spec.
