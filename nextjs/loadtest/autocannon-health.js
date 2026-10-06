#!/usr/bin/env node
/**
 * Process health baseline. Run from nextjs/ with:
 *   npm run loadtest:health
 *
 * This exercises GET /api/health (process status and a Mongo state snapshot).
 * It does not represent authenticated dashboard or database-query capacity.
 */
const { runLoad } = require('./runner');

runLoad({
  name: 'GET /api/health',
  path: '/api/health',
  requestFor: async () => ({ method: 'GET' }),
}).catch((error) => {
  console.error('Load test failed to run:', error.message);
  process.exit(1);
});
