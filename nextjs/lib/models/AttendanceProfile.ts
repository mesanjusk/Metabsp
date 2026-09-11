import mongoose, { Schema } from 'mongoose';

// Attendance identity extension. The platform User remains the source of truth
// for name/mobile/role/login; this collection stores only workspace-specific
// attendance metadata that cannot be added to the shared User schema.
const attendanceProfileSchema = new Schema(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeCode: { type: String, default: '', trim: true },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

attendanceProfileSchema.index({ ownerUserId: 1, userId: 1 }, { unique: true });
attendanceProfileSchema.index(
  { ownerUserId: 1, employeeCode: 1 },
  { unique: true, partialFilterExpression: { employeeCode: { $gt: '' } } }
);

export const AttendanceProfile =
  (mongoose.models.AttendanceProfile as any) || mongoose.model('AttendanceProfile', attendanceProfileSchema);
export default AttendanceProfile;
