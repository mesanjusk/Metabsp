import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { updateAttendanceProfile } from '@/lib/services/attendanceService';
import { getOwnedAttendanceWorkspace } from '@/lib/services/attendanceWorkspace';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { account } = await getOwnedAttendanceWorkspace(authed.id);
    const { userId } = await params;
    const body: any = await req.json().catch(() => ({}));

    const profile = await updateAttendanceProfile({
      ownerUserId: account.userId,
      account,
      targetUserId: userId,
      employeeCode: body.employeeCode,
      enabled: body.enabled,
    });

    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    return errorResponse(error, 'Failed to save attendance employee code');
  }
}
