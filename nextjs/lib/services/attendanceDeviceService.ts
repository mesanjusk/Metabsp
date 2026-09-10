import crypto from 'crypto';
import AttendanceDevice from '../models/AttendanceDevice';
import AppError from '../utils/AppError';

export const generateAttendanceDeviceKey = () => crypto.randomBytes(32).toString('hex');
export const hashAttendanceDeviceKey = (value: unknown) =>
  crypto.createHash('sha256').update(String(value || '')).digest('hex');

export const sanitizeAttendanceDevice = (device: any) => {
  const value = device?.toObject ? device.toObject() : { ...(device || {}) };
  delete value.secretHash;
  return value;
};

export async function authenticateAttendanceDevice(deviceId: unknown, deviceKey: unknown) {
  const id = String(deviceId || '').trim();
  const key = String(deviceKey || '').trim();
  if (!id || !key) throw new AppError('Device credentials are required', 401);

  const device: any = await AttendanceDevice.findOne({
    $or: [{ deviceUuid: id }, { serialNumber: id }],
  }).select('+secretHash');

  if (!device || device.enabled === false) throw new AppError('Attendance device is not authorized', 403);

  const supplied = Buffer.from(hashAttendanceDeviceKey(key), 'hex');
  const expected = Buffer.from(String(device.secretHash || ''), 'hex');
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    throw new AppError('Attendance device is not authorized', 403);
  }
  return device;
}
