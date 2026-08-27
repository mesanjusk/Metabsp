// Single source of truth for the public site: domain, contact addresses, and
// the date shown on the legal pages.
//
// The same values were hardcoded across the legal pages, the help centre, the
// developer docs, the contact page and the footer. That is how a site ends up
// advertising one domain in its Privacy Policy while being served from
// another — and Meta fetches the Privacy Policy, Terms and Data Deletion URLs
// during App Review, so a stale copy in any one of them is a rejection.

const stripTrailingSlash = (value: string) => String(value || '').replace(/\/+$/, '');

export const PUBLIC_APP_URL = stripTrailingSlash(
  process.env.NEXT_PUBLIC_APP_URL || 'https://meta.sanjusk.in'
);

// Host without the scheme — what Meta's "App Domains" field wants.
export const PUBLIC_APP_DOMAIN = PUBLIC_APP_URL.replace(/^https?:\/\//, '');

const mailbox = (envValue: string | undefined, localPart: string) =>
  String(envValue || '').trim() || `${localPart}@${PUBLIC_APP_DOMAIN}`;

// Each address is overridable on its own: a support desk on another provider
// is normal. Defaulting is not the same as existing — confirm every mailbox
// actually receives mail. A reviewer emailing an address that bounces is worse
// than no address at all.
export const SUPPORT_EMAIL = mailbox(process.env.NEXT_PUBLIC_SUPPORT_EMAIL, 'support');
export const SALES_EMAIL = mailbox(process.env.NEXT_PUBLIC_SALES_EMAIL, 'sales');
export const PRIVACY_EMAIL = mailbox(process.env.NEXT_PUBLIC_PRIVACY_EMAIL, 'privacy');
export const SECURITY_EMAIL = mailbox(process.env.NEXT_PUBLIC_SECURITY_EMAIL, 'security');
export const LEGAL_EMAIL = mailbox(process.env.NEXT_PUBLIC_LEGAL_EMAIL, 'legal');
export const REVIEW_EMAIL = mailbox(process.env.NEXT_PUBLIC_REVIEW_EMAIL, 'review');

export const API_DOCS_BASE_URL = `${PUBLIC_APP_URL}/api`;

export const publicUrl = (path = '') =>
  `${PUBLIC_APP_URL}${path.startsWith('/') ? path : `/${path}`}`;

export const PRIVACY_POLICY_URL = publicUrl('/privacy-policy');
export const TERMS_OF_SERVICE_URL = publicUrl('/terms-of-service');
export const DATA_DELETION_URL = publicUrl('/data-deletion');

// One date across every legal page. They previously disagreed — two said
// "June 2025" and one "July 2026" — which reads as an abandoned site, and on
// a Privacy Policy specifically it undermines the document's own claim to be
// current. Update this when the policies are actually revised, not on every
// deploy: a date that moves without the text changing is worse than a stale
// one, because it asserts a review that did not happen.
export const LEGAL_LAST_UPDATED = 'August 2026';

// How the company may describe itself in public copy.
//
// It may NOT say "a WhatsApp Business Solution Provider authorized by Meta".
// That claim was on the Privacy Policy, the Terms and the Help Centre while
// App Review was still pending and unapproved. Asserting Meta's authorisation
// on the very pages Meta fetches during review is an overclaim a reviewer is
// well placed to check, and it costs nothing to state accurately instead.
export const PLATFORM_DESCRIPTION =
  "a WhatsApp Business Platform provider built on Meta's official WhatsApp Cloud API";
