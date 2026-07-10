#!/usr/bin/env node
/**
 * Baseline load test: GET /health, no auth required. Establishes a latency/
 * throughput floor for the process itself (routing + Mongo ping) before
 * layering on anything more expensive (webhook signature verification,
 * authenticated routes, DB writes).
 *
 * Usage: BASE_URL=http://localhost:5000 node loadtest/autocannon-health.js
 *        (or: npm run loadtest:health --workspace=backend)
 */
const autocannon = require('autocannon');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const DURATION_SECONDS = Number(process.env.LOADTEST_DURATION || 20);
const CONNECTIONS = Number(process.env.LOADTEST_CONNECTIONS || 20);

async function main() {
  console.log(`Load-testing GET ${BASE_URL}/health — ${CONNECTIONS} connections, ${DURATION_SECONDS}s`);

  const result = await autocannon({
    url: `${BASE_URL}/health`,
    connections: CONNECTIONS,
    duration: DURATION_SECONDS,
  });

  autocannon.printResult(result, { outputStream: process.stdout });

  if (result.non2xx > 0 || result.errors > 0) {
    console.error(`\n${result.non2xx} non-2xx responses, ${result.errors} errors — investigate before trusting these numbers.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Load test failed to run:', error.message);
  process.exit(1);
});
