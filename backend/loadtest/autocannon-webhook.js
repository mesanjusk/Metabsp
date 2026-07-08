#!/usr/bin/env node
/**
 * Load test for POST /webhook — the highest-traffic real endpoint in
 * production (every inbound Meta message/status update hits it), and the
 * one most worth benchmarking since it does HMAC signature verification
 * on every request before touching the database.
 *
 * Requires META_APP_SECRET to match whatever the target server is running
 * with (so the precomputed signature actually verifies) — point this at a
 * local/staging instance, never production, since it will write Message
 * documents for the fake payload it sends.
 *
 * Usage:
 *   BASE_URL=http://localhost:5000 META_APP_SECRET=your-secret \
 *     node loadtest/autocannon-webhook.js
 */
const crypto = require('crypto');
const autocannon = require('autocannon');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const APP_SECRET = process.env.META_APP_SECRET;
const DURATION_SECONDS = Number(process.env.LOADTEST_DURATION || 20);
const CONNECTIONS = Number(process.env.LOADTEST_CONNECTIONS || 20);

if (!APP_SECRET) {
  console.error('META_APP_SECRET must be set to the same value the target server is configured with.');
  process.exit(1);
}

// A minimal, realistically-shaped inbound text-message webhook payload.
const payload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '000000000000000',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '15550000000', phone_number_id: '000000000000001' },
            messages: [
              {
                from: '919000000000',
                id: `wamid.loadtest.${Date.now()}`,
                timestamp: String(Math.floor(Date.now() / 1000)),
                type: 'text',
                text: { body: 'load test message' },
              },
            ],
          },
        },
      ],
    },
  ],
};

const body = JSON.stringify(payload);
const signature = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(body).digest('hex');

async function main() {
  console.log(`Load-testing POST ${BASE_URL}/webhook — ${CONNECTIONS} connections, ${DURATION_SECONDS}s`);

  const result = await autocannon({
    url: `${BASE_URL}/webhook`,
    method: 'POST',
    connections: CONNECTIONS,
    duration: DURATION_SECONDS,
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': signature,
    },
    body,
  });

  autocannon.printResult(result, { outputStream: process.stdout });

  if (result.non2xx > 0 || result.errors > 0) {
    console.error(`\n${result.non2xx} non-2xx responses, ${result.errors} errors — check META_APP_SECRET matches the target server.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Load test failed to run:', error.message);
  process.exit(1);
});
