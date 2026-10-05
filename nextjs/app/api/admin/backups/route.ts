import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import BackupSnapshot from '@/lib/models/BackupSnapshot';
import {
  hasRecentSuccessfulBackup,
  runEncryptedCloudBackup,
} from '@/lib/services/encryptedBackupService';

async function requireAdmin(req: NextRequest) {
  const authed = await requireAuth(req);
  if (!authed.isAdmin) throw new AppError('Admin access required', 403);
  return authed;
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    await requireAdmin(req);

    const [health, snapshots] = await Promise.all([
      hasRecentSuccessfulBackup(),
      BackupSnapshot.find({})
        .sort({ startedAt: -1 })
        .limit(20)
        .select('status startedAt completedAt publicId bytes sha256 collectionCount documentCount error formatVersion remoteVerified')
        .lean(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        enabled: String(process.env.ENABLE_SCHEDULED_BACKUPS || '').toLowerCase() === 'true',
        recentEnough: health.ok,
        ageHours: health.ageHours,
        latest: health.latest || null,
        snapshots,
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load backup status');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    await requireAdmin(req);
    const result = await runEncryptedCloudBackup();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(error, 'Backup failed');
  }
}
