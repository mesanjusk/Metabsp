const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { verifyPassword } = require('../../src/utils/password');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  username: { type: String, required: true, trim: true },
  // Required only for password accounts. A user who signed up with Google or
  // Facebook has no password at all, and storing a dummy one would make
  // matchPassword() succeed against a guessable value.
  password: {
    type: String,
    required: function requirePasswordUnlessSocial() {
      return !this.googleId && !this.facebookId;
    },
  },
  mobile:   { type: String, default: '', trim: true },
  email:    { type: String, default: '', trim: true, lowercase: true },
  // Set once the provider has asserted the address is verified (Google's
  // `email_verified`). Linking a social login to an existing account by email
  // is only safe when this is true — otherwise anyone able to claim an
  // address at a provider could take over the matching account here.
  emailVerified: { type: Boolean, default: false },
  googleId:   { type: String, default: '', trim: true },
  facebookId: { type: String, default: '', trim: true },
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
  // Which WhatsApp sending path this user's dashboard shows: 'baileys'
  // (QR/WhatsApp-Web), 'meta' (official Cloud API), or 'both'. Unset until
  // they choose on first login after signup — no default on purpose, so
  // "unset" is distinguishable from an explicit choice.
  whatsappProviderPreference: { type: String, enum: ['baileys', 'meta', 'both'] },
}, { timestamps: true });

// username unique per tenant (partial: skip docs where username is null/missing)
userSchema.index(
  { username: 1, tenantId: 1 },
  { unique: true, partialFilterExpression: { username: { $type: 'string' } } }
);
// One social identity maps to at most one account. Partial filters exclude the
// empty-string default, exactly as the mobile index below does.
userSchema.index({ googleId: 1 }, { unique: true, partialFilterExpression: { googleId: { $gt: '' } } });
userSchema.index({ facebookId: 1 }, { unique: true, partialFilterExpression: { facebookId: { $gt: '' } } });

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

  // A social-only account has no password. Without this guard the legacy
  // branch below reduces to `entered === ''`, so an empty candidate would
  // authenticate. The login route already rejects an empty password, but this
  // must not depend on a caller's validation.
  if (!stored) return false;
  if (!String(entered || '')) return false;

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
