import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import DurableQueueJob from '@/lib/models/DurableQueueJob';
import { hasRecentSuccessfulBackup } from '@/lib/services/encryptedBackupService';
import { runPreflightChecks } from '@/lib/services/preflightCheckService';

const evidenceDate = (name: string, maxAgeDays: number) => {
  const raw = String(process.env[name] || '').trim();
  const parsed = raw ? new Date(raw) : null;
  const valid = Boolean(parsed && !Number.isNaN(parsed.getTime()));
  const ageDays = valid ? (Date.now() - parsed!.getTime()) / 86400000 : null;
  return {
    configured: Boolean(raw),
    valid,
    at: valid ? parsed!.toISOString() : null,
    current: valid && Number(ageDays) <= maxAgeDays,
    maxAgeDays,
    ageDays: ageDays === null ? null : Number(ageDays.toFixed(1)),
  };
};

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    if (!authed.isAdmin) throw new AppError('Admin access required', 403);

    const [preflight, backup, recoverable] = await Promise.all([
      runPreflightChecks({ includeWabaSubscriptions: true }),
      hasRecentSuccessfulBackup(),
      DurableQueueJob.countDocuments({
        state: { $in: ['pending', 'failed', 'queued', 'processing'] },
        updatedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) },
      }),
    ]);

    const external = {
      realMetaE2E: evidenceDate('LAUNCH_META_E2E_VERIFIED_AT', 30),
      restoreDrill: evidenceDate('LAUNCH_RESTORE_DRILL_VERIFIED_AT', 90),
      reviewerCredentialsEnforced:
        String(process.env.META_REVIEW_ENFORCE_READY || '').toLowerCase() === 'true',
    };

    const blockers: string[] = [];
    if (preflight.severity === 'error') blockers.push('Meta/WhatsApp preflight has blocking errors');
    if (!backup.ok) blockers.push('No recent remotely verified encrypted backup');
    if (recoverable > 0) blockers.push(`${recoverable} durable queue job(s) are stale/recoverable`);
    if (!external.realMetaE2E.current) blockers.push('Real Meta inbound/outbound/onboarding E2E evidence is missing or stale');
    if (!external.restoreDrill.current) blockers.push('Scratch-database restore drill evidence is missing or stale');

    return NextResponse.json({
      success: true,
      data: {
        ready: blockers.length === 0,
        blockers,
        checkedAt: new Date().toISOString(),
        preflight,
        backup: {
          ready: backup.ok,
          ageHours: backup.ageHours,
          latest: backup.latest || null,
        },
        durableQueue: { recoverable },
        external,
      },
    });
  } catch (error) {
    return errorResponse(error, 'Launch readiness check failed');
  }
}
