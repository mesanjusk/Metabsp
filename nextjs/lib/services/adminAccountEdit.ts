/**
 * May an admin's edit write to the WhatsApp account, and with what?
 *
 * Extracted because getting this wrong is silent. The admin user panel is
 * where a wrong `wabaId` gets corrected, and a wrong `wabaId` costs every
 * inbound message — so a save that reports success and writes nothing is the
 * worst possible behaviour on exactly the field that most needs fixing.
 *
 * That is what requiring an access token to write ANY field produced. The
 * panel cannot prefill the token: the API strips it from every response, and
 * it must. So an admin who corrected the WABA id and pressed save was told
 * "User updated successfully" and got no write at all.
 *
 * Creating an account still needs a token — there is nothing to send to Meta
 * without one. Correcting an existing account does not.
 */
export interface AccountEditInput {
  hasExistingAccount: boolean;
  accessToken?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  wabaId?: string;
}

export const canWriteWhatsAppAccount = ({
  hasExistingAccount,
  accessToken = '',
  phoneNumberId = '',
  businessAccountId = '',
  wabaId = '',
}: AccountEditInput): boolean => {
  const mentionsAccount = Boolean(accessToken || phoneNumberId || businessAccountId || wabaId);

  if (!hasExistingAccount) {
    return Boolean(accessToken && phoneNumberId && (businessAccountId || wabaId));
  }
  return mentionsAccount;
};

/**
 * What the account's ids become after an edit.
 *
 * Every field falls back to what is stored, so correcting one cannot blank the
 * others — the same partial-update contract the manual account route keeps.
 * `businessAccountId` and `wabaId` still stand in for each other when only one
 * is supplied, which is long-standing behaviour and not this function's to
 * change.
 */
export const resolveAccountIds = ({
  stored,
  submitted,
}: {
  stored: { phoneNumberId?: string; businessAccountId?: string; wabaId?: string };
  submitted: { phoneNumberId?: string; businessAccountId?: string; wabaId?: string };
}) => ({
  phoneNumberId: submitted.phoneNumberId || stored.phoneNumberId || '',
  businessAccountId: submitted.businessAccountId || submitted.wabaId || stored.businessAccountId || '',
  wabaId: submitted.wabaId || submitted.businessAccountId || stored.wabaId || '',
});
