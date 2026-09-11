import crypto from 'crypto';
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

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { account } = await getOwnedAttendanceWorkspace(authed.id);
    const devices = await AttendanceDevice.find({ ownerUserId: account.userId }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data: devices.map(sanitizeAttendanceDevice) });
  } catch (error) {
    return errorResponse(error, 'Failed to load attendance devices');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { account } = await getOwnedAttendanceWorkspace(authed.id);
    const body: any = await req.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const serialNumber = String(body.serialNumber || '').trim();
    if (!name || !serialNumber) throw new AppError('Device name and serial number are required', 400);

    const duplicate = await AttendanceDevice.findOne({ ownerUserId: account.userId, serialNumber }).lean();
    if (duplicate) throw new AppError('A device with this serial number already exists', 409);

    const deviceKey = generateAttendanceDeviceKey();
    const device: any = await AttendanceDevice.create({
      ownerUserId: account.userId,
      tenantId: account.tenantId || authed.tenantId || null,
      whatsappAccountId: account._id,
      deviceUuid: crypto.randomUUID(),
      name,
      serialNumber,
      location: String(body.location || '').trim(),
      provider: String(body.provider || 'Generic').trim() || 'Generic',
      protocol: String(body.protocol || 'API').trim() || 'API',
      enabled: body.enabled !== false,
      secretHash: hashAttendanceDeviceKey(deviceKey),
      settings: body.settings && typeof body.settings === 'object' && !Array.isArray(body.settings) ? body.settings : {},
    });

    return NextResponse.json({
      success: true,
      data: sanitizeAttendanceDevice(device),
      deviceKey,
      message: 'Device registered. Save this key now; it will not be shown again.',
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to register attendance device');
  }
}
