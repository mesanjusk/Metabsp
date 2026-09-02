import { describe, expect, it } from 'vitest';
import { canWriteWhatsAppAccount, resolveAccountIds } from '@/lib/services/adminAccountEdit';

const REAL_WABA = '901077812889176';
const APP_ID = '1717826239505344';
const PHONE_NUMBER_ID = '912271725313129';

describe('may an admin edit write to the account', () => {
  it('writes a corrected WABA id without the access token being re-entered', () => {
    // The shape every real correction has: the panel cannot prefill the token,
    // because the API strips it from every response and must. Requiring it
    // meant the admin was told "updated successfully" and nothing was written
    // — on the one field whose wrongness costs every inbound message.
    expect(
      canWriteWhatsAppAccount({ hasExistingAccount: true, wabaId: REAL_WABA, phoneNumberId: PHONE_NUMBER_ID })
    ).toBe(true);
  });

  it('writes a WABA id supplied entirely on its own', () => {
    expect(canWriteWhatsAppAccount({ hasExistingAccount: true, wabaId: REAL_WABA })).toBe(true);
  });

  it('does nothing when the edit says nothing about the account', () => {
    // Renaming a user must not touch their WhatsApp account.
    expect(canWriteWhatsAppAccount({ hasExistingAccount: true })).toBe(false);
  });

  it('still requires a token to create an account that does not exist yet', () => {
    // There is nothing to send to Meta without one.
    expect(
      canWriteWhatsAppAccount({ hasExistingAccount: false, wabaId: REAL_WABA, phoneNumberId: PHONE_NUMBER_ID })
    ).toBe(false);
    expect(
      canWriteWhatsAppAccount({
        hasExistingAccount: false,
        accessToken: 'tok',
        phoneNumberId: PHONE_NUMBER_ID,
        wabaId: REAL_WABA,
      })
    ).toBe(true);
  });

  it('will not create an account from a token and phone number with no WABA at all', () => {
    expect(
      canWriteWhatsAppAccount({ hasExistingAccount: false, accessToken: 'tok', phoneNumberId: PHONE_NUMBER_ID })
    ).toBe(false);
  });
});

describe('the admin form gate, which shares this rule', () => {
  // The form preloads the stored ids and cannot preload the token, so this is
  // the state it is in for every user who already has an account. Reading
  // "any id present without a token" as a reason to refuse left the Update
  // button permanently disabled — the server rule and the form rule have to
  // be the same rule, and now are.
  const preloadedForm = {
    hasExistingAccount: true,
    accessToken: '',
    phoneNumberId: PHONE_NUMBER_ID,
    businessAccountId: APP_ID,
    wabaId: APP_ID,
  };

  it('lets the form submit an existing account with no token typed', () => {
    expect(canWriteWhatsAppAccount(preloadedForm)).toBe(true);
  });

  it('lets the form submit once the WABA id is corrected in place', () => {
    expect(canWriteWhatsAppAccount({ ...preloadedForm, wabaId: REAL_WABA })).toBe(true);
  });

  it('still holds the form back when a new account is being created without a token', () => {
    expect(canWriteWhatsAppAccount({ ...preloadedForm, hasExistingAccount: false })).toBe(false);
  });
});

describe('what the ids become after an edit', () => {
  // The state found in production: the Meta App ID stored as the WABA.
  const stored = { phoneNumberId: PHONE_NUMBER_ID, businessAccountId: APP_ID, wabaId: APP_ID };

  it('replaces the wrong id with the corrected one', () => {
    expect(resolveAccountIds({ stored, submitted: { wabaId: REAL_WABA } })).toEqual({
      phoneNumberId: PHONE_NUMBER_ID,
      businessAccountId: REAL_WABA,
      wabaId: REAL_WABA,
    });
  });

  it('does not blank the fields it was not asked about', () => {
    expect(resolveAccountIds({ stored, submitted: {} })).toEqual({
      phoneNumberId: PHONE_NUMBER_ID,
      businessAccountId: APP_ID,
      wabaId: APP_ID,
    });
  });

  it('keeps the two ids standing in for each other when only one is given', () => {
    expect(
      resolveAccountIds({ stored: {}, submitted: { businessAccountId: REAL_WABA } }).wabaId
    ).toBe(REAL_WABA);
  });

  it('lets the two differ when both are supplied', () => {
    const ids = resolveAccountIds({
      stored,
      submitted: { businessAccountId: '4373823022847276', wabaId: REAL_WABA },
    });
    expect(ids.businessAccountId).toBe('4373823022847276');
    expect(ids.wabaId).toBe(REAL_WABA);
  });
});
