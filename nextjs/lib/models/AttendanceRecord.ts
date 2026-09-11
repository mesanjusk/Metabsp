import mongoose, { Schema } from 'mongoose';

const attendanceEntrySchema = new Schema(
  {
    type: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
    timestamp: { type: Date, required: true },
    source: { type: String, required: true, trim: true },
    sourceCommand: { type: String, default: '', trim: true },
    deviceUuid: { type: String, default: '', trim: true },
    verificationMethod: { type: String, default: '', trim: true },
    externalEventId: { type: String, default: '', trim: true },
  },
  { _id: true }
);

const attendanceRecordSchema = new Schema(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    whatsappAccountId: { type: Schema.Types.ObjectId, ref: 'WhatsAppAccount', default: null, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dateKey: { type: String, required: true, trim: true, index: true },
    status: { type: String, enum: ['Active', 'Completed'], default: 'Active' },
    entries: { type: [attendanceEntrySchema], default: [] },
  },
  { timestamps: true }
);

attendanceRecordSchema.index({ ownerUserId: 1, userId: 1, dateKey: 1 }, { unique: true });
attendanceRecordSchema.index({ ownerUserId: 1, dateKey: 1 });
attendanceRecordSchema.index({ ownerUserId: 1, 'entries.deviceUuid': 1, 'entries.externalEventId': 1 });

export const AttendanceRecord =
  (mongoose.models.AttendanceRecord as any) || mongoose.model('AttendanceRecord', attendanceRecordSchema);
export default AttendanceRecord;
