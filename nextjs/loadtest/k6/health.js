// k6 load test: GET /api/health
//
// Run from nextjs/:
//   BASE_URL=http://localhost:3000 k6 run loadtest/k6/health.js
// k6 is a standalone binary: https://k6.io/docs/get-started/installation/
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

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
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(BASE_URL.replace(/\/$/, '') + '/api/health');
  let body;
  try {
    body = JSON.parse(res.body);
  } catch (_) {
    body = {};
  }
  check(res, {
    'status is 200': (r) => r.status === 200,
    'health response includes process state': () => body.alive === true && typeof body.dbReady === 'boolean',
  });
  sleep(0.1);
}
