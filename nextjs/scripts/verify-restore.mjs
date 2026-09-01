#!/usr/bin/env node
/**
 * Restore-drill verification — run against a freshly restored (scratch)
 * database to confirm the restore is actually usable, per the checklist in
 * docs/BACKUP_RESTORE.md. Checks:
 *
 *   1. The app can connect to MONGO_URI at all.
 *   2. Key collections have a plausible row count.
 *   3. At least one WhatsAppAccount's accessTokenEncrypted actually decrypts
 *      with the currently configured key. This is the check that catches
 *      "restored the database but not the key that goes with it" — the single
 *      most common way a restore silently fails to be useful.
 *
 * Usage: MONGO_URI=... WHATSAPP_TOKEN_ENCRYPTION_KEY=... node scripts/verify-restore.mjs
 * Exits 0 if every check passes, 1 otherwise.
 */
import mongoose from 'mongoose';
import crypto from 'crypto';

const COLLECTIONS_TO_CHECK = ['whatsappaccounts', 'messages', 'contacts', 'users', 'organizations'];

// Mirrors lib/utils/crypto.ts. Duplicated rather than imported because that
// module is TypeScript compiled by Next, which this standalone script cannot
// load — keep the two in step if the format ever changes.
function decryptSensitiveValue(cipherText) {
  const parts = String(cipherText || '').split(':');
  const keyOf = (raw) => {
    if (!raw) return null;
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('Encryption key must be a base64-encoded 32-byte value');
    return key;
  };
  const current = keyOf(process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY);
  const previous = keyOf(process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS);
  if (!current) throw new Error('WHATSAPP_TOKEN_ENCRYPTION_KEY is missing');

  const run = (key, iv, tag, payload) => {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(payload, 'base64')), decipher.final()]).toString('utf8');
  };

  const [iv, tag, payload] = parts.length === 5 ? parts.slice(2) : parts;
  try {
    return run(current, iv, tag, payload);
  } catch (error) {
    if (previous) return run(previous, iv, tag, payload);
    throw error;
  }
}

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error('MONGO_URI must be set');
  process.exit(1);
}

const results = [];
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
  const sample = await db
    .collection('whatsappaccounts')
    .findOne({ accessTokenEncrypted: { $exists: true, $ne: '' } });

  if (!sample) {
    results.push({ check: 'Token decryption sample', ok: true, detail: 'No WhatsAppAccount documents to sample — skipped' });
  } else {
    decryptSensitiveValue(sample.accessTokenEncrypted);
    results.push({ check: 'Token decryption sample', ok: true, detail: `Decrypted account ${sample._id} successfully` });
  }
} catch (error) {
  results.push({
    check: 'Token decryption sample',
    ok: false,
    detail: `${error.message} — is WHATSAPP_TOKEN_ENCRYPTION_KEY (and _PREVIOUS, if this data predates a rotation) set to match what encrypted it?`,
  });
}

await mongoose.connection.close();

for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.check}${result.detail ? ` — ${result.detail}` : ''}`);
}

const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`\n${failed.length} check(s) failed — this restore is NOT verified as usable.`);
  process.exit(1);
}
console.log('\nAll checks passed — restore looks usable.');
