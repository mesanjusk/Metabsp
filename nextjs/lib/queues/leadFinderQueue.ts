import { Queue } from 'bullmq';
import { getRedisConnection } from '../db/redis';

export const LEAD_FINDER_QUEUE_NAME = 'lead-finder-search';
let queue: Queue | null = null;

export function getLeadFinderQueue() {
  if (!queue) queue = new Queue(LEAD_FINDER_QUEUE_NAME, {
    connection: getRedisConnection() as any,
    defaultJobOptions: { attempts: 2, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: { age: 86400, count: 500 }, removeOnFail: { count: 1000 } },
  });
  return queue;
}
export async function enqueueLeadSearch(searchJobId: string) {
  return getLeadFinderQueue().add('search', { searchJobId }, { jobId: searchJobId });
}
