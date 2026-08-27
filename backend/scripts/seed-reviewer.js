/**
 * Create (or reset) the Meta App Review reviewer account.
 *
 * Self-service signup sends a one-time code over WhatsApp, so a Meta reviewer
 * cannot register on their own — which is why the 2026-07-13 submission stalled
 * with "no credentials required" in the testing instructions when credentials
 * were in fact mandatory. This script is the supported way to mint that account
 * without an OTP round trip.
 *
 * It creates exactly what POST /api/users/signup/verify creates (same global
 * role, same `tenantId: null`, same shape), so the reviewer's session is
 * indistinguishable from an ordinary self-registered one. Nothing here is
 * review-only: there is no bypass flag, no elevated role, and no code path that
 * behaves differently for this user.
 *
 *   REVIEWER_LOGIN=meta_reviewer REVIEWER_PASSWORD='…' npm run seed-reviewer
 *
 * Re-running it resets the password and re-activates the account, so a reviewer
 * locked out mid-review is one command away from being let back in.
 *
 * There are no default credentials. Both variables must be set, or the script
 * refuses — a known login baked into a public repository is a credential leak,
 * not a convenience.
 */

require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../bulk/models/User');
const Role = require('../bulk/models/Role');
const { seedGlobalRoles, METABSP_USER_ROLE_CODE } = require('../bulk/seedAdmin');

const MIN_PASSWORD_LENGTH = 12;

function readConfig() {
  const login = String(process.env.REVIEWER_LOGIN || '').trim();
  const password = String(process.env.REVIEWER_PASSWORD || '').trim();
  const name = String(process.env.REVIEWER_NAME || 'Meta App Reviewer').trim();
  const mobile = String(process.env.REVIEWER_MOBILE || '').trim();
  const appUrl = String(process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || '').trim();
  const contact = String(process.env.REVIEWER_CONTACT_EMAIL || '').trim();

  const problems = [];
  if (!login) problems.push('REVIEWER_LOGIN is not set.');
  if (!password) problems.push('REVIEWER_PASSWORD is not set.');
  if (password && password.length < MIN_PASSWORD_LENGTH) {
    problems.push(`REVIEWER_PASSWORD is ${password.length} characters; use at least ${MIN_PASSWORD_LENGTH}.`);
  }
  if (!process.env.MONGO_URI) problems.push('MONGO_URI is not set.');

  return { login, password, name, mobile, appUrl, contact, problems };
}

async function seedReviewer(config) {
  await seedGlobalRoles();

  const userRole = await Role.findOne({ code: METABSP_USER_ROLE_CODE, tenantId: null });
  if (!userRole) {
    throw new Error(`Global role ${METABSP_USER_ROLE_CODE} is missing even after seeding — check the Role model.`);
  }

  // Login resolves accounts by `username` scoped to `tenantId: null`
  // (see POST /api/users/login), so that pair is the identity to match on.
  let user = await User.findOne({ username: config.login, tenantId: null });
  let created = false;

  if (user) {
    // Assigning and saving (rather than updateOne) is deliberate: the bcrypt
    // hash is applied by a pre('save') hook, so a direct update would store
    // the password in clear text and every login would then fail.
    user.password = config.password;
    user.isActive = true;
    user.roleId = user.roleId || userRole._id;
    if (config.mobile) user.mobile = config.mobile;
    await user.save();
  } else {
    user = await User.create({
      name: config.name,
      username: config.login,
      password: config.password,
      mobile: config.mobile,
      roleId: userRole._id,
      tenantId: null,
      isActive: true,
    });
    created = true;
  }

  return { user, created };
}

function reportInstructions(config) {
  const appUrl = config.appUrl || '<set PUBLIC_APP_URL and re-run to fill this in>';
  const contact = config.contact || '<set REVIEWER_CONTACT_EMAIL and re-run to fill this in>';

  return [
    '',
    'Paste this into App Review → Testing Instructions:',
    '',
    '  The WhatsApp features in this app are behind a login, so credentials are',
    '  required. Self-registration is not possible: signup requires a one-time',
    '  code delivered over WhatsApp.',
    '',
    `  Application URL: ${appUrl}/login`,
    `  User Name: ${config.login}`,
    `  Password: ${config.password}`,
    '',
    '  The login form asks for "User Name" and "Password". Enter the values',
    '  above exactly — the first field is not an email address or a phone',
    '  number.',
    '',
    `  If the account stops working at any point, contact ${contact} and we will`,
    '  restore access immediately.',
    '',
    'Then verify it yourself, in a private browser window, before submitting:',
    `  1. Open ${appUrl}/login and sign in with exactly those values.`,
    '  2. Confirm you land on the WhatsApp dashboard.',
    '  3. Confirm the "Connect with Meta" button is visible and opens Meta\'s popup.',
    'If you cannot complete all three, neither can the reviewer.',
    '',
  ].join('\n');
}

async function main() {
  const config = readConfig();

  if (config.problems.length) {
    console.error('Cannot seed the reviewer account:\n');
    for (const problem of config.problems) console.error(`  • ${problem}`);
    console.error(
      [
        '',
        'Usage:',
        '',
        '  REVIEWER_LOGIN=meta_reviewer \\',
        '  REVIEWER_PASSWORD=<a strong password you generate> \\',
        '  REVIEWER_CONTACT_EMAIL=you@example.com \\',
        '  PUBLIC_APP_URL=https://your-app-domain \\',
        '  npm run seed-reviewer --workspace=backend',
        '',
        'There is no default login. Pick one, run this against production, and',
        'put the same values in the App Review testing instructions.',
        '',
      ].join('\n')
    );
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    const { user, created } = await seedReviewer(config);
    console.log(
      created
        ? `Reviewer account created: ${user.username} (id ${user._id})`
        : `Reviewer account already existed: ${user.username} (id ${user._id}) — password reset and account re-activated.`
    );
    console.log(reportInstructions(config));
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to seed the reviewer account:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { seedReviewer, readConfig, reportInstructions, MIN_PASSWORD_LENGTH };
