import type mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongo";

/**
 * One database connection for the whole application.
 *
 * The studio arrived with its own cached Mongoose connector, written for Vercel: it read
 * `MONGODB_URI` and memoised a connection per warm serverless instance. Both halves are wrong here.
 * Metabsp runs as a single persistent process and already holds a connection (`lib/db/mongo.ts`),
 * and its URI lives in `MONGO_URI` — so keeping the original would have opened a second pool
 * against the same cluster, on an environment variable nobody sets, and every ported route would
 * have failed on a database that was demonstrably reachable from the rest of the app.
 *
 * A delegating shim rather than a rename at ~90 call sites: `connectToDatabase()` is what the
 * ported services call, and this keeps that name true while making it mean the host's connection.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  return connectDB();
}
