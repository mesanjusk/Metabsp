import { getRedisConnection } from '@/lib/db/redis';

const SETUP_CODE_KEY = 'metabsp:lead-finder:agent:setup-code-hash';
const AUTH_HASH_KEY = 'metabsp:lead-finder:agent:auth-token-hash';
const HEARTBEAT_KEY = 'metabsp:lead-finder:agent:heartbeat';

export type LeadFinderAgentHeartbeat = {
  hostname: string;
  version: string;
  lastSeenAt: string;
};

export async function setLeadFinderSetupCodeHash(hash: string, ttlSeconds = 15 * 60) {
  const redis = getRedisConnection();
  await redis.set(SETUP_CODE_KEY, hash, 'EX', ttlSeconds);
}

export async function consumeLeadFinderSetupCodeHash(hash: string) {
  const redis = getRedisConnection();
  const current = await redis.get(SETUP_CODE_KEY);
  if (!current || current !== hash) return false;
  await redis.del(SETUP_CODE_KEY);
  return true;
}

export async function setLeadFinderAgentAuthHash(hash: string) {
  const redis = getRedisConnection();
  await redis.set(AUTH_HASH_KEY, hash);
}

export async function getLeadFinderAgentAuthHash() {
  const redis = getRedisConnection();
  return redis.get(AUTH_HASH_KEY);
}

export async function setLeadFinderAgentHeartbeat(hostname: string, version: string) {
  const redis = getRedisConnection();
  const heartbeat: LeadFinderAgentHeartbeat = {
    hostname: String(hostname || '').slice(0, 200),
    version: String(version || '').slice(0, 50),
    lastSeenAt: new Date().toISOString(),
  };
  await redis.set(HEARTBEAT_KEY, JSON.stringify(heartbeat), 'EX', 75);
  return heartbeat;
}

export async function getLeadFinderAgentHeartbeat(): Promise<LeadFinderAgentHeartbeat | null> {
  const redis = getRedisConnection();
  const raw = await redis.get(HEARTBEAT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      hostname: String(parsed?.hostname || ''),
      version: String(parsed?.version || ''),
      lastSeenAt: String(parsed?.lastSeenAt || ''),
    };
  } catch {
    return null;
  }
}
