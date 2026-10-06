#!/usr/bin/env node
/**
 * Read-only authenticated route load test for seeded staging accounts.
 *
 * AUTH_TOKENS_FILE must contain one active dashboard JWT per line. Load never
 * prints tokens or writes application data. Rotate through real test accounts
 * so this measures tenant-scoped API queries, not just an unauthenticated
 * health route.
 *
 * From nextjs/:
 *   BASE_URL=https://staging.example.com \
 *   ALLOW_REMOTE_LOAD_TEST=true \
 *   AUTH_TOKENS_FILE=/secure/path/staging-jwts.txt \
 *   LOADTEST_CONNECTIONS=100 LOADTEST_DURATION=60 npm run loadtest:api
 *
 * Start with a small cohort. Do not point this at production.
 */
const fs = require('node:fs');
const { runLoad } = require('./runner');

const tokenFile = process.env.AUTH_TOKENS_FILE;
if (!tokenFile) {
  console.error('Set AUTH_TOKENS_FILE to a local file containing one staging JWT per line.');
  process.exit(1);
}

const tokens = fs.readFileSync(tokenFile, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

if (!tokens.length) {
  console.error('AUTH_TOKENS_FILE contains no tokens.');
  process.exit(1);
}

const path = process.env.LOADTEST_PATH || '/api/whatsapp/contacts?page=1&limit=50';
if (!path.startsWith('/') || path.startsWith('//')) {
  console.error('LOADTEST_PATH must be a same-origin path beginning with one slash.');
  process.exit(1);
}

console.log('Using ' + tokens.length + ' seeded staging account token(s); token contents are never printed.');
runLoad({
  name: 'authenticated GET ' + path,
  path,
  requestFor: async (workerIndex) => ({
    method: 'GET',
    headers: { Authorization: 'Bearer ' + tokens[workerIndex % tokens.length] },
  }),
}).catch((error) => {
  console.error('Load test failed to run:', error.message);
  process.exit(1);
});
