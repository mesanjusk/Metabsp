// k6 load test: POST /webhook (Meta inbound message delivery simulation)
//
// Requires META_APP_SECRET to match the target server's configuration so
// the computed signature verifies. Point this at a local/staging instance
// only — it writes real Message documents for the payload it sends.
//
// Usage:
//   BASE_URL=http://localhost:5000 META_APP_SECRET=your-secret \
//     k6 run loadtest/k6/webhook.js
// (requires k6 installed separately — https://k6.io/docs/get-started/installation/)
import http from 'k6/http';
import crypto from 'k6/crypto';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const APP_SECRET = __ENV.META_APP_SECRET;

if (!APP_SECRET) {
  throw new Error('META_APP_SECRET env var must be set to the target server\'s configured value');
}

export const options = {
  scenarios: {
    steady_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 20 },
        { duration: '30s', target: 20 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

function buildSignedPayload() {
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
                  id: `wamid.k6loadtest.${Date.now()}.${Math.random()}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: { body: 'k6 load test message' },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const body = JSON.stringify(payload);
  const signature = 'sha256=' + crypto.hmac('sha256', APP_SECRET, body, 'hex');
  return { body, signature };
}

export default function () {
  const { body, signature } = buildSignedPayload();

  const res = http.post(`${BASE_URL}/webhook`, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': signature,
    },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(0.1);
}
