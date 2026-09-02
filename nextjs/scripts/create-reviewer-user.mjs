#!/usr/bin/env node
/**
 * Creates (or resets the password of) the account Meta's App Review reviewer
 * signs in with.
 *
 * This exists because the reviewer account cannot be self-served. Signup
 * requires a one-time code delivered over WhatsApp to the number being
 * registered, so an account can only be created by someone holding that
 * number — which a reviewer is not, and which you may not be either for a
 * number you would rather hand out than own.
 *
 * Setting META_REVIEWER_LOGIN and META_REVIEWER_PASSWORD does NOT create
 * anything. Those variables tell the deploy gate and the /meta-app-review
 * page which credentials were submitted; the account behind them has to
 * exist, or the reviewer gets "Invalid mobile number or password" and the
 * submission fails for being untestable.
 *
 * Usage:
 *   MONGO_URI=... REVIEWER_MOBILE=... REVIEWER_PASSWORD=... \
 *     node scripts/create-reviewer-user.mjs
 *
 * Optional: REVIEWER_NAME (display name only; never used to authenticate).
 *
 * Idempotent. Run it again to reset the password on an existing account.
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * Must stay in step with `normalizeAccountMobile` in
 * lib/utils/accountMobile.ts. Duplicated rather than imported because that
 * file is TypeScript compiled by Next, which a standalone node script cannot
 * import — the same reason seed-billing-plans.mjs writes raw collections.
 *
 * If the two ever disagree, this script creates an account under a number the
 * login route will not find, which looks exactly like a wrong password.
 */
function normalizeAccountMobile(value) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

const mongoUri = process.env.MONGO_URI;
const rawMobile = process.env.REVIEWER_MOBILE;
const password = process.env.REVIEWER_PASSWORD;
const displayName = process.env.REVIEWER_NAME;

const missing = [
  !mongoUri && 'MONGO_URI',
  !rawMobile && 'REVIEWER_MOBILE',
  !password && 'REVIEWER_PASSWORD',
].filter(Boolean);

if (missing.length) {
  console.error(`[create-reviewer-user] Missing: ${missing.join(', ')}`);
  process.exit(1);
}

const mobile = normalizeAccountMobile(rawMobile);
if (mobile.length < 10 || mobile.length > 15) {
  console.error(
    `[create-reviewer-user] "${rawMobile}" does not normalise to a plausible number (got "${mobile}").`
  );
  process.exit(1);
}

await mongoose.connect(mongoUri);
const db = mongoose.connection.db;

// The default role, mirroring getGlobalRoles() in lib/auth/globalRoles.ts —
// $setOnInsert so an operator who has deliberately adjusted what the default
// role can do does not have it reset by running this.
const roles = db.collection('roles');
await roles.updateOne(
  { code: 'METABSP_USER', tenantId: null },
  {
    $setOnInsert: {
      name: 'User',
      code: 'METABSP_USER',
      permissions: ['dashboard:view', 'whatsapp:send'],
      tenantId: null,
      dashboardKey: 'default',
      createdAt: new Date(),
    },
  },
  { upsert: true }
);
const userRole = await roles.findOne({ code: 'METABSP_USER', tenantId: null });

// The same refusal the application makes at boot. A reviewer account holding
// '*' would be a platform administrator handed to an outside party, and the
// failure is silent — the account works, it just does far more than intended.
if (Array.isArray(userRole?.permissions) && userRole.permissions.includes('*')) {
  console.error(
    "[create-reviewer-user] The METABSP_USER role grants '*' (full administrator). " +
      'Refusing to create a reviewer account with it. Remove that permission from the role first.'
  );
  await mongoose.disconnect();
  process.exit(1);
}

// bcrypt cost 10, matching userSchema's pre('save') hook. Hashed here because
// this writes the raw collection, which does not run Mongoose middleware.
const hashed = await bcrypt.hash(password, 10);

const users = db.collection('users');
const existing = await users.findOne({
  tenantId: null,
  $or: [{ mobile }, { mobile: rawMobile }, { username: mobile }, { username: rawMobile }],
});

if (existing) {
  await users.updateOne(
    { _id: existing._id },
    { $set: { password: hashed, isActive: true, updatedAt: new Date() } }
  );
  console.log(`[create-reviewer-user] Existing account ${mobile} found — password reset, account activated.`);
} else {
  await users.insertOne({
    name: displayName || mobile,
    username: mobile,
    mobile,
    password: hashed,
    roleId: userRole._id,
    tenantId: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log(`[create-reviewer-user] Created account ${mobile}.`);
}

await mongoose.disconnect();

console.log('');
console.log('Set these on the service, then verify the login yourself in a private window:');
console.log(`  META_REVIEWER_LOGIN=${mobile}`);
console.log('  META_REVIEWER_PASSWORD=<the password you just used>');
console.log('');
console.log(`The login form accepts ${mobile}, ${mobile.slice(-10)}, or the punctuated form —`);
console.log('all three normalise to the same account.');
