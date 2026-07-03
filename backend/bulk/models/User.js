const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { verifyPassword } = require('../../src/utils/password');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  username: { type: String, required: true, trim: true },
  password: { type: String, required: true },
  mobile:   { type: String, default: '', trim: true },
  email:    { type: String, default: '' },
  roleId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },
  eventDutyType: {
    type: String,
    enum: ['NONE','HOST','SUPER_ADMIN','ADMIN','SENIOR_TEAM','TEAM_LEADER','VOLUNTEER','ANCHOR','GUEST','STUDENT','CERTIFICATE_TEAM'],
    default: 'NONE'
  },
  categoriesAssigned: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  availabilityStatus: {
    type: String,
    enum: ['AVAILABLE','BUSY','ON_STAGE','BREAK','NOT_AVAILABLE','LEFT_VENUE','EXPECTED','ARRIVED_EARLY'],
    default: 'AVAILABLE'
  },
  stageCounts: {
    anchorCalls:          { type: Number, default: 0 },
    guestAwards:          { type: Number, default: 0 },
    volunteerAssignments: { type: Number, default: 0 },
    teamAssignments:      { type: Number, default: 0 }
  },
  isActive:         { type: Boolean, default: true },
  magicToken:       { type: String },
  magicTokenExpire: { type: Date },
}, { timestamps: true });

// username unique per tenant (partial: skip docs where username is null/missing)
userSchema.index(
  { username: 1, tenantId: 1 },
  { unique: true, partialFilterExpression: { username: { $type: 'string' } } }
);
// mobile unique globally (mobile = account login identifier, empty strings excluded)
userSchema.index(
  { mobile: 1 },
  { unique: true, partialFilterExpression: { mobile: { $gt: '' } } }
);

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = async function(entered) {
  const stored = String(this.password || '');
  if (/^\$2[aby]\$/.test(stored)) {
    return bcrypt.compare(entered, stored);
  }
  // Legacy Metabsp account (scrypt-hashed or plaintext, migrated in place) —
  // verify with the legacy scheme, then transparently upgrade to bcrypt.
  const ok = verifyPassword(entered, stored);
  if (ok) {
    this.password = entered;
    await this.save();
  }
  return ok;
};

module.exports = mongoose.model('User', userSchema);
