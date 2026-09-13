import { Queue, type JobsOptions } from "bullmq";
import { getRedisConnection } from "./connection";
import type { JobType } from "@/lib/video/modules/jobs/models/Job";

const queues = new Map<JobType, Queue>();

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: { age: 60 * 60 * 24 * 7 }, // 7 days
  removeOnFail: { age: 60 * 60 * 24 * 30 }, // 30 days
};

/**
 * Job types whose retries are owned by something else, so BullMQ must not add its own.
 *
 * `browser_task` drives a multi-step browser session whose engine already retries per step,
 * classifying each failure as transient / permanent / auth / needs-a-human and only retrying the
 * first. A whole-job retry on top of that would re-run every step that already succeeded — logging
 * in again, re-submitting a form, re-downloading a file — which is both wasteful and, for anything
 * non-idempotent, wrong.
 *
 * Every other job type keeps the 3-attempt exponential backoff the studio has always used: a
 * single-shot image or voice generation has nothing internal to retry, so the queue is the right
 * place for it.
 */
const ENGINE_RETRIES_ITSELF: Partial<Record<JobType, JobsOptions>> = {
  browser_task: { ...DEFAULT_JOB_OPTIONS, attempts: 1 },
};

const OVERRIDES: Partial<Record<JobType, JobsOptions>> = { ...ENGINE_RETRIES_ITSELF };

/** One BullMQ Queue per job type — lazily created and cached (module scope survives warm invocations). */
export function getQueue(type: JobType): Queue {
  let queue = queues.get(type);
  if (!queue) {
    queue = new Queue(type, {
      connection: getRedisConnection(),
      defaultJobOptions: OVERRIDES[type] ?? DEFAULT_JOB_OPTIONS,
    });
    queues.set(type, queue);
  }
  return queue;
}

/** Test-only: exposes the resolved options so the retry policy is assertable without Redis. */
export function __jobOptionsFor(type: JobType): JobsOptions {
  return OVERRIDES[type] ?? DEFAULT_JOB_OPTIONS;
}
