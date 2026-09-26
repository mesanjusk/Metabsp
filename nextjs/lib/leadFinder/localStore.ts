import crypto from 'node:crypto';
import { getRedisConnection } from '@/lib/db/redis';

const JOB_TTL_SECONDS = 7 * 24 * 60 * 60;
const USER_JOB_LIMIT = 50;
const JOB_PREFIX = 'metabsp:lead-finder:runtime:job:';
const LEADS_PREFIX = 'metabsp:lead-finder:runtime:leads:';
const USER_JOBS_PREFIX = 'metabsp:lead-finder:runtime:user-jobs:';
const QUEUE_KEY = 'metabsp:lead-finder:runtime:queue';
const RUNNING_KEY = 'metabsp:lead-finder:runtime:running';

export type LocalLeadSearchJob = {
  _id: string;
  userId: string;
  tenantId: string | null;
  businessType: string;
  location: string;
  query: string;
  requestedLimit: number;
  depth: number;
  emailEnabled: boolean;
  socialEnabled: boolean;
  status: 'queued' | 'running' | 'completed' | 'failed';
  totalFound: number;
  error: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type LocalProspectLead = {
  _id: string;
  userId: string;
  tenantId: string | null;
  searchJobId: string;
  sourceKey: string;
  googlePlaceId: string;
  name: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  category: string;
  rating: number | null;
  reviewCount: number;
  latitude: number | null;
  longitude: number | null;
  instagram: string;
  facebook: string;
  linkedin: string;
  source: 'google_maps';
  status: 'new' | 'converted';
  contactId?: string;
  createdAt: string;
  updatedAt: string;
};

function jobKey(id: string) { return `${JOB_PREFIX}${id}`; }
function leadsKey(id: string) { return `${LEADS_PREFIX}${id}`; }
function userJobsKey(userId: string) { return `${USER_JOBS_PREFIX}${userId}`; }

export async function createLocalLeadSearchJob(input: Omit<LocalLeadSearchJob, '_id' | 'status' | 'totalFound' | 'error' | 'createdAt' | 'updatedAt' | 'startedAt' | 'completedAt'>) {
  const redis = getRedisConnection();
  const now = new Date().toISOString();
  const job: LocalLeadSearchJob = {
    ...input,
    _id: crypto.randomBytes(12).toString('hex'),
    status: 'queued',
    totalFound: 0,
    error: '',
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
  };
  await redis.set(jobKey(job._id), JSON.stringify(job), 'EX', JOB_TTL_SECONDS);
  await redis.zadd(userJobsKey(job.userId), Date.now(), job._id);
  await redis.expire(userJobsKey(job.userId), JOB_TTL_SECONDS);
  await redis.rpush(QUEUE_KEY, job._id);
  return job;
}

export async function getLocalLeadSearchJob(id: string) {
  const raw = await getRedisConnection().get(jobKey(id));
  if (!raw) return null;
  try { return JSON.parse(raw) as LocalLeadSearchJob; } catch { return null; }
}

export async function saveLocalLeadSearchJob(job: LocalLeadSearchJob) {
  job.updatedAt = new Date().toISOString();
  await getRedisConnection().set(jobKey(job._id), JSON.stringify(job), 'EX', JOB_TTL_SECONDS);
  return job;
}

export async function listLocalLeadSearchJobs(userId: string, limit = 20) {
  const redis = getRedisConnection();
  const ids = await redis.zrevrange(userJobsKey(userId), 0, Math.max(0, Math.min(limit, USER_JOB_LIMIT) - 1));
  const jobs: LocalLeadSearchJob[] = [];
  for (const id of ids) {
    const job = await getLocalLeadSearchJob(id);
    if (job) jobs.push(job);
    else await redis.zrem(userJobsKey(userId), id);
  }
  return jobs;
}

export async function countLocalLeadSearchesToday(userId: string) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return getRedisConnection().zcount(userJobsKey(userId), start, '+inf');
}

export async function hasActiveLocalLeadSearch(userId: string) {
  const jobs = await listLocalLeadSearchJobs(userId, 20);
  return jobs.some((job) => job.status === 'queued' || job.status === 'running');
}

async function requeueStaleLocalLeadSearches() {
  const redis = getRedisConnection();
  const staleBefore = Date.now() - 20 * 60 * 1000;
  const staleIds = await redis.zrangebyscore(RUNNING_KEY, '-inf', staleBefore);
  for (const id of staleIds) {
    const job = await getLocalLeadSearchJob(id);
    if (job && job.status === 'running') {
      job.status = 'queued';
      job.startedAt = null;
      job.error = 'Previous local agent run stopped before completion; queued again.';
      await saveLocalLeadSearchJob(job);
      await redis.rpush(QUEUE_KEY, id);
    }
    await redis.zrem(RUNNING_KEY, id);
  }
}

export async function claimNextLocalLeadSearch() {
  const redis = getRedisConnection();
  await requeueStaleLocalLeadSearches();
  for (let i = 0; i < 100; i += 1) {
    const id = await redis.lpop(QUEUE_KEY);
    if (!id) return null;
    const job = await getLocalLeadSearchJob(id);
    if (!job || job.status !== 'queued') continue;
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    job.completedAt = null;
    job.error = '';
    await saveLocalLeadSearchJob(job);
    await redis.zadd(RUNNING_KEY, Date.now(), id);
    return job;
  }
  return null;
}

export async function completeLocalLeadSearch(jobId: string, leads: LocalProspectLead[]) {
  const redis = getRedisConnection();
  const job = await getLocalLeadSearchJob(jobId);
  if (!job) return null;
  await redis.set(leadsKey(jobId), JSON.stringify(leads), 'EX', JOB_TTL_SECONDS);
  await redis.zrem(RUNNING_KEY, jobId);
  job.status = 'completed';
  job.totalFound = leads.length;
  job.error = '';
  job.completedAt = new Date().toISOString();
  await saveLocalLeadSearchJob(job);
  return job;
}

export async function failLocalLeadSearch(jobId: string, error: unknown) {
  const redis = getRedisConnection();
  const job = await getLocalLeadSearchJob(jobId);
  if (!job) return null;
  await redis.zrem(RUNNING_KEY, jobId);
  job.status = 'failed';
  job.error = String((error as any)?.message || error || 'Lead search failed').slice(0, 1000);
  job.completedAt = new Date().toISOString();
  await saveLocalLeadSearchJob(job);
  return job;
}

export async function getLocalProspectLeads(jobId: string) {
  const raw = await getRedisConnection().get(leadsKey(jobId));
  if (!raw) return [] as LocalProspectLead[];
  try { return JSON.parse(raw) as LocalProspectLead[]; } catch { return []; }
}

export async function saveLocalProspectLeads(jobId: string, leads: LocalProspectLead[]) {
  await getRedisConnection().set(leadsKey(jobId), JSON.stringify(leads), 'EX', JOB_TTL_SECONDS);
}
