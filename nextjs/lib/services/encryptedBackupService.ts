import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import mongoose from 'mongoose';
import { connectDB } from '../db/mongo';
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
      return item.type === 'collection' && name && !name.startsWith('system.') && name !== 'backupsnapshots';
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

async function cloudBackupResources({ maxResults = 100 } = {}) {
  assertCloudinaryConfigured();
  const result: any = await (cloudinary as any).api.resources({
    resource_type: 'raw',
    type: 'upload',
    prefix: `${BACKUP_FOLDER}/verified-`,
    max_results: Math.max(1, Math.min(100, maxResults)),
    direction: 'desc',
  });
  return (Array.isArray(result?.resources) ? result.resources : [])
    .slice()
    .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
}

export async function listVerifiedBackups({ limit = 20 } = {}) {
  const resources: any[] = await cloudBackupResources({ maxResults: Math.max(limit, 30) });
  return resources.slice(0, limit).map((item: any) => ({
    publicId: String(item.public_id || ''),
    createdAt: item.created_at ? new Date(item.created_at).toISOString() : null,
    bytes: Number(item.bytes || 0),
    secureUrl: String(item.secure_url || ''),
    format: String(item.format || ''),
    remoteVerified: true,
  }));
}

async function pruneOldBackups() {
  const retentionDays = Math.max(7, Number(process.env.BACKUP_RETENTION_DAYS || 30));
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const resources: any[] = await cloudBackupResources({ maxResults: 100 });
  const old = resources.filter((item: any) => new Date(item.created_at || 0).getTime() < cutoffMs);

  let removed = 0;
  for (const item of old) {
    try {
      await (cloudinary as any).uploader.destroy(String(item.public_id || ''), {
        resource_type: 'raw',
        invalidate: true,
      });
      removed += 1;
    } catch (error: any) {
      logger.warn(`[backup] Could not prune ${item.public_id}: ${error?.message || error}`);
    }
  }
  return removed;
}

export async function hasRecentSuccessfulBackup({
  maxAgeHours = Number(process.env.BACKUP_MAX_AGE_HOURS || 26),
} = {}) {
  const latest = (await listVerifiedBackups({ limit: 1 }))[0] || null;
  const completedAt = latest?.createdAt ? new Date(latest.createdAt) : null;
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

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = path.join(os.tmpdir(), `skdigital-backup-${timestamp}-${process.pid}`);
  const gzipPath = `${base}.jsonl.gz`;
  const encryptedPath = `${base}.skdb`;
  const counters = { collections: 0, documents: 0 };
  let pendingRemotePublicId = '';

  try {
    await pipeline(
      Readable.from(backupLines(db, counters)),
      createGzip({ level: 9 }),
      fs.createWriteStream(gzipPath)
    );

    await encryptFile(gzipPath, encryptedPath, key);
    const stat = await fs.promises.stat(encryptedPath);
    const sha256 = await fileSha256(encryptedPath);
    const pendingPublicId = `pending-${timestamp}`;
    const verifiedPublicId = `${BACKUP_FOLDER}/verified-${timestamp}`;

    const upload: any = await (cloudinary as any).uploader.upload(encryptedPath, {
      resource_type: 'raw',
      folder: BACKUP_FOLDER,
      public_id: pendingPublicId,
      overwrite: false,
    });

    const uploadedPublicId = String(upload.public_id || '');
    pendingRemotePublicId = uploadedPublicId;
    await verifyRemoteArtifact(String(upload.secure_url || ''), sha256, stat.size);

    // Only a remotely downloaded + SHA/byte verified artifact is renamed into
    // the "verified-" namespace. Health/admin status reads only that namespace,
    // so an interrupted/partial upload can never masquerade as a valid backup.
    const renamed: any = await (cloudinary as any).uploader.rename(
      uploadedPublicId,
      verifiedPublicId,
      { resource_type: 'raw', overwrite: false }
    );

    pendingRemotePublicId = '';
    const pruned = await pruneOldBackups();
    logger.info(
      `[backup] Encrypted off-host backup complete: ${counters.collections} collections, ${counters.documents} documents, ${stat.size} bytes, pruned ${pruned}`
    );

    return {
      ran: true,
      publicId: String(renamed?.public_id || verifiedPublicId),
      bytes: Number(renamed?.bytes || stat.size),
      sha256,
      collectionCount: counters.collections,
      documentCount: counters.documents,
      pruned,
    };
  } catch (error: any) {
    if (pendingRemotePublicId) {
      await (cloudinary as any).uploader.destroy(pendingRemotePublicId, {
        resource_type: 'raw',
        invalidate: true,
      }).catch(() => undefined);
    }
    // Failure is intentionally not written to Mongo: this deployment is
    // already at the Atlas collection cap. Logs are the failure record, while
    // the Cloudinary "verified-" namespace is the durable success ledger.
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
