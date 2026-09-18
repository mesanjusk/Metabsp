import { describe, expect, it } from 'vitest';
import { SMB_RECORD_KINDS } from '../lib/models/SmbRecord';

describe('small-business shared record model', () => {
  it('contains the revenue, operations, finance and marketing record kinds', () => {
    expect(SMB_RECORD_KINDS).toEqual(expect.arrayContaining([
      'lead',
      'followup',
      'quotation',
      'order',
      'invoice',
      'payment',
      'payment_reminder',
      'task',
      'responsibility',
      'sop_task',
      'expense',
      'vendor',
      'purchase_order',
      'rate_card',
      'product',
      'inventory',
      'delivery',
      'review_request',
      'workflow_template',
      'social_content',
      'social_approval',
      'social_schedule',
    ]));
  });

  it('keeps attendance out of the generic record model', () => {
    expect(SMB_RECORD_KINDS).not.toContain('attendance');
  });

  it('does not expose duplicate record kind identifiers', () => {
    expect(new Set(SMB_RECORD_KINDS).size).toBe(SMB_RECORD_KINDS.length);
  });
});
