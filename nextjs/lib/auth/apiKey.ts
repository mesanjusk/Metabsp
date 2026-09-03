import { NextRequest } from 'next/server';
import { connectDB } from '../db/mongo';
import ApiKey, { hashApiKey } from '../models/ApiKey';
import User from '../models/User';
import AppError from '../utils/AppError';

export interface ApiKeyPrincipal {
  userId: string;
  tenantId: string | null;
  apiKeyId: string;
}

/**
 * Authenticates a machine-to-machine request by API key, the /api/v1
 * equivalent of requireAuth's bearer JWT.
 *
 * Accepts either `Authorization: Bearer <key>` or the legacy `X-Api-Key`
 * header. It deliberately does NOT read the key from a query string, which
 * the Express version allowed: query strings end up in access logs, proxy
 * logs and browser history, so a key passed that way should be treated as
 * disclosed.
 */
export async function requireApiKey(req: NextRequest): Promise<ApiKeyPrincipal> {
  const headerKey = req.headers.get('x-api-key') || '';
  const bearer = String(req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const rawKey = (headerKey || bearer).trim();

  if (!rawKey) {
    throw new AppError('Missing API key. Send it as "Authorization: Bearer <key>" or "X-Api-Key".', 401);
  }

  // Connecting only after a key is present, so an unauthenticated caller gets
  // a 401 whatever the database is doing — rather than a 503 that tells them
  // the datastore is down before they have proved they may ask anything.
  await connectDB();

  // Hashed lookup is the normal path; the plaintext fallback exists only for
  // keys issued before hashing (see lib/models/ApiKey.ts) and upgrades them
  // in place on first use, so the window closes by itself.
  let record: any = await ApiKey.findOne({ keyHash: hashApiKey(rawKey), isActive: true });

  if (!record) {
    const legacy: any = await ApiKey.findOne({ key: rawKey, isActive: true });
    if (legacy) {
      legacy.keyHash = hashApiKey(rawKey);
      legacy.keyPrefix = rawKey.slice(0, 12);
      legacy.key = undefined;
      await legacy.save().catch(() => {});
      record = legacy;
    }
  }

  if (!record) throw new AppError('Invalid or revoked API key', 401);

  // Resolve the owner so downstream tenant gates behave the same as on the
  // JWT path. A lookup problem here means "no tenant", never a failed request.
  let tenantId: string | null = null;
  try {
    const owner: any = await User.findById(record.userId).select('tenantId isActive').lean();
    // A key whose owner no longer exists must not authenticate. `owner` being
    // null used to fall straight through this block to `tenantId = null` and
    // return a valid principal, so deleting a user left their API key working
    // — and loadActiveWhatsAppAccountForUser resolves accounts through
    // teamMemberIds, so a deleted member could keep sending on somebody else's
    // connected number. Revoking keys at the point of deletion is necessary
    // and not sufficient: this is the check that holds however the user went.
    if (!owner) throw new AppError('API key owner no longer exists', 401);
    if (owner.isActive === false) throw new AppError('Account is inactive', 403);
    tenantId = owner.tenantId || null;
  } catch (error) {
    if (error instanceof AppError) throw error;
    tenantId = null;
  }

  // Non-blocking last-used stamp: useful for spotting an unused key, never
  // worth failing a customer's send over.
  ApiKey.updateOne({ _id: record._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});

  return { userId: String(record.userId), tenantId, apiKeyId: String(record._id) };
}
