// A cold Redis at boot used to produce six `[unhandledRejection]` lines with
// full stack traces before the server had served a single request. Nothing was
// actually broken — RedisStore fires two SCRIPT LOAD calls in its constructor
// and parks the promises on fields it doesn't await until the first request —
// but six stack traces in the boot log is how a real failure gets missed.
//
// This pins the fix: with Redis unreachable, building the limiters must not
// produce an unhandled rejection.

jest.mock('../src/config/redis', () => ({
  // maxRetriesPerRequest: null is what production uses (BullMQ needs it), and
  // it means a command issued while Redis is down never settles at all — so
  // the middleware's own 2.5s timeout is what eventually rejects. A promise
  // that never resolves reproduces that exactly.
  getRedisConnection: () => ({ call: () => new Promise(() => {}) }),
  closeRedisConnection: async () => {},
}));

describe('middleware/rateLimit boot with Redis unreachable', () => {
  const unhandled = [];
  const record = (reason) => unhandled.push(reason);

  beforeAll(() => {
    process.on('unhandledRejection', record);
  });

  afterAll(() => {
    process.off('unhandledRejection', record);
  });

  it('builds every limiter without leaking an unhandled rejection', async () => {
    const {
      createRateLimiter,
      createAuthRateLimiter,
    } = require('../src/middleware/rateLimit');

    createRateLimiter({ windowMs: 60_000, maxRequests: 10 });
    createAuthRateLimiter({ windowMs: 60_000, maxRequests: 5 });

    // The store's timeout is 2500ms; wait past it plus a margin, then let the
    // microtask queue drain so Node has actually had the chance to report any
    // rejection as unhandled.
    await new Promise((resolve) => setTimeout(resolve, 3200));
    await new Promise((resolve) => setImmediate(resolve));

    const timeouts = unhandled.filter((reason) =>
      String(reason?.message || reason).includes('Redis command timed out')
    );
    expect(timeouts).toEqual([]);
  }, 15_000);
});
