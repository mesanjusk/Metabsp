// k6 load test: GET /health
//
// Usage: BASE_URL=http://localhost:5000 k6 run loadtest/k6/health.js
// (requires k6 installed separately — https://k6.io/docs/get-started/installation/)
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

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
    http_req_duration: ['p(95)<300'], // 95% of requests under 300ms
    http_req_failed: ['rate<0.01'], // less than 1% failures
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/health`);
  check(res, {
    'status is 200 or 503': (r) => r.status === 200 || r.status === 503,
    'has ok field': (r) => JSON.parse(r.body).ok !== undefined,
  });
  sleep(0.1);
}
