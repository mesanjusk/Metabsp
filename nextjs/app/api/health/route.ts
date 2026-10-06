import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/mongo';
import { getRedisConnection } from '@/lib/db/redis';
import { hasRecentSuccessfulBackup } from '@/lib/services/encryptedBackupService';
import { countRecoverableDurableJobs } from '@/lib/services/durableQueueJournal';

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

const withTimeout = async <T,>(work: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([
    work,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);

const checkRedisReachable = async (): Promise<{ reachable: boolean; reason?: string }> => {
  try {
    const pong = await getRedisConnection().ping();
    return String(pong || '').toUpperCase() === 'PONG'
      ? { reachable: true }
      : { reachable: false, reason: `PING answered ${JSON.stringify(pong)}` };
  } catch (error: any) {
    return { reachable: false, reason: error?.message || 'Redis PING failed' };
  }
};

const requiredConfig = () => ({
  mongo: Boolean(String(process.env.MONGO_URI || '').trim()),
  redis: Boolean(String(process.env.REDIS_URL || process.env.REDIS_CLUSTER_NODES || '').trim()),
  jwt: Boolean(String(process.env.JWT_SECRET || '').trim()),
  tokenEncryption: Boolean(String(process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY || '').trim()),
  backupEncryption: String(process.env.ENABLE_SCHEDULED_BACKUPS || '').toLowerCase() === 'true'
    ? Boolean(String(process.env.BACKUP_ENCRYPTION_KEY || '').trim())
    : true,
});

export async function GET(req: NextRequest) {
  const strict = req.nextUrl.searchParams.get('strict') === '1';

  // Fire-and-forget: a cold instance starts connecting, and a failure to do so
  // is reported below rather than thrown out of the health check.
  void connectDB().catch(() => undefined);

  const readyState = mongoose.connection.readyState;
  const dbReady = readyState === 1;
  const config = requiredConfig();
  const configReady = Object.values(config).every(Boolean);

  let redisReady: boolean | null = null;
  let redisReason = '';
  let backupReady: boolean | null = null;
  let backupAgeHours: number | null = null;
  let durableQueueRecoverable = 0;

  if (strict) {
    const redis = await withTimeout(
      checkRedisReachable(),
      2500,
      { reachable: false, reason: 'Redis health check timed out' },
    );
    redisReady = redis.reachable;
    redisReason = redis.reason || '';

    if (dbReady) {
      const backupEnabled = String(process.env.ENABLE_SCHEDULED_BACKUPS || '').toLowerCase() === 'true';
      if (backupEnabled) {
        const backup = await withTimeout(
          hasRecentSuccessfulBackup(),
          2500,
          { ok: false, latest: null, ageHours: null },
        );
        backupReady = Boolean(backup.ok);
        backupAgeHours = backup.ageHours === null ? null : Number(backup.ageHours);
      }

      durableQueueRecoverable = await withTimeout(
        countRecoverableDurableJobs(),
        2500,
        -1,
      );
    }
  }

  const backupGate = backupReady === null ? true : backupReady;
  const ready = dbReady && configReady && (redisReady ?? true) && backupGate;

  return NextResponse.json(
    {
      ok: strict ? ready : true,
      alive: true,
      db: READY_STATES[readyState] || 'unknown',
      dbReady,
      redisReady,
      redisReason: strict && !redisReady ? redisReason : undefined,
      backupReady,
      backupAgeHours,
      durableQueueRecoverable: strict ? durableQueueRecoverable : undefined,
      configReady,
      config: {
        mongo: config.mongo,
        redis: config.redis,
        jwt: config.jwt,
        tokenEncryption: config.tokenEncryption,
        backupEncryption: config.backupEncryption,
      },
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    { status: strict && !ready ? 503 : 200 }
  );
}
