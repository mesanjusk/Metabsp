import mongoose from 'mongoose';
import logger from '../utils/logger';

// Next.js route handlers/dev-mode hot reload can re-execute this module
// many times per running process, unlike the Express app's single
// call-once-at-boot connectDB() (backend/src/config/mongo.js). Caching the
// connection promise on `global` survives HMR reloads in dev and is reused
// across warm serverless invocations in production — without this, each
// reload/invocation would call mongoose.connect() again and either open a
// duplicate connection or throw on re-registering models.
//
// ONLY a settled-successfully or still-pending promise may stay cached. A
// REJECTED one must be evicted, and that is the whole point of the catch
// below: caching a rejection made the first failed attempt permanent. Every
// later caller got the same dead promise replayed, mongoose.connect() was
// never called a second time, and so its own reconnection logic never got a
// chance to run — the process stayed unable to reach the database until it
// was restarted, however healthy the database became in the meantime.
//
// That failure had teeth because of who calls this first. /api/health fires
// connectDB() fire-and-forget on a cold instance and then answers `ok: true`
// regardless (see app/api/health/route.ts), so a single transient failure at
// boot — an Atlas primary election, a cold-start DNS blip, the instance's
// network not up yet — poisoned the cache before any user request arrived,
// and the instance then passed its health check and served every
// database-backed route as 503 "Service temporarily unavailable. Please
// retry." forever. Sign-in and sign-up were the visible casualties: both
// guard connectDB() and both returned that same 503 on every attempt, and
// retrying — which is exactly what the message asks for — could never work.
declare global {
  // eslint-disable-next-line no-var
  var __metabspMongoosePromise: Promise<typeof mongoose> | undefined;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (global.__metabspMongoosePromise) {
    return global.__metabspMongoosePromise;
  }

  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) {
    throw new Error('MONGO_URI is not set');
  }

  // Same rationale as backend/src/config/mongo.js: don't force-create every
  // collection's indexes eagerly at connect time (autoIndex: true) — with
  // ~30 models sharing this database, that risks a shared/free Atlas
  // tier's collection cap. Index creation is handled by the same manual
  // scripts as the Express host (backend/scripts/*) — the Next.js app does
  // not introduce a second index-management path.
  const attempt = mongoose.connect(mongoURI, {
    autoIndex: false,
    // Fail in ten seconds rather than mongoose's default thirty. Anything that
    // waits on a connection — a route, a worker, the health check — inherits
    // this window, and a thirty-second stall reads to a caller as a hung app
    // rather than an unreachable database. Ten is long enough to ride out an
    // Atlas primary election and short enough to answer within a request.
    serverSelectionTimeoutMS: 10_000,
    // Well under mongoose's default of 100. This database is a shared Atlas
    // tier (see the autoIndex note above), and a zero-downtime deploy runs the
    // outgoing and incoming instances at once — so the cap has to leave room
    // for two pools plus whatever else holds a connection.
    maxPoolSize: 10,
  }).catch((error) => {
    // Evict this attempt so the next caller starts a fresh connect rather
    // than awaiting a promise that can only ever reject again. Guarded on
    // identity because a concurrent caller may already have replaced it:
    // clearing unconditionally would discard a live connection.
    if (global.__metabspMongoosePromise === attempt) {
      global.__metabspMongoosePromise = undefined;
    }
    logger.error('[mongo] Connection attempt failed, will retry on next use:', error?.message || error);
    throw error;
  });

  global.__metabspMongoosePromise = attempt;
  return attempt;
}
