import { describe, expect, it } from 'vitest';
import { ownedAutoReplyFilter, unownedAutoReplyFilter, autoReplyScopeFilter } from '@/lib/whatsapp/automation';
import AutoReply from '@/lib/models/AutoReply';

const USER_ID = '68b2f1c0a1b2c3d4e5f60718';
const ACCOUNT_ID = '68b2f1c0a1b2c3d4e5f60719';

describe('the auto-reply fallback that answered 500', () => {
  it('does not put an empty string where an ObjectId is expected', () => {
    // The bug, exactly: `{ userId: '' }` against an ObjectId path. Mongoose
    // cannot cast it, so it throws CastError rather than matching nothing —
    // and this filter runs only when a user owns no rules at all, so the
    // screen failed for precisely the accounts that had never used it.
    const filter = JSON.stringify(unownedAutoReplyFilter());

    expect(filter).not.toContain('""');
  });

  it('still matches rules that predate per-account ownership', () => {
    // `{ userId: null }` matches a null field AND an absent one, which is why
    // dropping the separate $exists clause loses nothing.
    expect(unownedAutoReplyFilter()).toEqual({ userId: null });
  });

  it('casts cleanly through Mongoose instead of throwing', () => {
    // The assertion that would have caught this: ask Mongoose to cast the
    // filter against the real schema, which is what the route does.
    expect(() => AutoReply.find(unownedAutoReplyFilter()).cast(AutoReply)).not.toThrow();
  });
});

describe('the rules a user owns', () => {
  it('scopes to the user and their current account', () => {
    expect(ownedAutoReplyFilter(USER_ID, { account: { _id: ACCOUNT_ID } })).toEqual({
      userId: USER_ID,
      whatsappAccountId: ACCOUNT_ID,
    });
  });

  it('scopes to the user alone when no account is connected', () => {
    // Narrowing by an absent account id would match nothing and silently hide
    // every rule the user has.
    expect(ownedAutoReplyFilter(USER_ID, null)).toEqual({ userId: USER_ID });
  });

  it('casts cleanly for a user with no connected account', () => {
    expect(() => AutoReply.find(ownedAutoReplyFilter(USER_ID, null)).cast(AutoReply)).not.toThrow();
  });
});

describe('the shared scope filter used by the per-rule routes', () => {
  it('casts cleanly too, so one fix does not leave the siblings broken', () => {
    expect(() => AutoReply.find(autoReplyScopeFilter(USER_ID, null)).cast(AutoReply)).not.toThrow();
  });
});
