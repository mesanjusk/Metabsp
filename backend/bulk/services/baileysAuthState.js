/**
 * MongoDB-backed Baileys auth state — per-user/tenant.
 *
 * Each user's credentials are stored with a userId-scoped key prefix so
 * multiple tenants can each maintain their own Baileys session independently.
 * The default userId '_global_' preserves backward compatibility with the
 * bulk-app callers that do not pass a userId.
 *
 * IMPORTANT: Signal protocol keys must be stored as plain JS objects / Buffers —
 * NOT proto instances. Wrapping them in proto.X.fromObject() breaks the Noise
 * handshake and causes "couldn't link device" errors on every scan.
 */

const BaileysAuthState = require('../models/BaileysAuthState');

const DEFAULT_USER = '_global_';

// Per-user in-memory write-through caches so key lookups during QR handshake
// (which are synchronous bursts) never lag on DB round-trips.
const memCaches = new Map(); // userId -> Map<dataKey, value>

function getCache(userId) {
  if (!memCaches.has(userId)) memCaches.set(userId, new Map());
  return memCaches.get(userId);
}

function credsKey(userId)   { return `baileys_creds_${userId}`; }
function keyPrefix(userId)  { return `baileys_key_${userId}_`; }

// ── low-level DB helpers ──────────────────────────────────────────────────────

async function dbRead(userId, key) {
  const cache = getCache(userId);
  if (cache.has(key)) return cache.get(key);
  const doc = await BaileysAuthState.findOne({ dataKey: key }).lean();
  const val = doc ? doc.dataValue : null;
  if (val !== null) cache.set(key, val);
  return val;
}

async function dbWrite(userId, key, value) {
  const cache = getCache(userId);
  cache.set(key, value);
  await BaileysAuthState.findOneAndUpdate(
    { dataKey: key },
    { $set: { dataValue: value } },
    { upsert: true }
  );
}

async function dbDelete(userId, key) {
  const cache = getCache(userId);
  cache.delete(key);
  await BaileysAuthState.deleteOne({ dataKey: key });
}

// ── main export ───────────────────────────────────────────────────────────────

async function useMongoAuthState(userId = DEFAULT_USER) {
  const { initAuthCreds, BufferJSON } = await import('@whiskeysockets/baileys');

  const CREDS_KEY  = credsKey(userId);
  const KEY_PREFIX = keyPrefix(userId);

  let rawCreds = await dbRead(userId, CREDS_KEY);
  let creds;

  if (!rawCreds) {
    creds = initAuthCreds();
    await dbWrite(userId, CREDS_KEY, JSON.parse(JSON.stringify(creds, BufferJSON.replacer)));
  } else {
    creds = JSON.parse(JSON.stringify(rawCreds), BufferJSON.reviver);
  }

  const keys = {
    get: async (type, ids) => {
      const result = {};
      await Promise.all(
        ids.map(async (id) => {
          const dbKey = `${KEY_PREFIX}${type}_${id}`;
          const raw   = await dbRead(userId, dbKey);
          if (raw == null) return;
          result[id] = JSON.parse(JSON.stringify(raw), BufferJSON.reviver);
        })
      );
      return result;
    },

    set: async (data) => {
      const writes = [];
      for (const [type, idMap] of Object.entries(data)) {
        for (const [id, value] of Object.entries(idMap ?? {})) {
          const dbKey = `${KEY_PREFIX}${type}_${id}`;
          if (value != null) {
            writes.push(
              dbWrite(userId, dbKey, JSON.parse(JSON.stringify(value, BufferJSON.replacer)))
            );
          } else {
            writes.push(dbDelete(userId, dbKey));
          }
        }
      }
      await Promise.all(writes);
    },
  };

  const saveCreds = async () => {
    await dbWrite(userId, CREDS_KEY, JSON.parse(JSON.stringify(creds, BufferJSON.replacer)));
  };

  return { state: { creds, keys }, saveCreds };
}

async function clearMongoAuthState(userId = DEFAULT_USER) {
  if (memCaches.has(userId)) memCaches.delete(userId);
  const CREDS_KEY  = credsKey(userId);
  const KEY_PREFIX = keyPrefix(userId);
  await BaileysAuthState.deleteMany({ dataKey: CREDS_KEY });
  await BaileysAuthState.deleteMany({ dataKey: { $regex: `^${KEY_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` } });
}

// Returns all userIds that have saved Baileys credentials in the DB.
async function listSavedUserIds() {
  const docs = await BaileysAuthState.find(
    { dataKey: { $regex: '^baileys_creds_' } },
    'dataKey'
  ).lean();
  return docs.map(d => d.dataKey.slice('baileys_creds_'.length));
}

module.exports = { useMongoAuthState, clearMongoAuthState, listSavedUserIds };
