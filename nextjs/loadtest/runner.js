#!/usr/bin/env node
const { performance } = require('node:perf_hooks');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DURATION_SECONDS = Math.min(600, Math.max(1, Number(process.env.LOADTEST_DURATION || 20)));
const CONNECTIONS = Math.min(2000, Math.max(1, Number(process.env.LOADTEST_CONNECTIONS || 20)));
const REQUEST_TIMEOUT_MS = Math.min(120000, Math.max(1000, Number(process.env.LOADTEST_REQUEST_TIMEOUT_MS || 30000)));

function targetUrl(path) {
  const base = new URL(BASE_URL);
  const target = new URL(path, base);
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (!localHosts.has(target.hostname) && process.env.ALLOW_REMOTE_LOAD_TEST !== 'true') {
    throw new Error('Remote target blocked. Set ALLOW_REMOTE_LOAD_TEST=true only for an owned staging environment.');
  }
  return target;
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
}

function printSummary({ name, durationSeconds, connections, startedAt, latencies, statuses, errors }) {
  const elapsedSeconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
  const total = latencies.length;
  console.log('\n' + name);
  console.log('duration=' + elapsedSeconds.toFixed(1) + 's virtualUsers=' + connections + ' requests=' + total);
  console.log('requestsPerSecond=' + (total / elapsedSeconds).toFixed(1));
  console.log(
    'latencyMs p50=' + percentile(latencies, 0.50).toFixed(1) +
    ' p95=' + percentile(latencies, 0.95).toFixed(1) +
    ' p99=' + percentile(latencies, 0.99).toFixed(1)
  );
  console.log('httpStatuses=' + JSON.stringify(statuses) + ' transportErrors=' + errors);
  if (errors > 0 || Object.entries(statuses).some(([status, count]) => !status.startsWith('2') && count > 0)) {
    process.exitCode = 1;
  }
}

async function runLoad({ name, path, requestFor }) {
  const target = targetUrl(path);
  const latencies = [];
  const statuses = {};
  let errors = 0;
  const startedAt = performance.now();
  const deadline = startedAt + DURATION_SECONDS * 1000;

  console.log('Load-testing ' + name + ' at ' + target.origin + target.pathname + ' with ' + CONNECTIONS + ' virtual users for ' + DURATION_SECONDS + 's');

  await Promise.all(Array.from({ length: CONNECTIONS }, async (_, workerIndex) => {
    let sequence = 0;
    while (performance.now() < deadline) {
      sequence += 1;
      const request = await requestFor(workerIndex, sequence);
      const began = performance.now();
      try {
        const response = await fetch(target, {
          ...request,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        await response.arrayBuffer();
        latencies.push(performance.now() - began);
        const status = String(response.status);
        statuses[status] = (statuses[status] || 0) + 1;
      } catch (error) {
        latencies.push(performance.now() - began);
        errors += 1;
      }
    }
  }));

  printSummary({ name, durationSeconds: DURATION_SECONDS, connections: CONNECTIONS, startedAt, latencies, statuses, errors });
}

module.exports = { runLoad };
