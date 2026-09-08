import mongoose, { Schema } from 'mongoose';
import crypto from 'crypto';

/**
 * Customer API keys for the machine-to-machine API (/api/v1/*).
 *
 * Keys are stored as a SHA-256 hash, not in plaintext. The secret is returned
 * exactly once, at creation; after that the platform can only ever show the
 * `keyPrefix` — enough to tell two keys apart in a list, useless to an
 * attacker. A database dump therefore no longer hands over every customer's
 * live sending credential.
 *
 * Historical production databases have a UNIQUE, NON-SPARSE `key_1` index
 * created by the old schema where `key` was required. `connectDB()` runs with
 * `autoIndex: false`, so changing this schema to `sparse: true` did not rewrite
 * that already-existing MongoDB index. Creating a hashed key without a `key`
 * value therefore collides on `{ key: null }` as soon as another hashed row
 * exists anywhere in the collection.
 *
 * To remain compatible with that deployed index without storing the API secret
 * in plaintext, every hashed row gets a unique RETIRED marker in `key`. The
 * authentication path explicitly refuses these markers as legacy plaintext
 * credentials. Old real plaintext keys still upgrade on first use, but their
 * `key` value is replaced by a retired marker instead of being unset, so that
 * upgrade also works before the old index is migrated.
 */
const RETIRED_KEY_PREFIX = '__mbsp_hashed__:';
const API_KEY_PREFIX = 'mbsp_';

const apiKeySchema = new Schema(
  {
    // Legacy plaintext key OR a non-authenticating retired marker for hashed
    // rows. `sparse: true` is correct for fresh databases; the marker keeps us
    // compatible with older databases whose existing key_1 index is not sparse.
    key: { type: String, default: undefined, unique: true, sparse: true, index: true },
    keyHash: { type: String, default: undefined, unique: true, sparse: true, index: true },
    keyPrefix: { type: String, default: '' },
    userId: { type: String, required: true, index: true },
    name: { type: String, default: 'Default', trim: true },
    isActive: { type: Boolean, default: true, index: true },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(String(rawKey)).digest('hex');
}

export function makeRetiredApiKeyMarker(): string {
  return RETIRED_KEY_PREFIX + crypto.randomBytes(20).toString('hex');
}

export function isLegacyPlaintextApiKeyCandidate(rawKey: string): boolean {
  // Every key ever issued by this product used mbsp_. Retired markers use a
  // deliberately different prefix, so a database dump cannot authenticate by
  // replaying the compatibility value stored in `key`.
  return String(rawKey || '').startsWith(API_KEY_PREFIX);
}

apiKeySchema.statics.generate = async function generate(userId: string, name = 'Default') {
  const rawKey = API_KEY_PREFIX + crypto.randomBytes(28).toString('hex');
  const doc = await this.create({
    // Required for compatibility with the historical non-sparse key_1 index;
    // this value is NOT a credential and is never accepted by requireApiKey.
    key: makeRetiredApiKeyMarker(),
    keyHash: hashApiKey(rawKey),
    // Long enough to be recognisable in a list, far too short to guess from.
    keyPrefix: rawKey.slice(0, 12),
    userId,
    name,
  });
  // The only moment the plaintext exists. Callers must surface it now or lose it.
  return { doc, rawKey };
};

export const ApiKey = (mongoose.models.ApiKey as any) || mongoose.model('ApiKey', apiKeySchema);
export default ApiKey;
