import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AttendanceDevice from '@/lib/models/AttendanceDevice';
import AttendanceSettings from '@/lib/models/AttendanceSettings';
import {
  getAttendanceSettings,
  listAttendanceForDate,
  listAttendanceProfiles,
} from '@/lib/services/attendanceService';
import { sanitizeAttendanceDevice } from '@/lib/services/attendanceDeviceService';
import { getOwnedAttendanceWorkspace } from '@/lib/services/attendanceWorkspace';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { account } = await getOwnedAttendanceWorkspace(authed.id);
    const dateKey = String(req.nextUrl.searchParams.get('date') || '').trim() || undefined;

    const [settings, profiles, attendance, devices] = await Promise.all([
      getAttendanceSettings(account.userId, account._id),
      listAttendanceProfiles(account.userId, account),
      listAttendanceForDate(account.userId, account, dateKey),
      AttendanceDevice.find({ ownerUserId: account.userId }).sort({ createdAt: -1 }).lean(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        settings,
        profiles,
        attendance,
        devices: devices.map(sanitizeAttendanceDevice),
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load attendance');
  }
}

export async function PUT(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { account } = await getOwnedAttendanceWorkspace(authed.id);
    const body: any = await req.json().catch(() => ({}));
    const current: any = await getAttendanceSettings(account.userId, account._id);

    const update: any = {
      whatsappAccountId: account._id,
    };
    if (typeof body.enabled === 'boolean') update.enabled = body.enabled;
    if (typeof body.timeZone === 'string' && body.timeZone.trim()) update.timeZone = body.timeZone.trim();
    if (Array.isArray(body.weeklyOffDays)) {
      update.weeklyOffDays = body.weeklyOffDays
        .map((day: unknown) => Number(day))
        .filter((day: number) => Number.isInteger(day) && day >= 0 && day <= 6);
    }
    if (Array.isArray(body.commands)) {
      update.commands = body.commands.map((command: any, index: number) => ({
        key: String(command?.key || `command-${index + 1}`).trim(),
        label: String(command?.label || command?.attendanceType || `Command ${index + 1}`).trim(),
        aliases: Array.from(new Set((Array.isArray(command?.aliases) ? command.aliases : [])
          .map((value: unknown) => String(value || '').trim().toLowerCase())
          .filter(Boolean))),
        attendanceType: String(command?.attendanceType || '').trim(),
        initial: Boolean(command?.initial),
        nextAllowed: (Array.isArray(command?.nextAllowed) ? command.nextAllowed : [])
          .map((value: unknown) => String(value || '').trim())
          .filter(Boolean),
        successMessage: String(command?.successMessage || '').trim(),
        duplicateMessage: String(command?.duplicateMessage || '').trim(),
        invalidMessage: String(command?.invalidMessage || '').trim(),
        enabled: command?.enabled !== false,
      })).filter((command: any) => command.attendanceType);
    }

    Object.assign(current, update);
    await current.save();

    return NextResponse.json({ success: true, data: current });
  } catch (error) {
    return errorResponse(error, 'Failed to save attendance settings');
  }
}
