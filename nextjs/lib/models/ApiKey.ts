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
 * `key` is retained, no longer required, purely so keys issued before this
 * change keep working: verification falls back to a plaintext match when the
 * hash lookup misses (see lib/auth/apiKey.ts), and rewrites the row to the
 * hashed form on first use. Once no `key` values remain, the field and the
 * fallback can both go.
 *
 * A plain SHA-256 is the right primitive here, unlike for a password: the
 * secret is 224 bits of CSPRNG output, so there is no dictionary to attack and
 * nothing for a slow KDF to buy — and this runs on every API request.
 */
const apiKeySchema = new Schema(
  {
    // Legacy plaintext key. Sparse so the unique index tolerates the many
    // rows that will (correctly) never have one.
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

apiKeySchema.statics.generate = async function generate(userId: string, name = 'Default') {
  const rawKey = 'mbsp_' + crypto.randomBytes(28).toString('hex');
  const doc = await this.create({
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
