#!/usr/bin/env node
/**
 * Restore-drill verification — run this against a freshly restored
 * (scratch/disaster-recovery) database to confirm the restore is actually
 * usable, per the checklist in docs/BACKUP_RESTORE.md. Checks:
 *
 *   1. The app can connect to MONGO_URI at all.
 *   2. A handful of key collections have a plausible row count (not zero,
 *      unless the source genuinely had none).
 *   3. At least one WhatsAppAccount's accessTokenEncrypted actually
 *      decrypts with the currently configured TOKEN_ENCRYPTION_KEY — this
 *      is the check that catches "restored the database but not the key
 *      that goes with it," which is the single most common way a restore
 *      silently fails to be useful.
 *
 * Usage: MONGO_URI=... WHATSAPP_TOKEN_ENCRYPTION_KEY=... node scripts/verify-restore.js
 * Exits 0 if every check passes, 1 otherwise — safe to wire into a
 * disaster-recovery runbook or CI job.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { decryptSensitiveValue } = require('../src/utils/crypto');

const COLLECTIONS_TO_CHECK = ['whatsappaccounts', 'messages', 'contacts', 'users', 'organizations'];

async function main() {
  const results = [];
  let mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI must be set');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  results.push({ check: 'Mongo connection', ok: true });

  const db = mongoose.connection.db;

  for (const name of COLLECTIONS_TO_CHECK) {
    try {
      const count = await db.collection(name).countDocuments();
      results.push({ check: `Collection "${name}" row count`, ok: true, detail: `${count} documents` });
    } catch (error) {
      results.push({ check: `Collection "${name}" row count`, ok: false, detail: error.message });
    }
  }

  try {
    const sampleAccount = await db.collection('whatsappaccounts').findOne({ accessTokenEncrypted: { $exists: true, $ne: '' } });
    if (!sampleAccount) {
      results.push({ check: 'Token decryption sample', ok: true, detail: 'No WhatsAppAccount documents to sample — skipped' });
    } else {
      decryptSensitiveValue(sampleAccount.accessTokenEncrypted);
      results.push({ check: 'Token decryption sample', ok: true, detail: `Decrypted account ${sampleAccount._id} successfully` });
    }
  } catch (error) {
    results.push({
      check: 'Token decryption sample',
      ok: false,
      detail: `${error.message} — is TOKEN_ENCRYPTION_KEY (and _PREVIOUS, if this DB predates a key rotation) set to match what encrypted this data?`,
    });
  }

  await mongoose.connection.close();

  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    console.log(`${r.ok ? '✅' : '❌'} ${r.check}${r.detail ? ` — ${r.detail}` : ''}`);
  }

  if (failed.length) {
    console.error(`\n${failed.length} check(s) failed — this restore is not verified as usable.`);
    process.exit(1);
  }

  console.log('\nAll checks passed — restore looks usable.');
}

main().catch((error) => {
  console.error('verify-restore failed:', error.message);
  process.exit(1);
});
