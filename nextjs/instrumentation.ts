/**
 * Next.js instrumentation hook — runs once per server process, at startup,
 * inside the compiled runtime.
 *
 * This is where the BullMQ send worker and the token-refresh scheduler are
 * started. They used to run on the Express service (`backend/`), and this app
 * only ever produced onto the queue; nothing here consumed it. Retiring that
 * service without moving them would have produced a deployment that looks
 * completely healthy and is not:
 *
 *   • Every broadcast recipient and every delayed auto-reply / workflow step
 *     goes through `whatsapp-broadcast-send`. Enqueueing keeps succeeding
 *     with no consumer, so jobs accumulate in Redis and no message is ever
 *     sent — no error, no failed request, nothing in the logs.
 *   • Meta long-lived tokens last ~60 days and have no refresh_token. Without
 *     the refresher, every connected number keeps working until it abruptly
 *     does not, roughly two months after the last connect.
 *
 * Why here rather than in server.js: server.js is required by Node before Next
 * compiles anything, so it can only load plain CommonJS — the same constraint
 * that makes lib/socket/server.js CommonJS. The worker needs the TypeScript
 * side (dispatchers, account service, models), so it has to start from within
 * the compiled runtime. `register()` is that entry point.
 *
 * Multiple replicas are safe: the scheduler takes a per-tick Redis leader lock
 * (lib/services/schedulerLock.ts), and BullMQ hands each job to exactly one
 * worker. Set RUN_BACKGROUND_JOBS=false on instances that should serve
 * requests only.
 */

export async function register() {
  // The hook also runs for the edge runtime, which has neither TCP sockets nor
  // the Node built-ins bullmq and mongoose need.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const runBackgroundJobs = String(process.env.RUN_BACKGROUND_JOBS ?? 'true').toLowerCase() !== 'false';
  if (!runBackgroundJobs) {
    console.log('[instrumentation] Background jobs opted out (RUN_BACKGROUND_JOBS=false)');
    return;
  }

  try {
    // Imported dynamically so a build-time analysis of this module never pulls
    // Redis or Mongo clients into a context that cannot use them.
    const { connectDB } = await import('./lib/db/mongo');
    await connectDB();

    const { startWhatsAppSendWorker } = await import('./lib/queues/whatsappSendWorker');
    const { startTokenRefreshScheduler } = await import('./lib/services/tokenRefreshService');

    const worker = startWhatsAppSendWorker();
    startTokenRefreshScheduler();

    console.log('[instrumentation] Background jobs started: whatsapp-send worker, token-refresh scheduler');

    // Close the worker on shutdown so an in-flight send completes rather than
    // leaving its job active until the stalled-job timeout reclaims it.
    const closeWorker = async (signal: string) => {
      console.log(`[instrumentation] ${signal} received — closing send worker`);
      await worker.close().catch((error: any) =>
        console.error('[instrumentation] Worker close failed:', error.message)
      );
    };
    process.once('SIGTERM', () => void closeWorker('SIGTERM'));
    process.once('SIGINT', () => void closeWorker('SIGINT'));
  } catch (error) {
    // Loud on purpose. Continuing quietly would serve a healthy-looking site
    // whose broadcasts never send and whose tokens expire two months later.
    console.error(
      '[instrumentation] FAILED to start background jobs — sends and token refresh are NOT running:',
      error
    );
  }
}
