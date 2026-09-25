import { Worker } from 'bullmq';
import { getRedisConnection } from '../db/redis';
import { connectDB } from '../db/mongo';
import logger from '../utils/logger';
import { runLeadFinderSearch } from '../leadFinder/scraperClient';
import { LEAD_FINDER_QUEUE_NAME } from './leadFinderQueue';

export function startLeadFinderWorker() {
  const worker = new Worker(
    LEAD_FINDER_QUEUE_NAME,
    async (job) => {
      await connectDB();
      return runLeadFinderSearch(String(job.data?.searchJobId || ''));
    },
    { connection: getRedisConnection() as any, concurrency: 1 }
  );
  worker.on('failed', (job, error) => logger.warn(`[lead-finder] Job ${job?.id} failed: ${error.message}`));
  worker.on('error', (error) => logger.error('[lead-finder] Worker error:', error.message));
  logger.info('[lead-finder] Worker started (concurrency 1)');
  return worker;
}
