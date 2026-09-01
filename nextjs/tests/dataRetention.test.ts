import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const messageFind = vi.fn();
const messageDeleteMany = vi.fn();
const contactFind = vi.fn();
const contactDeleteMany = vi.fn();
const auditDeleteMany = vi.fn();
const auditCreate = vi.fn(async (_doc?: any) => ({}));
const destroy = vi.fn(async () => ({ result: 'ok' }));

vi.mock('@/lib/models/Message', () => ({
  default: { find: (...a: any[]) => messageFind(...a), deleteMany: (...a: any[]) => messageDeleteMany(...a) },
}));
vi.mock('@/lib/models/Contact', () => ({
  default: { find: (...a: any[]) => contactFind(...a), deleteMany: (...a: any[]) => contactDeleteMany(...a) },
}));
vi.mock('@/lib/models/AuditLog', () => ({
  default: { deleteMany: (...a: any[]) => auditDeleteMany(...a), create: (doc: any) => auditCreate(doc) },
}));
vi.mock('@/lib/utils/cloudinary', () => ({ default: { uploader: { destroy } } }));

const { runRetentionSweep, isRetentionEnabled, getRetentionConfig, derivePublicIdFromUrl } = await import(
  '@/lib/services/dataRetentionService'
);

const chain = (rows: any[]) => ({ select: () => ({ limit: () => ({ lean: async () => rows }) }) });

const RETENTION_VARS = [
  'RETENTION_MESSAGES_DAYS',
  'RETENTION_CONTACTS_INACTIVE_DAYS',
  'RETENTION_AUDIT_LOG_DAYS',
  'RETENTION_DELETE_MEDIA',
];

/**
 * The retention policy was published and unimplemented. These cover the two
 * ways an implementation could still be wrong in practice: deleting when it
 * was never asked to, and reporting a deletion that left the media behind.
 */
describe('data retention', () => {
  beforeEach(() => {
    RETENTION_VARS.forEach((name) => delete process.env[name]);
    [messageFind, messageDeleteMany, contactFind, contactDeleteMany, auditDeleteMany, auditCreate, destroy].forEach(
      (fn) => fn.mockClear()
    );
    messageFind.mockReturnValue(chain([]));
    contactFind.mockReturnValue(chain([]));
    messageDeleteMany.mockImplementation(async () => ({ deletedCount: 0 }));
    contactDeleteMany.mockImplementation(async () => ({ deletedCount: 0 }));
    auditDeleteMany.mockImplementation(async () => ({ deletedCount: 0 }));
  });

  afterEach(() => {
    RETENTION_VARS.forEach((name) => delete process.env[name]);
  });

  it('is OFF by default — nothing is deleted unless a window is configured', async () => {
    expect(isRetentionEnabled()).toBe(false);

    const result = await runRetentionSweep();
    expect(result).toMatchObject({ ran: false });
    expect(messageDeleteMany).not.toHaveBeenCalled();
    expect(contactDeleteMany).not.toHaveBeenCalled();
  });

  it('ignores a zero or nonsense window rather than treating it as "delete everything"', () => {
    process.env.RETENTION_MESSAGES_DAYS = '0';
    expect(getRetentionConfig().messagesDays).toBe(0);

    process.env.RETENTION_MESSAGES_DAYS = 'soon';
    expect(getRetentionConfig().messagesDays).toBe(0);

    process.env.RETENTION_MESSAGES_DAYS = '-30';
    expect(getRetentionConfig().messagesDays).toBe(0);
    expect(isRetentionEnabled()).toBe(false);
  });

  it('deletes messages older than the configured window, and only those', async () => {
    process.env.RETENTION_MESSAGES_DAYS = '90';
    messageFind.mockReturnValueOnce(chain([{ _id: 'm1' }, { _id: 'm2' }])).mockReturnValue(chain([]));
    messageDeleteMany.mockImplementation(async () => ({ deletedCount: 2 }));

    const result: any = await runRetentionSweep();

    const filter = messageFind.mock.calls[0][0] as any;
    const cutoff = filter.createdAt.$lt as Date;
    const expected = Date.now() - 90 * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff.getTime() - expected)).toBeLessThan(60_000);
    expect(result.messagesRemoved).toBe(2);
  });

  it('deletes the media file BEFORE the row that points at it', async () => {
    // Deleting the row first orphans the file forever — deletion that only
    // looks like deletion, which is worse than none because it is reported as
    // compliance.
    process.env.RETENTION_MESSAGES_DAYS = '30';
    const order: string[] = [];
    destroy.mockImplementation(async () => {
      order.push('media');
      return { result: 'ok' };
    });
    messageDeleteMany.mockImplementation(async () => {
      order.push('row');
      return { deletedCount: 1 };
    });
    messageFind
      .mockReturnValueOnce(
        chain([{ _id: 'm1', mediaUrl: 'https://res.cloudinary.com/x/image/upload/v1/whatsapp_media/abc.jpg', mediaPublicId: 'whatsapp_media/abc', mediaResourceType: 'image' }])
      )
      .mockReturnValue(chain([]));

    const result: any = await runRetentionSweep();

    expect(destroy).toHaveBeenCalledWith('whatsapp_media/abc', { resource_type: 'image' });
    expect(order).toEqual(['media', 'row']);
    expect(result.mediaFilesRemoved).toBe(1);
  });

  it('still deletes the row when the media file cannot be removed', async () => {
    process.env.RETENTION_MESSAGES_DAYS = '30';
    destroy.mockImplementation(async () => {
      throw new Error('cloudinary unavailable');
    });
    messageDeleteMany.mockImplementation(async () => ({ deletedCount: 1 }));
    messageFind
      .mockReturnValueOnce(chain([{ _id: 'm1', mediaUrl: 'https://res.cloudinary.com/x/image/upload/v1/a.jpg' }]))
      .mockReturnValue(chain([]));

    const result: any = await runRetentionSweep();
    expect(result.messagesRemoved).toBe(1);
  });

  it('skips media deletion entirely when it is switched off', async () => {
    process.env.RETENTION_MESSAGES_DAYS = '30';
    process.env.RETENTION_DELETE_MEDIA = 'false';
    messageFind
      .mockReturnValueOnce(chain([{ _id: 'm1', mediaUrl: 'https://res.cloudinary.com/x/image/upload/v1/a.jpg' }]))
      .mockReturnValue(chain([]));
    messageDeleteMany.mockImplementation(async () => ({ deletedCount: 1 }));

    await runRetentionSweep();
    expect(destroy).not.toHaveBeenCalled();
  });

  it('measures contact staleness from last contact, not from row age', async () => {
    process.env.RETENTION_CONTACTS_INACTIVE_DAYS = '365';
    contactFind.mockReturnValueOnce(chain([{ _id: 'c1' }])).mockReturnValue(chain([]));
    contactDeleteMany.mockImplementation(async () => ({ deletedCount: 1 }));

    await runRetentionSweep();

    const filter = contactFind.mock.calls[0][0] as any;
    // A long-standing customer who messaged yesterday is not stale.
    expect(filter.$or[0]).toHaveProperty('lastSeen');
  });

  it('records the sweep in the audit log, so a policy can be evidenced', async () => {
    process.env.RETENTION_AUDIT_LOG_DAYS = '400';
    auditDeleteMany.mockImplementation(async () => ({ deletedCount: 7 }));

    await runRetentionSweep();

    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'data_retention.sweep', outcome: 'success' })
    );
  });
});

describe('deriving a Cloudinary handle from a legacy URL', () => {
  it('recovers the public id and resource type from a stored URL', () => {
    expect(derivePublicIdFromUrl('https://res.cloudinary.com/demo/image/upload/v1712345/whatsapp_media/abc.jpg')).toEqual(
      { resourceType: 'image', publicId: 'whatsapp_media/abc' }
    );
  });

  it('handles a URL with no version segment', () => {
    expect(derivePublicIdFromUrl('https://res.cloudinary.com/demo/raw/upload/folder/file.pdf')).toEqual({
      resourceType: 'raw',
      publicId: 'folder/file',
    });
  });

  it('returns null for anything that is not a Cloudinary URL', () => {
    expect(derivePublicIdFromUrl('https://example.com/a.jpg')).toBeNull();
    expect(derivePublicIdFromUrl('')).toBeNull();
  });
});
