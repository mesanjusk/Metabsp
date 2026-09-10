import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AttendanceDevice from '@/lib/models/AttendanceDevice';
import AppError from '@/lib/utils/AppError';
import { sanitizeAttendanceDevice } from '@/lib/services/attendanceDeviceService';
import { getOwnedAttendanceWorkspace } from '@/lib/services/attendanceWorkspace';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ deviceUuid: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { account } = await getOwnedAttendanceWorkspace(authed.id);
    const { deviceUuid } = await params;
    const body: any = await req.json().catch(() => ({}));

    const update: any = {};
    for (const key of ['name', 'serialNumber', 'location', 'provider', 'protocol', 'enabled', 'settings']) {
      if (Object.prototype.hasOwnProperty.call(body, key)) update[key] = body[key];
    }
    if (update.settings && (typeof update.settings !== 'object' || Array.isArray(update.settings))) {
      throw new AppError('Device settings must be a JSON object', 400);
    }

    const device: any = await AttendanceDevice.findOneAndUpdate(
      { ownerUserId: account.userId, deviceUuid },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!device) throw new AppError('Attendance device not found', 404);

    return NextResponse.json({ success: true, data: sanitizeAttendanceDevice(device) });
  } catch (error: any) {
    if (error?.code === 11000) return errorResponse(new AppError('Device serial number must be unique', 409));
    return errorResponse(error, 'Failed to update attendance device');
  }
}
