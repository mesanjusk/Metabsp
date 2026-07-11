process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-do-not-use-in-production';
process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY =
  process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY || require('crypto').randomBytes(32).toString('base64');

// Mirrors src/index.js's process-wide 'unhandledRejection' handler, which
// only exists in the real running server (tests build isolated Express apps
// via supertest and never load src/index.js). Without an equivalent here,
// libraries that fire off a promise nobody ends up awaiting — e.g.
// rate-limit-redis eagerly loading a script for its .get() method, which
// this app never calls — crash the whole Jest worker with an uncaught
// exception instead of the harmless no-op it is in production.
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.warn('[jest] Unhandled rejection (non-fatal, mirrors production):', reason);
});
