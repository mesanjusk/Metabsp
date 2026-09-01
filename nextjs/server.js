/**
 * Custom Next.js server.
 *
 * This file is the reason the whole product can be one deployment.
 *
 * `next start` runs Next's own HTTP server, which you cannot attach anything
 * to. Three things this product needs are impossible on top of it, and
 * impossible on serverless generally:
 *
 *   • Socket.IO — long-lived websocket connections for the live inbox.
 *   • The BullMQ broadcast worker — a process that stays up consuming jobs.
 *   • The token-refresh / invoice / backup schedulers — real timers.
 *
 * Creating the HTTP server here and handing requests to Next's request
 * handler lets all three share one process, one port, and one deploy. That is
 * what running on a persistent Node process buys over serverless functions,
 * and why the deployment target decides the architecture rather than the other
 * way round.
 *
 * Only the first of the three lives in this file. Socket.IO needs the raw HTTP
 * server, which exists only here. The worker and the schedulers need the
 * application's TypeScript models and services, which do not exist yet at this
 * point in the boot — they start from instrumentation.ts instead, which Next
 * runs once inside its own compiled runtime.
 *
 * Start with `node server.js`, not `next start`.
 */

const http = require('http');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT) || 3000;

// Bind every interface. Deliberately NOT `process.env.HOSTNAME` — container
// runtimes set that to the container's own hostname, so reading it here binds
// the listener to that single name instead of all interfaces. On Render the
// boot line read
//   [server] Ready on http://srv-...-hibernate-655846fdb5-nq5qf:10000
// and the platform's proxy could not reach the app, which surfaces to users as
// an HTTP 502 rather than as any error in the logs — the process looks
// perfectly healthy from the inside.
//
// BIND_HOST is the deliberate override, and it is a name no runtime sets for
// us; leaving it unset is correct almost everywhere.
const hostname = process.env.BIND_HOST || '0.0.0.0';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Background work (the two BullMQ workers and the four schedulers) is started
// from instrumentation.ts, not here — see that file for why. RUN_BACKGROUND_JOBS
// is read there, so a deployment can still run dedicated worker instances
// alongside HTTP-only web instances.

async function start() {
  await app.prepare();

  const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      // Next's handler rejecting means the request never got a response; a
      // silent rejection here would hang the client until it times out.
      console.error('[server] Request handler failed:', error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });
  });

  // Attached before listen so no client can connect during the window between
  // the port opening and the websocket handler existing.
  const { initSocket } = require('./lib/socket/server.js');
  initSocket(server);

  server.listen(port, hostname, () => {
    console.log(`[server] Ready on http://${hostname}:${port} (dev=${dev})`);
  });

  const shutdown = (signal) => {
    console.log(`[server] ${signal} received, closing`);
    server.close(() => process.exit(0));
    // Render sends SIGTERM and waits ~30s; exit anyway if connections linger.
    setTimeout(() => process.exit(0), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  console.error('[server] Failed to start:', error);
  process.exit(1);
});
