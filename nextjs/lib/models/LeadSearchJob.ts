import mongoose, { Schema } from 'mongoose';

const leadSearchJobSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    businessType: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    query: { type: String, required: true, trim: true },
    requestedLimit: { type: Number, default: 50, min: 1, max: 100 },
    latitude: { type: String, default: '' },
    longitude: { type: String, default: '' },
    depth: { type: Number, default: 5, min: 1, max: 10 },
    emailEnabled: { type: Boolean, default: true },
    socialEnabled: { type: Boolean, default: false },
    status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued', index: true },
    scraperJobId: { type: String, default: '', trim: true },
    totalFound: { type: Number, default: 0 },
    error: { type: String, default: '' },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

leadSearchJobSchema.index({ userId: 1, createdAt: -1 });
leadSearchJobSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

export const LeadSearchJob =
  (mongoose.models.LeadSearchJob as any) || mongoose.model('LeadSearchJob', leadSearchJobSchema);
export default LeadSearchJob;
