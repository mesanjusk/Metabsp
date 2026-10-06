#!/usr/bin/env node
/**
 * Restore the latest encrypted SK Digital logical backup (or a named Cloudinary
 * public id) into MONGO_URI.
 *
 * Safety: requires RESTORE_CONFIRM=YES_I_UNDERSTAND. This is destructive for
 * the collections present in the backup: documents are removed before restore.
 *
 * Examples:
 *   RESTORE_CONFIRM=YES_I_UNDERSTAND MONGO_URI=... BACKUP_ENCRYPTION_KEY=... \
 *     CLOUDINARY_CLOUD_NAME=... CLOUDINARY_API_KEY=... CLOUDINARY_API_SECRET=... \
 *     node scripts/restore-cloud-backup.mjs
 *
 *   ... node scripts/restore-cloud-backup.mjs system_backups/skdigital-2026-10-05T...
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';

const MAGIC = Buffer.from('SKDB1');
const HEADER_BYTES = MAGIC.length + 12;
const TAG_BYTES = 16;
const folder = String(process.env.BACKUP_CLOUDINARY_FOLDER || 'system_backups').trim() || 'system_backups';

if (process.env.RESTORE_CONFIRM !== 'YES_I_UNDERSTAND') {
  console.error('Refusing destructive restore. Set RESTORE_CONFIRM=YES_I_UNDERSTAND after checking MONGO_URI.');
  process.exit(2);
}
if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
for (const name of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'BACKUP_ENCRYPTION_KEY']) {
  if (!String(process.env[name] || '').trim()) throw new Error(`${name} is required`);
}

const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY, 'base64');
if (key.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY must be a base64-encoded 32-byte value');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function resolveBackupAsset() {
  const requested = String(process.argv[2] || '').trim();
  if (requested) return cloudinary.api.resource(requested, { resource_type: 'raw', type: 'upload' });

  const result = await cloudinary.api.resources({
    resource_type: 'raw',
    type: 'upload',
    prefix: `${folder}/verified-`,
    max_results: 100,
  });
  const resources = Array.isArray(result.resources) ? result.resources : [];
  if (!resources.length) throw new Error(`No remotely verified encrypted backups found under ${folder}/`);
  resources.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  return resources[0];
}

async function download(url, filePath) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Backup download failed: HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(filePath));
}

async function decryptBackup(encryptedPath, gzipPath) {
  const stat = await fs.promises.stat(encryptedPath);
  if (stat.size <= HEADER_BYTES + TAG_BYTES) throw new Error('Backup file is too small to be valid');

  const handle = await fs.promises.open(encryptedPath, 'r');
  try {
    const header = Buffer.alloc(HEADER_BYTES);
    await handle.read(header, 0, HEADER_BYTES, 0);
    if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Backup magic/version header is invalid');

    const tag = Buffer.alloc(TAG_BYTES);
    await handle.read(tag, 0, TAG_BYTES, stat.size - TAG_BYTES);

    const iv = header.subarray(MAGIC.length);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    await pipeline(
      fs.createReadStream(encryptedPath, { start: HEADER_BYTES, end: stat.size - TAG_BYTES - 1 }),
      decipher,
      fs.createWriteStream(gzipPath)
    );
  } finally {
    await handle.close();
  }
}

async function gunzipBackup(gzipPath, jsonlPath) {
  await pipeline(fs.createReadStream(gzipPath), createGunzip(), fs.createWriteStream(jsonlPath));
}

const tempBase = path.join(os.tmpdir(), `skdigital-restore-${Date.now()}-${process.pid}`);
const encryptedPath = `${tempBase}.skdb`;
const gzipPath = `${tempBase}.jsonl.gz`;
const jsonlPath = `${tempBase}.jsonl`;

let connection;
try {
  const asset = await resolveBackupAsset();
  console.log(`Restoring encrypted backup: ${asset.public_id} (${asset.bytes || 'unknown'} bytes)`);
  await download(asset.secure_url, encryptedPath);
  await decryptBackup(encryptedPath, gzipPath);
  await gunzipBackup(gzipPath, jsonlPath);

  connection = await mongoose.connect(process.env.MONGO_URI, {
    autoIndex: false,
    serverSelectionTimeoutMS: 10_000,
  });
  const db = mongoose.connection.db;
  const EJSON = mongoose.mongo?.BSON?.EJSON;
  if (!db || !EJSON) throw new Error('MongoDB database/EJSON serializer is unavailable');

  const existingNames = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((x) => x.name));
  const rl = readline.createInterface({ input: fs.createReadStream(jsonlPath), crlfDelay: Infinity });

  let current = null;
  let batch = [];
  let restoredDocs = 0;
  let restoredCollections = 0;

  const flush = async () => {
    if (!current) return;
    if (batch.length) {
      await db.collection(current.name).insertMany(batch, { ordered: false });
      restoredDocs += batch.length;
      batch = [];
    }
  };

  const finalizeCollection = async () => {
    if (!current) return;
    await flush();
    const indexes = Array.isArray(current.indexes) ? current.indexes : [];
    for (const index of indexes) {
      if (!index || index.name === '_id_' || !index.key) continue;
      const { key: indexKey, ns: _ns, v: _v, background: _background, ...options } = index;
      try {
        await db.collection(current.name).createIndex(indexKey, options);
      } catch (error) {
        console.warn(`WARN index ${current.name}.${options.name || JSON.stringify(indexKey)}: ${error.message}`);
      }
    }
  };

  for await (const line of rl) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);

    if (row.type === 'manifest') {
      if (row.format !== 'skdigital-mongo-ejson' || row.version !== 1) {
        throw new Error(`Unsupported backup format/version: ${row.format} v${row.version}`);
      }
      continue;
    }

    if (row.type === 'collection') {
      await finalizeCollection();
      const name = String(row.name || '');
      if (!name || name.startsWith('system.')) throw new Error(`Unsafe collection name in backup: ${name}`);

      const options = row.ejsonOptions ? EJSON.parse(row.ejsonOptions) : {};
      if (!existingNames.has(name)) {
        await db.createCollection(name, options);
        existingNames.add(name);
      } else {
        await db.collection(name).deleteMany({});
      }

      current = {
        name,
        options,
        indexes: row.ejsonIndexes ? EJSON.parse(row.ejsonIndexes) : [],
      };
      restoredCollections += 1;
      continue;
    }

    if (row.type === 'document') {
      if (!current || row.collection !== current.name) {
        throw new Error(`Backup document appeared outside its collection block: ${row.collection}`);
      }
      batch.push(EJSON.parse(row.ejson));
      if (batch.length >= 500) await flush();
    }
  }

  await finalizeCollection();
  console.log(`Restore complete: ${restoredCollections} collections, ${restoredDocs} documents.`);
  console.log('Next: run npm run verify-restore against this target before any production cutover.');
} finally {
  await connection?.disconnect?.().catch(() => undefined);
  await Promise.all([
    fs.promises.rm(encryptedPath, { force: true }).catch(() => undefined),
    fs.promises.rm(gzipPath, { force: true }).catch(() => undefined),
    fs.promises.rm(jsonlPath, { force: true }).catch(() => undefined),
  ]);
}
