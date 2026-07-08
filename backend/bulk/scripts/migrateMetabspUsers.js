/**
 * One-time, idempotent migration: folds legacy Metabsp user documents (the old
 * `Users` model — User_name/Password/Mobile_number/User_group) into the unified
 * `User`/`Role` schema in place (same _id, same underlying `users` collection —
 * both models already pointed at the same collection by Mongoose's default
 * pluralization, so this just gives the existing documents the right shape).
 *
 * Run manually once, after deploying the unified auth code, against your real
 * MONGO_URI:
 *
 *   node backend/bulk/scripts/migrateMetabspUsers.js
 *
 * Safe to re-run: only touches documents that still have a `User_name` field.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Role = require('../models/Role');
const { PERMISSIONS } = require('../utils/permissions');
const logger = require('../../src/utils/logger');

const METABSP_ADMIN_ROLE_CODE = 'METABSP_ADMIN';
const METABSP_USER_ROLE_CODE = 'METABSP_USER';

async function run() {
  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) throw new Error('MONGO_URI is not set');
  await mongoose.connect(mongoURI);
  logger.info('[migrate] connected to', mongoURI.replace(/\/\/.*@/, '//***@'));

  const adminRole = await Role.findOneAndUpdate(
    { code: METABSP_ADMIN_ROLE_CODE, tenantId: null },
    { name: 'Admin', code: METABSP_ADMIN_ROLE_CODE, permissions: ['*'], tenantId: null, dashboardKey: 'admin' },
    { upsert: true, new: true }
  );
  const userRole = await Role.findOneAndUpdate(
    { code: METABSP_USER_ROLE_CODE, tenantId: null },
    { name: 'User', code: METABSP_USER_ROLE_CODE, permissions: [PERMISSIONS.dashboard_view, PERMISSIONS.whatsapp_send], tenantId: null, dashboardKey: 'default' },
    { upsert: true, new: true }
  );

  const usersCollection = mongoose.connection.collection('users');
  const legacyDocs = await usersCollection.find({ User_name: { $exists: true } }).toArray();
  logger.info(`[migrate] found ${legacyDocs.length} legacy Metabsp user document(s) to migrate`);

  let migrated = 0;
  for (const doc of legacyDocs) {
    const roleId = String(doc.User_group || 'user').toLowerCase() === 'admin' ? adminRole._id : userRole._id;

    await usersCollection.updateOne(
      { _id: doc._id },
      {
        $set: {
          name: doc.User_name,
          username: doc.User_name,
          password: doc.Password, // matchPassword() falls back to legacy scrypt/plaintext verification and upgrades to bcrypt on next successful login
          mobile: doc.Mobile_number || '',
          roleId,
          tenantId: null,
          isActive: true,
        },
        $unset: {
          User_name: '',
          Password: '',
          Mobile_number: '',
          User_group: '',
        },
      }
    );
    migrated++;
  }

  logger.info(`[migrate] done — migrated ${migrated} user(s).`);
  await mongoose.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('[migrate] failed:', err);
    process.exit(1);
  });
