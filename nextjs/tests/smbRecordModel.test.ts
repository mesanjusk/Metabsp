import { describe, expect, it } from 'vitest';
import { SMB_RECORD_KINDS } from '../lib/models/SmbRecord';

describe('small-business shared record model', () => {
  it('contains the revenue, operations and growth record kinds', () => {
    expect(SMB_RECORD_KINDS).toEqual(expect.arrayContaining([
      'lead',
      'followup',
      'quotation',
      'order',
      'invoice',
      'payment',
      'task',
      'expense',
      'vendor',
      'product',
      'inventory',
      'review_request',
    ]));
  });

  it('keeps attendance out of the generic record model', () => {
    expect(SMB_RECORD_KINDS).not.toContain('attendance');
  });

  it('does not expose duplicate record kind identifiers', () => {
    expect(new Set(SMB_RECORD_KINDS).size).toBe(SMB_RECORD_KINDS.length);
  });
});
