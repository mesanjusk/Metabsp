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
const hostname = process.env.HOSTNAME || '0.0.0.0';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Background work is opt-in per replica. Render can run several instances of
// a service; the schedulers already coordinate through a Redis leader lock,
// but keeping this behind a flag means a deployment can also run a dedicated
// worker instance with RUN_BACKGROUND_JOBS=true and web instances without it.
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
    // NOTE: the schedulers and the BullMQ worker still run on the Express
    // host — they have not been ported yet. This flag and its plumbing exist
    // so they can be attached here without a second deployment, but nothing
    // reads it today. Deliberately not logging "background jobs enabled",
    // which would be untrue.
    if (!runBackgroundJobs) {
      console.log('[server] Background jobs opted out for this instance');
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
