import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import mongoose from 'mongoose';
import { connectDB } from '../db/mongo';
import SmbRecord from '../models/SmbRecord';
import cloudinary from '../utils/cloudinary';
import logger from '../utils/logger';

const MAGIC = Buffer.from('SKDB1');
const IV_BYTES = 12;
const TAG_BYTES = 16;
const BACKUP_FOLDER = String(process.env.BACKUP_CLOUDINARY_FOLDER || 'system_backups').trim() || 'system_backups';
const STORAGE_KIND = 'system_backup_snapshot';
const SMB_COLLECTION_NAME = SmbRecord.collection.name;

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

const snapshotView = (record: any) => {
  if (!record) return null;
  const data = record.data || {};
  return {
    id: String(record._id || ''),
    status: String(record.status || ''),
    startedAt: data.startedAt || record.createdAt || null,
    completedAt: record.completedAt || null,
    publicId: String(data.publicId || ''),
    bytes: Number(data.bytes || 0),
    sha256: String(data.sha256 || ''),
    collectionCount: Number(data.collectionCount || 0),
    documentCount: Number(data.documentCount || 0),
    error: String(data.error || ''),
    formatVersion: Number(data.formatVersion || 1),
    remoteVerified: Boolean(data.remoteVerified),
  };
};

async function* backupLines(db: any, counters: { collections: number; documents: number }) {
  const EJSON = ejson();
  const collectionDefs = (await db.listCollections({}).toArray())
    .filter((item: any) => {
      const name = String(item.name || '');
      // The old failed implementation may have created neither collection
      // because Atlas is already above its collection cap, but exclude the
      // names defensively if the database is later migrated to a larger tier.
      return (
        item.type === 'collection' &&
        name &&
        !name.startsWith('system.') &&
        name !== 'backupsnapshots' &&
        name !== 'durablequeuejobs'
      );
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

    // Do not put backup bookkeeping or in-flight queue state inside the
    // disaster-recovery snapshot. Restoring those rows could cause a stale
    // outbound WhatsApp send to replay after a database restore.
    const query =
      name === SMB_COLLECTION_NAME
        ? { kind: { $nin: ['system_backup_snapshot', 'system_durable_queue'] } }
        : {};

    const cursor = db.collection(name).find(query);
    for await (const doc of cursor) {
      counters.documents += 1;
      yield JSON.stringify({
        type: 'document',
        collection: name,
        ejson: EJSON.stringify(doc, { relaxed: false }),
      }) + '\n';
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

async function verifyRemoteArtifact(url: string, expectedSha256: string, expectedBytes: number) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok || !response.body) {
    throw new Error(`Uploaded backup could not be downloaded for verification (HTTP ${response.status})`);
  }

  const hash = crypto.createHash('sha256');
  let bytes = 0;
  for await (const chunk of Readable.fromWeb(response.body as any)) {
    const buffer = Buffer.from(chunk as any);
    bytes += buffer.length;
    hash.update(buffer);
  }

  const sha256 = hash.digest('hex');
  if (bytes !== expectedBytes) {
    throw new Error(`Remote backup byte count mismatch: expected ${expectedBytes}, downloaded ${bytes}`);
  }
  if (sha256 !== expectedSha256) {
    throw new Error('Remote backup SHA-256 mismatch');
  }
  return { bytes, sha256 };
}

async function pruneOldBackups() {
  const retentionDays = Math.max(7, Number(process.env.BACKUP_RETENTION_DAYS || 30));
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const old: any[] = await SmbRecord.find({
    kind: STORAGE_KIND,
    status: 'success',
    completedAt: { $lt: cutoff },
    'data.publicId': { $exists: true, $ne: '' },
  })
    .sort({ completedAt: 1 })
    .limit(100)
    .lean();

  let removed = 0;
  for (const item of old) {
    const publicId = String(item?.data?.publicId || '');
    try {
      await (cloudinary as any).uploader.destroy(publicId, {
        resource_type: 'raw',
        invalidate: true,
      });
      await SmbRecord.deleteOne({ _id: item._id, kind: STORAGE_KIND });
      removed += 1;
    } catch (error: any) {
      logger.warn(`[backup] Could not prune ${publicId}: ${error?.message || error}`);
    }
  }
  return removed;
}

export async function listBackupSnapshots({ limit = 20 } = {}) {
  await connectDB();
  const rows: any[] = await SmbRecord.find({ kind: STORAGE_KIND })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(Number(limit) || 20, 100)))
    .lean();
  return rows.map(snapshotView).filter(Boolean);
}

export async function hasRecentSuccessfulBackup({
  maxAgeHours = Number(process.env.BACKUP_MAX_AGE_HOURS || 26),
} = {}) {
  await connectDB();
  const latestRecord: any = await SmbRecord.findOne({
    kind: STORAGE_KIND,
    status: 'success',
    'data.remoteVerified': true,
  })
    .sort({ completedAt: -1 })
    .lean();

  const latest = snapshotView(latestRecord);
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

  const startedAt = new Date();
  const timestamp = startedAt.toISOString().replace(/[:.]/g, '-');
  const snapshot: any = await SmbRecord.create({
    userId: null,
    kind: STORAGE_KIND,
    title: `Encrypted database backup ${timestamp}`,
    status: 'running',
    source: 'system',
    reference: timestamp,
    data: {
      startedAt,
      formatVersion: 1,
      remoteVerified: false,
      publicId: '',
      bytes: 0,
      sha256: '',
      collectionCount: 0,
      documentCount: 0,
      error: '',
    },
  });

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

    await verifyRemoteArtifact(String(upload.secure_url || ''), sha256, stat.size);

    const completedAt = new Date();
    await SmbRecord.updateOne(
      { _id: snapshot._id, kind: STORAGE_KIND },
      {
        $set: {
          status: 'success',
          completedAt,
          'data.publicId': String(upload.public_id || ''),
          'data.secureUrl': String(upload.secure_url || ''),
          'data.bytes': Number(stat.size || upload.bytes || 0),
          'data.sha256': sha256,
          'data.collectionCount': counters.collections,
          'data.documentCount': counters.documents,
          'data.error': '',
          'data.remoteVerified': true,
        },
      }
    );

    const pruned = await pruneOldBackups();
    logger.info(
      `[backup] Encrypted off-host backup complete: ${counters.collections} collections, ${counters.documents} documents, ${stat.size} bytes, remote SHA-256 verified, pruned ${pruned}`
    );

    return {
      ran: true,
      publicId: String(upload.public_id || ''),
      bytes: stat.size,
      sha256,
      collectionCount: counters.collections,
      documentCount: counters.documents,
      remoteVerified: true,
      pruned,
    };
  } catch (error: any) {
    await SmbRecord.updateOne(
      { _id: snapshot._id, kind: STORAGE_KIND },
      {
        $set: {
          status: 'failed',
          completedAt: new Date(),
          'data.error': String(error?.message || error).slice(0, 2000),
          'data.collectionCount': counters.collections,
          'data.documentCount': counters.documents,
          'data.remoteVerified': false,
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
