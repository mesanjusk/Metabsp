#!/usr/bin/env node
/**
 * Signed synthetic inbound webhook load test. Run only against local/staging:
 * it submits fake messages which may be persisted by the application.
 *
 * From nextjs/:
 *   BASE_URL=http://localhost:3000 META_APP_SECRET=... npm run loadtest:webhook
 */
const crypto = require('node:crypto');
const { runLoad } = require('./runner');

const APP_SECRET = process.env.META_APP_SECRET;
if (!APP_SECRET) {
  console.error('META_APP_SECRET must match the target server configuration.');
  process.exit(1);
}

runLoad({
  name: 'POST /webhook',
  path: '/webhook',
  requestFor: async (workerIndex, sequence) => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: '000000000000000',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '15550000000', phone_number_id: '000000000000001' },
            messages: [{
              from: '919000000000',
              id: 'wamid.loadtest.' + workerIndex + '.' + sequence + '.' + now,
              timestamp: String(now),
              type: 'text',
              text: { body: 'MetaBSP staging load test message' },
            }],
          },
        }],
      }],
    };
    const body = JSON.stringify(payload);
    const signature = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(body).digest('hex');
    return {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature },
      body,
    };
  },
}).catch((error) => {
  console.error('Load test failed to run:', error.message);
  process.exit(1);
});
