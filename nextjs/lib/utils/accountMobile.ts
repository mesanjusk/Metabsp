/**
 * The canonical form of a mobile number when it is used as an account
 * identity — the thing a person types to sign in.
 *
 * Sign-in used to take a username chosen at registration, separate from the
 * mobile number the account was verified against. That is one more secret to
 * remember for no benefit: the number is already unique, already verified by
 * OTP, and already the thing a customer knows about their own account. The
 * number is the identity now, and this function is the single definition of
 * what "the same number" means so that `+91 98765-43210`, `9876543210` and
 * `919876543210` all reach one account instead of three.
 *
 * The 10-digit rule mirrors normalizeWhatsAppNumber, which OTP delivery
 * already applies. If the two disagreed, the code would be sent to one number
 * and the account created under another.
 */
export function normalizeAccountMobile(value: unknown): string {
  let digits = String(value ?? '').replace(/\D/g, '');
  // International prefix dialled the long way round: 00 91 98…
  if (digits.startsWith('00')) digits = digits.slice(2);
  // A bare Indian subscriber number, as typed by someone who has never had to
  // think about a country code.
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/**
 * Every stored form a person's typed number might already be sitting under.
 *
 * Accounts created before the number became the identity hold whatever was
 * typed then — with a country code or without, punctuated or not. A lookup
 * has to match those too, or the change locks existing customers out of their
 * own accounts.
 */
export function mobileLookupCandidates(value: unknown): string[] {
  const raw = String(value ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  const canonical = normalizeAccountMobile(raw);

  const candidates = [canonical, digits, raw];
  // 919876543210 typed in full should still find an account stored as
  // 9876543210.
  if (digits.length > 10) candidates.push(digits.slice(-10));

  return [...new Set(candidates.filter(Boolean))];
}

/** Rejects obvious nonsense before an OTP is spent on it. */
export function isPlausibleMobile(value: unknown): boolean {
  const digits = normalizeAccountMobile(value);
  return digits.length >= 10 && digits.length <= 15;
}

export default normalizeAccountMobile;
