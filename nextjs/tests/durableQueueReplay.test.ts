import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  jobs: [] as any[],
  added: [] as any[],
  marked: [] as string[],
  cleaned: 0,
}));

vi.mock('bullmq', () => ({
  Queue: class {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
    async add(name: string, data: any, opts: any) {
      state.added.push({ queue: this.name, name, data, opts });
      return { id: opts?.jobId || 'job' };
    }
  },
}));

vi.mock('@/lib/db/redis', () => ({ getRedisConnection: () => ({}) }));
vi.mock('@/lib/services/schedulerLock', () => ({
  withLeaderLock: async (_name: string, task: () => Promise<any>) => task(),
}));
vi.mock('@/lib/services/durableQueueJournal', () => ({
  getRecoverableDurableJobs: async () => state.jobs,
  markDurableQueued: async (id: string) => state.marked.push(id),
  cleanupDurableQueueJournal: async () => ({ deleted: state.cleaned }),
}));

const { replayDurableQueueJobs } = await import('@/lib/services/durableQueueReplayService');

describe('durable queue replay', () => {
  beforeEach(() => {
    state.jobs = [];
    state.added = [];
    state.marked = [];
    state.cleaned = 0;
  });

  it('reconstructs a lost inbound webhook BullMQ job from Mongo', async () => {
    state.jobs = [{
      _id: 'webhook-abc',
      kind: 'webhook',
      payload: { object: 'whatsapp_business_account' },
      availableAt: new Date(0),
    }];

    const result = await replayDurableQueueJobs();

    expect(result).toMatchObject({ scanned: 1, replayed: 1, failed: 0 });
    expect(state.added[0]).toMatchObject({
      queue: 'whatsapp-webhook-inbound',
      name: 'inbound',
      data: {
        envelope: { object: 'whatsapp_business_account' },
        durableId: 'webhook-abc',
      },
      opts: { jobId: 'webhook-abc' },
    });
    expect(state.marked).toEqual(['webhook-abc']);
  });

  it('restores delayed outbound sends with the same durable job id', async () => {
    state.jobs = [{
      _id: 'send-abc',
      kind: 'whatsapp_send',
      payload: { accountId: 'a1', userId: 'u1', to: '919999999999', messageType: 'text', body: 'hello' },
      availableAt: new Date(Date.now() + 60_000),
    }];

    await replayDurableQueueJobs();

    expect(state.added[0].queue).toBe('whatsapp-broadcast-send');
    expect(state.added[0].opts.jobId).toBe('send-abc');
    expect(state.added[0].opts.delay).toBeGreaterThan(0);
    expect(state.added[0].data.durableId).toBe('send-abc');
  });
});
