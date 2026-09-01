/**
 * Next.js calls register() exactly once, when the server process boots, before
 * it serves any request. It is the supported place to start work that must
 * outlive a request — which is why the queue workers and schedulers hang off
 * it rather than off server.js.
 *
 * server.js cannot do this job: it runs before Next has compiled anything, so
 * it can only require plain CommonJS and could not import the TypeScript
 * models and services the workers need. It stays responsible for the one thing
 * it uniquely can do — creating the HTTP server so Socket.IO can attach to it.
 *
 * The `=== 'nodejs'` test has to be written exactly this way, wrapping the
 * import rather than returning early on the negative. Next compiles this file
 * for the edge runtime as well, and it only skips bundling a dynamic import
 * when it sees it guarded by that literal comparison. Written as an early
 * `if (... !== 'nodejs') return`, the edge build follows the import anyway and
 * fails to resolve `crypto`, `fs`, `path` and `child_process`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBackgroundJobs } = await import('./lib/runtime/backgroundJobs');
    startBackgroundJobs();
  }
}
