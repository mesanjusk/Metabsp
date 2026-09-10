import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { errorResponse } from '@/lib/http/errorResponse';
import { authenticateAttendanceDevice } from '@/lib/services/attendanceDeviceService';

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const device: any = await authenticateAttendanceDevice(
      req.headers.get('x-device-id'),
      req.headers.get('x-device-key')
    );
    device.lastSeenAt = new Date();
    await device.save();
    return NextResponse.json({ success: true, serverTime: new Date().toISOString() });
  } catch (error) {
    return errorResponse(error, 'Failed to update attendance device heartbeat');
  }
}
