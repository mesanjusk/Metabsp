import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { errorResponse } from '@/lib/http/errorResponse';
import { authenticateAttendanceDevice } from '@/lib/services/attendanceDeviceService';
import { listAttendanceProfiles } from '@/lib/services/attendanceService';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const device: any = await authenticateAttendanceDevice(
      req.headers.get('x-device-id'),
      req.headers.get('x-device-key')
    );
    const context: any = await resolveCurrentWhatsAppAccountForUser(String(device.ownerUserId), { requireAccount: true });
    const account = context?.account;
    const profiles = await listAttendanceProfiles(device.ownerUserId, account);

    device.lastSeenAt = new Date();
    device.whatsappAccountId = account._id;
    await device.save();

    return NextResponse.json({
      success: true,
      data: profiles
        .filter((profile: any) => profile.attendanceEnabled && profile.employeeCode)
        .map((profile: any) => ({
          employeeCode: profile.employeeCode,
          name: profile.name,
        })),
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load attendance device employees');
  }
}
