import mongoose, { Schema } from 'mongoose';

const attendanceCommandSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    aliases: { type: [String], default: [] },
    attendanceType: { type: String, required: true, trim: true },
    initial: { type: Boolean, default: false },
    nextAllowed: { type: [String], default: [] },
    successMessage: { type: String, default: '', trim: true },
    duplicateMessage: { type: String, default: '', trim: true },
    invalidMessage: { type: String, default: '', trim: true },
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const attendanceSettingsSchema = new Schema(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    whatsappAccountId: { type: Schema.Types.ObjectId, ref: 'WhatsAppAccount', required: true, index: true },
    enabled: { type: Boolean, default: true },
    timeZone: { type: String, default: 'Asia/Kolkata', trim: true },
    weeklyOffDays: { type: [Number], default: [0] },
    commands: { type: [attendanceCommandSchema], default: [] },
  },
  { timestamps: true }
);

export const AttendanceSettings =
  (mongoose.models.AttendanceSettings as any) || mongoose.model('AttendanceSettings', attendanceSettingsSchema);
export default AttendanceSettings;
