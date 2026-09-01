import { connectDB } from '../db/mongo';
import { getRedisConnection } from '../db/redis';
import WhatsAppAccount from '../models/WhatsAppAccount';
import { decryptSensitiveValue } from '../utils/crypto';
import logger from '../utils/logger';

/**
 * Two conditions that break the platform completely while looking perfectly
 * healthy from the outside. Both are checked once at boot, because neither
 * produces an error anyone would otherwise see until customers start
 * complaining days later.
 */

/**
 * Can the configured encryption key actually read the tokens in this database?
 *
 * `WHATSAPP_TOKEN_ENCRYPTION_KEY` protects every connected customer's Meta
 * access token. Point a deployment at an existing database with the wrong key
 * and nothing fails at startup: the app boots, the dashboard loads, the
 * webhook answers — and every single send fails, one customer at a time, with
 * an error that looks like a Meta problem rather than a configuration one.
 *
 * The fix when this fires is not to change the current key. It is to put the
 * OLD key into `WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS`, which the decrypt
 * path already falls back to.
 */
export async function checkTokenDecryptability(): Promise<{
  ok: boolean;
  checked: number;
  reason?: string;
}> {
  await connectDB();

  const accounts: any[] = await WhatsAppAccount.find({
    accessTokenEncrypted: { $exists: true, $nin: ['', null] },
  })
    .select('_id accessTokenEncrypted')
    .limit(5)
    .lean();

  if (!accounts.length) {
    return { ok: true, checked: 0, reason: 'No connected accounts to sample' };
  }

  // A sample, not a full scan: if the key is wrong it is wrong for everything,
  // and decrypting every token at every boot is pointless work.
  let decrypted = 0;
  let lastError = '';

  for (const account of accounts) {
    try {
      decryptSensitiveValue(account.accessTokenEncrypted);
      decrypted += 1;
    } catch (error: any) {
      lastError = error.message;
    }
  }

  if (decrypted > 0) return { ok: true, checked: accounts.length };

  return {
    ok: false,
    checked: accounts.length,
    reason: lastError || 'Every sampled token failed to decrypt',
  };
}

/**
 * Will Redis quietly throw away queued work?
 *
 * Inbound WhatsApp events and outbound sends both live in Redis between being
 * accepted and being processed. Under `allkeys-lru` — a common default, and
 * what a cache-shaped instance ships with — Redis evicts keys when it fills
 * up, which here means silently discarding customer messages the platform has
 * already told Meta it received. `noeviction` makes a full Redis refuse new
 * writes instead, which surfaces as an error someone can act on.
 */
export async function checkRedisEvictionPolicy(): Promise<{
  ok: boolean;
  policy?: string;
  reason?: string;
  unverified?: boolean;
}> {
  try {
    const redis: any = getRedisConnection();
    const config = await redis.config('GET', 'maxmemory-policy');
    // ioredis returns a flat [name, value] array.
    const policy = Array.isArray(config) ? String(config[1] || '') : '';

    if (!policy) return { ok: true, unverified: true, reason: 'Policy not reported by this Redis' };
    if (policy === 'noeviction') return { ok: true, policy };

    return { ok: false, policy };
  } catch (error: any) {
    // Managed Redis commonly blocks CONFIG GET — Render does. That is not a
    // failure, but it must not be reported as a pass either: it means the
    // single property protecting queued customer messages from being thrown
    // away is unverified. Callers surface this as a warning naming the
    // dashboard, rather than silence.
    return { ok: true, unverified: true, reason: `Could not read the policy: ${error.message}` };
  }
}

/**
 * Runs both checks and logs loudly. Deliberately never throws: a platform that
 * refuses to boot over a misconfiguration is worse than one that boots and
 * says exactly what is wrong, because the second one still serves the pages an
 * operator needs in order to fix it.
 */
export async function runBootSelfCheck(): Promise<void> {
  const [tokens, redis] = await Promise.all([
    checkTokenDecryptability().catch((error: any) => ({
      ok: true as const,
      checked: 0,
      reason: `Check failed: ${error.message}`,
    })),
    checkRedisEvictionPolicy(),
  ]);

  if (!tokens.ok) {
    logger.error(
      '[self-check] CRITICAL: WHATSAPP_TOKEN_ENCRYPTION_KEY cannot decrypt the stored access tokens ' +
        `(sampled ${tokens.checked}). Every connected number will fail to send. ` +
        'Set the PREVIOUS key in WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS — do not change the current one, ' +
        'and do not reconnect accounts until this is resolved. ' +
        `Underlying error: ${tokens.reason}`
    );
  } else if (tokens.checked > 0) {
    logger.info(`[self-check] Token encryption key verified against ${tokens.checked} stored account(s)`);
  } else {
    logger.info(`[self-check] Token encryption key not verified — ${tokens.reason}`);
  }

  if (!redis.ok) {
    logger.error(
      `[self-check] Redis maxmemory-policy is "${redis.policy}", not "noeviction". ` +
        'Queued inbound webhooks and outbound sends can be evicted under memory pressure — ' +
        'that is silent customer message loss. Change it in your Redis provider.'
    );
  } else if (redis.unverified) {
    logger.warn(
      '[self-check] Could not verify the Redis eviction policy — this provider blocks the check. ' +
        'Confirm in the provider dashboard that maxmemory-policy is "noeviction": any other value ' +
        'lets queued inbound webhooks and outbound sends be discarded under memory pressure. ' +
        `(${redis.reason})`
    );
  } else {
    logger.info('[self-check] Redis eviction policy is noeviction');
  }
}
