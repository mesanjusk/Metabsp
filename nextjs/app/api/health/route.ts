import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/mongo';

/**
 * Liveness by default, readiness on request.
 *
 * This endpoint is Render's `healthCheckPath`, which makes it the gate a new
 * instance must pass before it can replace the running one. It used to answer
 * 503 whenever MongoDB was unreachable, and that turned a database outage into
 * a permanent deploy freeze: the new instance could not go healthy, the old one
 * stayed, and the only way to ship a fix was through the same gate the outage
 * was holding shut. Three deploys died that way on 2026-09-15 while the
 * incumbent — equally unable to reach the database — kept serving. Refusing to
 * roll forward protected nothing, because the version being protected was
 * broken in exactly the same way.
 *
 * So the default answer is now about *this process*: it booted, it is serving,
 * replace the old one. That still fails every case a rollout gate should catch
 * — a crash on boot, a port that never binds, an out-of-memory kill — because
 * in all of those nothing answers at all. What it no longer does is hold a
 * deployment hostage to a third party.
 *
 * `?strict=1` keeps the old behaviour for uptime monitoring, which is the other
 * job this endpoint was doing (see docs/meta-tech-provider/READINESS_STATUS.md):
 * 503 unless the database is actually usable. That distinction belongs in the
 * caller, not in one answer trying to serve both.
 *
 * Neither path awaits the connection. `connectDB()` rejects only after
 * mongoose's server-selection timeout, so awaiting it here meant the health
 * check itself hung for the whole of that window and Render recorded a timeout
 * rather than a 503 — the failure looked like an unresponsive app instead of an
 * unreachable database. The connect is kicked off and left to run; the answer
 * reports whatever the connection state is right now.
 */

const READY_STATES: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export async function GET(req: NextRequest) {
  const strict = req.nextUrl.searchParams.get('strict') === '1';

  // Fire-and-forget: a cold instance starts connecting, and a failure to do so
  // is reported below rather than thrown out of the health check.
  void connectDB().catch(() => undefined);

  const readyState = mongoose.connection.readyState;
  const dbReady = readyState === 1;

  return NextResponse.json(
    {
      ok: strict ? dbReady : true,
      alive: true,
      db: READY_STATES[readyState] || 'unknown',
      dbReady,
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    { status: strict && !dbReady ? 503 : 200 }
  );
}
