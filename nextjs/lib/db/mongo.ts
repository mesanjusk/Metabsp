import mongoose from 'mongoose';

// Next.js route handlers/dev-mode hot reload can re-execute this module
// many times per running process, unlike the Express app's single
// call-once-at-boot connectDB() (backend/src/config/mongo.js). Caching the
// connection promise on `global` survives HMR reloads in dev and is reused
// across warm serverless invocations in production — without this, each
// reload/invocation would call mongoose.connect() again and either open a
// duplicate connection or throw on re-registering models.
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
  global.__metabspMongoosePromise = mongoose.connect(mongoURI, {
    autoIndex: false,
  });

  return global.__metabspMongoosePromise;
}
