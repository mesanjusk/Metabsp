import { describe, expect, it } from 'vitest';
import { indexKeySignature, sameIndexDefinition } from '@/lib/services/mongoIndexAudit';

describe('mongo index audit helpers', () => {
  it('keeps compound index key order significant', () => {
    expect(indexKeySignature({ userId: 1, phone: 1 })).toBe('userId:1|phone:1');
    expect(indexKeySignature({ phone: 1, userId: 1 })).not.toBe('userId:1|phone:1');
  });

  it('matches an index only when important options also match', () => {
    const key = { userId: 1, phone: 1 };

    expect(sameIndexDefinition(key, { unique: true, sparse: true }, {
      key,
      unique: true,
      sparse: true,
      name: 'userId_1_phone_1',
    })).toBe(true);

    expect(sameIndexDefinition(key, { unique: true, sparse: true }, {
      key,
      unique: false,
      sparse: true,
    })).toBe(false);
  });

  it('compares partial filters independent of object property order', () => {
    const key = { userId: 1, sku: 1 };

    expect(sameIndexDefinition(key, {
      unique: true,
      partialFilterExpression: { sku: { $type: 'string', $gt: '' } },
    }, {
      key,
      unique: true,
      partialFilterExpression: { sku: { $gt: '', $type: 'string' } },
    })).toBe(true);
  });
});
