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
/**
 * Is Redis reachable at all — asked with PING, which no provider blocks.
 *
 * The policy check below cannot answer this, and reading it as though it could
 * is how a healthy Redis got reported as an outage for hours. Render, Upstash
 * and ElastiCache all hide CONFIG; when a provider hides it by not answering
 * rather than by refusing, `redis.config('GET', …)` never settles — ioredis is
 * built here with maxRetriesPerRequest:null and the offline queue on, so the
 * command is buffered, not rejected. The timeout that follows is
 * indistinguishable from an unreachable instance, and the boot log said
 * "check REDIS_URL" about a URL that was correct.
 *
 * PING separates the two: it answers on any reachable instance, so a PONG
 * followed by a CONFIG timeout means the provider is hiding CONFIG, and only a
 * PING that never comes back is an outage.
 */
export async function checkRedisReachable(): Promise<{ reachable: boolean; reason?: string }> {
  try {
    const redis: any = getRedisConnection();
    const pong = await redis.ping();
    if (String(pong || '').toUpperCase() === 'PONG') return { reachable: true };
    return { reachable: false, reason: `PING answered ${JSON.stringify(pong)}` };
  } catch (error: any) {
    return { reachable: false, reason: error?.message || 'no message' };
  }
}

export async function checkRedisEvictionPolicy(): Promise<{
  ok: boolean;
  policy?: string;
  reason?: string;
  unverified?: boolean;
  blocked?: boolean;
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
    // A managed instance refusing CONFIG GET is not a fault and never becomes
    // one: no restart, redeploy or code change will ever make the command
    // succeed. Render, Upstash and ElastiCache all block it. Distinguishing
    // that from any other error is what lets the caller stop crying wolf at
    // every boot about a condition nobody can act on twice.
    if (isCommandBlocked(error)) {
      return { ok: true, unverified: true, blocked: true, reason: error.message };
    }
    return { ok: true, unverified: true, reason: `Could not read the policy: ${error.message}` };
  }
}

/**
 * Does this error mean "the provider will not run that command", as opposed to
 * "something is wrong"? Redis answers a forbidden or absent command with a
 * NOPERM or unknown-command error rather than a connection failure, and every
 * managed provider that hides CONFIG uses one of those shapes.
 */
function isCommandBlocked(error: any): boolean {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('noperm') ||
    message.includes('unknown command') ||
    message.includes('not allowed') ||
    message.includes('disabled')
  );
}

type RedisPolicyResult = Awaited<ReturnType<typeof checkRedisEvictionPolicy>> & { unreachable?: boolean };

/**
 * ioredis answers an unreachable instance by retrying forever rather than
 * rejecting, so `redis.config('GET', …)` against one never settles at all —
 * `checkRedisEvictionPolicy`'s own catch never runs because nothing is ever
 * thrown.
 *
 * That is why this bound exists. The two checks used to be awaited through a
 * single `Promise.all`, and one promise that never settles blocks the whole
 * thing: pointing a deployment at a Redis URL that does not resolve silenced
 * the *token* result too. Losing the encryption-key line to an unrelated Redis
 * outage is the worst possible time to lose it — a wrong `REDIS_URL` and a
 * wrong `WHATSAPP_TOKEN_ENCRYPTION_KEY` are the two mistakes a migration makes
 * together, and only one of them announces itself.
 *
 * Observed exactly that way on a fresh deployment: ENOTFOUND on the previous
 * account's Redis host, in a retry loop, and no self-check output whatsoever.
 */
const REDIS_CHECK_TIMEOUT_MS = 5_000;

function withTimeout<T>(work: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(onTimeout()), ms);
    const settle = (value: T) => {
      clearTimeout(timer);
      resolve(value);
    };
    work.then(settle, () => settle(onTimeout()));
  });
}

async function reportTokenDecryptability(): Promise<void> {
  const tokens = await checkTokenDecryptability().catch((error: any) => ({
    ok: true as const,
    checked: 0,
    reason: `Check failed: ${error.message}`,
  }));

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
}

async function reportRedisEvictionPolicy(): Promise<void> {
  // PING first. Everything below this line is about the eviction policy, and
  // none of it can tell a blocked command from a dead instance — see
  // checkRedisReachable.
  const reachable = await withTimeout(
    checkRedisReachable(),
    REDIS_CHECK_TIMEOUT_MS,
    () => ({ reachable: false, reason: `PING got no answer within ${REDIS_CHECK_TIMEOUT_MS}ms` })
  );

  if (!reachable.reachable) {
    logger.warn(
      `[self-check] Redis did not answer PING (${reachable.reason || 'no reason given'}). ` +
        'While that holds, inbound webhooks fall back to inline processing and queued sends do not drain. ' +
        'Check REDIS_URL and that the instance is running — this is not about the eviction policy.'
    );
    return;
  }

  const redis = await withTimeout<RedisPolicyResult>(
    checkRedisEvictionPolicy(),
    REDIS_CHECK_TIMEOUT_MS,
    // PING already answered, so a CONFIG that does not is the provider hiding
    // it silently rather than refusing it with an error — same situation as
    // the NOPERM reply, and reported the same way.
    () => ({ ok: true, unverified: true, blocked: true, reason: 'CONFIG GET got no answer' })
  );

  if (!redis.ok) {
    logger.error(
      `[self-check] Redis maxmemory-policy is "${redis.policy}", not "noeviction". ` +
        'Queued inbound webhooks and outbound sends can be evicted under memory pressure — ' +
        'that is silent customer message loss. Change it in your Redis provider.'
    );
    return;
  }

  if (redis.blocked) {
    // Info, not warn: permanent, expected on every managed provider, and
    // actionable exactly once. Repeating it as a warning at every boot trains
    // an operator to skim past the self-check output entirely, which is the
    // opposite of what these checks are for.
    logger.info(
      '[self-check] Redis eviction policy cannot be read — this managed provider blocks CONFIG GET, which is normal. ' +
        'Confirm once in the provider dashboard that maxmemory-policy is "noeviction".'
    );
    return;
  }

  if (redis.unverified) {
    logger.warn(
      '[self-check] Could not verify the Redis eviction policy. ' +
        'Confirm in the provider dashboard that maxmemory-policy is "noeviction": any other value ' +
        'lets queued inbound webhooks and outbound sends be discarded under memory pressure. ' +
        `(${redis.reason})`
    );
    return;
  }

  logger.info('[self-check] Redis eviction policy is noeviction');
}

/**
 * Runs both checks and logs loudly. Deliberately never throws: a platform that
 * refuses to boot over a misconfiguration is worse than one that boots and
 * says exactly what is wrong, because the second one still serves the pages an
 * operator needs in order to fix it.
 *
 * The two run concurrently but report independently — `allSettled` over one
 * self-contained reporter each — so neither check can suppress the other's
 * finding. They diagnose unrelated things and are worth exactly as much
 * separately as together.
 */
export async function runBootSelfCheck(): Promise<void> {
  await Promise.allSettled([reportTokenDecryptability(), reportRedisEvictionPolicy()]);
}
