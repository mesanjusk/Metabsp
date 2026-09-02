import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { verifyPassword } from '../utils/password';

// SHARED model — ported from backend/bulk/models/User.js. Same collection
// (`users`) as the always-on host; every field/index/hook below must stay
// byte-for-byte identical to that file or the two apps' writes will drift.
// See docs/NEXTJS_MIGRATION_AUDIT_AND_PLAN.md §1.4 on why this can't be
// duplicated with divergent schemas.
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, trim: true },
    // Required only for accounts that sign in with one. An account created
    // through Google or Facebook has no password and never will, and an
    // unconditional `required: true` here made every social sign-in throw
    // ValidationError at User.create — the whole flow was dead.
    password: {
      type: String,
      required() {
        return !this.googleId && !this.facebookId;
      },
    },
    mobile: { type: String, default: '', trim: true },
    email: { type: String, default: '' },
    // Provider identities. socialAuthService looks accounts up by these and
    // writes them on link, but they were absent from this schema, so Mongoose
    // strict mode dropped them on every save: the lookup could never match,
    // and nothing recorded which Meta user an account belonged to. That second
    // consequence is why Meta's data-deletion callback — which identifies a
    // person only by their Facebook user id — needs them.
    googleId: { type: String, default: undefined, unique: true, sparse: true, index: true },
    facebookId: { type: String, default: undefined, unique: true, sparse: true, index: true },
    // Guards the email-linking path in socialAuthService: an unverified
    // address must not be allowed to claim an existing account.
    emailVerified: { type: Boolean, default: false },
    roleId: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    eventDutyType: {
      type: String,
      enum: [
        'NONE', 'HOST', 'SUPER_ADMIN', 'ADMIN', 'SENIOR_TEAM', 'TEAM_LEADER',
        'VOLUNTEER', 'ANCHOR', 'GUEST', 'STUDENT', 'CERTIFICATE_TEAM',
      ],
      default: 'NONE',
    },
    categoriesAssigned: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    availabilityStatus: {
      type: String,
      enum: ['AVAILABLE', 'BUSY', 'ON_STAGE', 'BREAK', 'NOT_AVAILABLE', 'LEFT_VENUE', 'EXPECTED', 'ARRIVED_EARLY'],
      default: 'AVAILABLE',
    },
    stageCounts: {
      anchorCalls: { type: Number, default: 0 },
      guestAwards: { type: Number, default: 0 },
      volunteerAssignments: { type: Number, default: 0 },
      teamAssignments: { type: Number, default: 0 },
    },
    isActive: { type: Boolean, default: true },
    magicToken: { type: String },
    magicTokenExpire: { type: Date },
    // Kept without an enum: existing documents may still hold values from
    // before the unofficial WhatsApp Web transport was removed, and nothing
    // reads this to choose a transport any more.
    whatsappProviderPreference: { type: String },
  },
  { timestamps: true }
);

userSchema.index({ username: 1, tenantId: 1 }, { unique: true, partialFilterExpression: { username: { $type: 'string' } } });
userSchema.index({ mobile: 1 }, { unique: true, partialFilterExpression: { mobile: { $gt: '' } } });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password as string, 10);
  next();
});

userSchema.methods.matchPassword = async function (entered: string): Promise<boolean> {
  const stored = String(this.password || '');
  if (/^\$2[aby]\$/.test(stored)) {
    return bcrypt.compare(entered, stored);
  }
  const ok = verifyPassword(entered, stored);
  if (ok) {
    this.password = entered;
    await this.save();
  }
  return ok;
};

export const User = (mongoose.models.User as any) || mongoose.model('User', userSchema);
export default User;
