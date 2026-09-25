import mongoose, { Schema } from 'mongoose';

const leadFinderAgentSchema = new Schema(
  {
    agentId: { type: String, required: true, unique: true, default: 'default' },
    hostname: { type: String, default: '', trim: true },
    version: { type: String, default: '', trim: true },
    lastSeenAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

export const LeadFinderAgent =
  (mongoose.models.LeadFinderAgent as any) || mongoose.model('LeadFinderAgent', leadFinderAgentSchema);
export default LeadFinderAgent;
