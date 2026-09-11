import mongoose, { Schema } from 'mongoose';

const attendanceDeviceSchema = new Schema(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    whatsappAccountId: { type: Schema.Types.ObjectId, ref: 'WhatsAppAccount', required: true, index: true },
    deviceUuid: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    serialNumber: { type: String, required: true, trim: true },
    location: { type: String, default: '', trim: true },
    provider: { type: String, default: 'Generic', trim: true },
    protocol: { type: String, default: 'API', trim: true },
    enabled: { type: Boolean, default: true },
    secretHash: { type: String, required: true, select: false },
    lastSeenAt: { type: Date, default: null },
    // Vendor-specific punch codes/protocol options belong here instead of in
    // shared application logic. Example: { punchTypeMap: { "0": "In" } }.
    settings: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

attendanceDeviceSchema.index({ ownerUserId: 1, serialNumber: 1 }, { unique: true });

export const AttendanceDevice =
  (mongoose.models.AttendanceDevice as any) || mongoose.model('AttendanceDevice', attendanceDeviceSchema);
export default AttendanceDevice;
