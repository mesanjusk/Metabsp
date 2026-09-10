import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import {
  findWorkspaceUserByEmployeeCode,
  getAttendanceSettings,
  recordAttendanceEntry,
} from '@/lib/services/attendanceService';
import { authenticateAttendanceDevice } from '@/lib/services/attendanceDeviceService';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';

const resolveType = (device: any, settings: any, body: any) => {
  const configuredTypes = new Set(
    (settings?.commands || [])
      .filter((command: any) => command?.enabled !== false)
      .map((command: any) => String(command.attendanceType || '').trim())
      .filter(Boolean)
  );

  const direct = String(body?.type || '').trim();
  if (direct && configuredTypes.has(direct)) return direct;

  const code = body?.punchCode;
  const map = device?.settings?.punchTypeMap;
  if (code !== undefined && code !== null && map && typeof map === 'object') {
    const mapped = String(map[String(code)] || '').trim();
    if (configuredTypes.has(mapped)) return mapped;
  }

  const fallback = String(device?.settings?.defaultAttendanceType || '').trim();
  return configuredTypes.has(fallback) ? fallback : '';
};

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const device: any = await authenticateAttendanceDevice(
      req.headers.get('x-device-id'),
      req.headers.get('x-device-key')
    );
    const body: any = await req.json().catch(() => ({}));
    const employeeCode = String(body.employeeCode || body.employeeId || '').trim();
    if (!employeeCode) throw new AppError('employeeCode is required', 400);

    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(String(device.ownerUserId), { requireAccount: true });
    const account = accountContext?.account;
    if (!account?._id) throw new AppError('Workspace WhatsApp account is unavailable', 409);

    const settings: any = await getAttendanceSettings(device.ownerUserId, account._id);
    const attendanceType = resolveType(device, settings, body);
    if (!attendanceType) {
      throw new AppError('Punch type is not configured for this device', 400);
    }

    const user: any = await findWorkspaceUserByEmployeeCode(device.ownerUserId, employeeCode);
    if (!user) throw new AppError('No active workspace user is mapped to this employee code', 404);

    const timestamp = body.timestamp ? new Date(body.timestamp) : new Date();
    if (Number.isNaN(timestamp.getTime())) throw new AppError('Invalid attendance timestamp', 400);

    const result = await recordAttendanceEntry({
      ownerUserId: device.ownerUserId,
      tenantId: device.tenantId || account.tenantId || null,
      whatsappAccountId: account._id,
      userId: user._id,
      attendanceType,
      source: 'device',
      timestamp,
      sourceCommand: body.punchCode !== undefined ? `punch:${String(body.punchCode)}` : '',
      deviceUuid: String(device.deviceUuid),
      verificationMethod: String(body.verificationMethod || '').trim(),
      externalEventId: String(body.eventId || body.externalEventId || '').trim(),
    });

    device.lastSeenAt = new Date();
    device.whatsappAccountId = account._id;
    await device.save();

    return NextResponse.json({
      success: true,
      duplicate: Boolean(result.duplicateEvent),
      employee: { employeeCode, userId: String(user._id), name: user.name || user.username || employeeCode },
      attendanceType,
      dateKey: result.dateKey,
      timestamp: timestamp.toISOString(),
    }, { status: result.duplicateEvent ? 200 : 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to record attendance punch');
  }
}
