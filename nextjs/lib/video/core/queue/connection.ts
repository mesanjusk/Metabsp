import type IORedis from "ioredis";
import { getRedisConnection as hostRedis } from "@/lib/db/redis";

/**
 * One Redis connection for the whole application, for the same reason as the database above.
 *
 * Metabsp already holds one (`lib/db/redis.ts`) and its BullMQ queues, Socket.IO adapter and
 * schedulers all share it. The studio's own connector read `REDIS_URL` into a second client with
 * its own retry policy — a second connection to the same server, with different settings, competing
 * for the same connection allowance on a plan that has one.
 *
 * `closeRedisConnection` is intentionally a no-op. In the studio's repository it existed for
 * `worker.ts` to shut its own process down cleanly; here the connection belongs to the host, which
 * outlives any one queue, and closing it from a ported module would take Socket.IO and every other
 * queue down with it.
 */
export function getRedisConnection(): IORedis {
  return hostRedis() as IORedis;
}

export async function closeRedisConnection(): Promise<void> {
  // Deliberately nothing — see above.
}
