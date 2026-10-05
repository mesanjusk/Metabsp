import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import mongoose from 'mongoose';
import { connectDB } from '../db/mongo';
import BackupSnapshot from '../models/BackupSnapshot';
import cloudinary from '../utils/cloudinary';
import logger from '../utils/logger';

const MAGIC = Buffer.from('SKDB1');
const IV_BYTES = 12;
const TAG_BYTES = 16;
const BACKUP_FOLDER = String(process.env.BACKUP_CLOUDINARY_FOLDER || 'system_backups').trim() || 'system_backups';

function backupKey(): Buffer {
  const raw = String(process.env.BACKUP_ENCRYPTION_KEY || '').trim();
  if (!raw) throw new Error('BACKUP_ENCRYPTION_KEY is required for encrypted backups');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY must be a base64-encoded 32-byte value');
  return key;
}

function assertCloudinaryConfigured() {
  for (const name of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
    if (!String(process.env[name] || '').trim()) throw new Error(`${name} is required for off-host backups`);
  }
}

function ejson() {
  const EJSON = (mongoose as any).mongo?.BSON?.EJSON;
  if (!EJSON) throw new Error('MongoDB Extended JSON serializer is unavailable');
  return EJSON;
}

async function* backupLines(db: any, counters: { collections: number; documents: number }) {
  const EJSON = ejson();
  const collectionDefs = (await db.listCollections({}).toArray())
    .filter((item: any) => {
      const name = String(item.name || '');
      return name && !name.startsWith('system.') && name !== 'backupsnapshots';
    })
    .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));

  yield JSON.stringify({
    type: 'manifest',
    format: 'skdigital-mongo-ejson',
    version: 1,
    createdAt: new Date().toISOString(),
    collections: collectionDefs.map((item: any) => String(item.name)),
  }) + '\n';

  for (const definition of collectionDefs) {
    const name = String(definition.name);
    counters.collections += 1;
    const indexes = await db.collection(name).indexes().catch(() => []);
    yield JSON.stringify({
      type: 'collection',
      name,
      ejsonOptions: EJSON.stringify(definition.options || {}, { relaxed: false }),
      ejsonIndexes: EJSON.stringify(indexes || [], { relaxed: false }),
    }) + '\n';
    const cursor = db.collection(name).find({});
    for await (const doc of cursor) {
      counters.documents += 1;
      yield JSON.stringify({ type: 'document', collection: name, ejson: EJSON.stringify(doc, { relaxed: false }) }) + '\n';
    }
  }
}

async function encryptFile(inputPath: string, outputPath: string, key: Buffer) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const cipherPath = `${outputPath}.cipher`;

  await pipeline(fs.createReadStream(inputPath), cipher, fs.createWriteStream(cipherPath));
  const tag = cipher.getAuthTag();

  await fs.promises.writeFile(outputPath, Buffer.concat([MAGIC, iv]));
  await pipeline(fs.createReadStream(cipherPath), fs.createWriteStream(outputPath, { flags: 'a' }));
  await fs.promises.appendFile(outputPath, tag);
  await fs.promises.rm(cipherPath, { force: true });
}

async function fileSha256(filePath: string) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

async function pruneOldBackups() {
  const retentionDays = Math.max(7, Number(process.env.BACKUP_RETENTION_DAYS || 30));
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const old: any[] = await BackupSnapshot.find({
    status: 'success',
    completedAt: { $lt: cutoff },
    publicId: { $ne: '' },
  })
    .sort({ completedAt: 1 })
    .limit(100)
    .lean();

  let removed = 0;
  for (const item of old) {
    try {
      await (cloudinary as any).uploader.destroy(item.publicId, {
        resource_type: 'raw',
        invalidate: true,
      });
      await BackupSnapshot.deleteOne({ _id: item._id });
      removed += 1;
    } catch (error: any) {
      logger.warn(`[backup] Could not prune ${item.publicId}: ${error?.message || error}`);
    }
  }
  return removed;
}

export async function hasRecentSuccessfulBackup({
  maxAgeHours = Number(process.env.BACKUP_MAX_AGE_HOURS || 26),
} = {}) {
  await connectDB();
  const latest: any = await BackupSnapshot.findOne({ status: 'success' }).sort({ completedAt: -1 }).lean();
  const completedAt = latest?.completedAt ? new Date(latest.completedAt) : null;
  const ageMs = completedAt ? Date.now() - completedAt.getTime() : Number.POSITIVE_INFINITY;
  return {
    ok: Boolean(completedAt && ageMs <= maxAgeHours * 60 * 60 * 1000),
    latest,
    ageHours: Number.isFinite(ageMs) ? ageMs / (60 * 60 * 1000) : null,
  };
}

export async function runEncryptedCloudBackup() {
  assertCloudinaryConfigured();
  const key = backupKey();
  await connectDB();
  const db: any = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection has no active database handle');

  const snapshot: any = await BackupSnapshot.create({
    status: 'running',
    startedAt: new Date(),
    formatVersion: 1,
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = path.join(os.tmpdir(), `skdigital-backup-${timestamp}-${process.pid}`);
  const gzipPath = `${base}.jsonl.gz`;
  const encryptedPath = `${base}.skdb`;
  const counters = { collections: 0, documents: 0 };

  try {
    await pipeline(
      Readable.from(backupLines(db, counters)),
      createGzip({ level: 9 }),
      fs.createWriteStream(gzipPath)
    );

    await encryptFile(gzipPath, encryptedPath, key);
    const stat = await fs.promises.stat(encryptedPath);
    const sha256 = await fileSha256(encryptedPath);
    const publicId = `skdigital-${timestamp}`;

    const upload: any = await (cloudinary as any).uploader.upload(encryptedPath, {
      resource_type: 'raw',
      folder: BACKUP_FOLDER,
      public_id: publicId,
      overwrite: false,
    });

    const completedAt = new Date();
    await BackupSnapshot.updateOne(
      { _id: snapshot._id },
      {
        $set: {
          status: 'success',
          completedAt,
          publicId: String(upload.public_id || ''),
          secureUrl: String(upload.secure_url || ''),
          bytes: Number(stat.size || upload.bytes || 0),
          sha256,
          collectionCount: counters.collections,
          documentCount: counters.documents,
          error: '',
        },
      }
    );

    const pruned = await pruneOldBackups();
    logger.info(
      `[backup] Encrypted off-host backup complete: ${counters.collections} collections, ${counters.documents} documents, ${stat.size} bytes, pruned ${pruned}`
    );

    return {
      ran: true,
      publicId: String(upload.public_id || ''),
      bytes: stat.size,
      sha256,
      collectionCount: counters.collections,
      documentCount: counters.documents,
      pruned,
    };
  } catch (error: any) {
    await BackupSnapshot.updateOne(
      { _id: snapshot._id },
      {
        $set: {
          status: 'failed',
          completedAt: new Date(),
          error: String(error?.message || error).slice(0, 2000),
          collectionCount: counters.collections,
          documentCount: counters.documents,
        },
      }
    ).catch(() => undefined);
    throw error;
  } finally {
    await Promise.all([
      fs.promises.rm(gzipPath, { force: true }).catch(() => undefined),
      fs.promises.rm(encryptedPath, { force: true }).catch(() => undefined),
      fs.promises.rm(`${encryptedPath}.cipher`, { force: true }).catch(() => undefined),
    ]);
  }
}

export const backupFormat = { MAGIC: MAGIC.toString('utf8'), IV_BYTES, TAG_BYTES };
