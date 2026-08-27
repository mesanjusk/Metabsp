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
 * what running on Render (a persistent Node process) buys over Vercel
 * (functions), and why the deployment target decides the architecture rather
 * than the other way round.
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

// Background work is opt-in per replica. Render can run several instances of
// a service; the schedulers coordinate through a Redis leader lock, but keeping
// this behind a flag means a deployment can also run a dedicated worker
// instance with RUN_BACKGROUND_JOBS=true and web instances without it.
//
// The jobs themselves are started from instrumentation.ts, not here. They
// depend on the TypeScript side (the queue's dispatchers, the account service,
// the models), and this file is required by Node before Next compiles
// anything — the same constraint that makes lib/socket/server.js plain
// CommonJS. Next's instrumentation hook runs once per server process, inside
// the compiled runtime, which is exactly where a long-lived worker belongs.
const runBackgroundJobs = String(process.env.RUN_BACKGROUND_JOBS ?? 'true').toLowerCase() !== 'false';

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
    if (!runBackgroundJobs) {
      console.log('[server] Background jobs opted out for this instance (RUN_BACKGROUND_JOBS=false)');
    }
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
