import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AttendanceDevice from '@/lib/models/AttendanceDevice';
import AppError from '@/lib/utils/AppError';
import {
  generateAttendanceDeviceKey,
  hashAttendanceDeviceKey,
  sanitizeAttendanceDevice,
} from '@/lib/services/attendanceDeviceService';
import { getOwnedAttendanceWorkspace } from '@/lib/services/attendanceWorkspace';

export async function POST(req: NextRequest, { params }: { params: Promise<{ deviceUuid: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { account } = await getOwnedAttendanceWorkspace(authed.id);
    const { deviceUuid } = await params;
    const deviceKey = generateAttendanceDeviceKey();

    const device: any = await AttendanceDevice.findOneAndUpdate(
      { ownerUserId: account.userId, deviceUuid },
      { $set: { secretHash: hashAttendanceDeviceKey(deviceKey) } },
      { new: true }
    );
    if (!device) throw new AppError('Attendance device not found', 404);

    return NextResponse.json({
      success: true,
      data: sanitizeAttendanceDevice(device),
      deviceKey,
      message: 'Device key rotated. Save the new key now; it will not be shown again.',
    });
  } catch (error) {
    return errorResponse(error, 'Failed to rotate attendance device key');
  }
}
