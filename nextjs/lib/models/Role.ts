import mongoose, { Schema } from 'mongoose';

// SHARED model — ported from backend/bulk/models/Role.js.
const roleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    permissions: { type: [String], default: [] },
    dashboardKey: { type: String, default: 'default' },
    isActive: { type: Boolean, default: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
  },
  { timestamps: true }
);

roleSchema.index({ code: 1, tenantId: 1 }, { unique: true });

export const Role = (mongoose.models.Role as any) || mongoose.model('Role', roleSchema);
export default Role;
