import mongoose, { Schema } from 'mongoose';

/**
 * Service-level access without mutating the shared User schema.
 *
 * tenantId grants/denies a service for the whole business. userId is an
 * optional per-user override inside that tenant. A user override wins over a
 * tenant rule. This lets every customer SEE the full product catalog while
 * only opening services that are included for that business/user.
 */
const serviceEntitlementSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    service: { type: String, required: true, trim: true, lowercase: true, index: true },
    enabled: { type: Boolean, default: true, index: true },
    source: {
      type: String,
      enum: ['manual', 'plan', 'trial', 'system'],
      default: 'manual',
    },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    note: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

serviceEntitlementSchema.index({ tenantId: 1, userId: 1, service: 1 }, { unique: true });

export const ServiceEntitlement =
  (mongoose.models.ServiceEntitlement as any) ||
  mongoose.model('ServiceEntitlement', serviceEntitlementSchema);

export default ServiceEntitlement;
