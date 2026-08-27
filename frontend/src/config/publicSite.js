// Single source of truth for the public-facing domain and contact addresses.
//
// These strings used to be hardcoded in thirteen files — legal pages, the
// developer docs, the help centre, the App Review page, the footer. That is
// how the site ended up advertising a domain in its Privacy Policy, Terms and
// Data Deletion pages independently of what was actually deployed, and Meta
// fetches every one of those URLs during App Review. One stale copy is a
// rejection; thirteen places to keep in sync guarantees a stale copy.
//
// Change the domain in one place — or, better, set VITE_PUBLIC_APP_URL at
// build time and change nothing here at all.

const stripTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

export const PUBLIC_APP_URL = stripTrailingSlash(
  import.meta.env.VITE_PUBLIC_APP_URL || 'https://meta.sanjusk.in'
);

// Host without the scheme — what Meta's "App Domains" field wants.
export const PUBLIC_APP_DOMAIN = PUBLIC_APP_URL.replace(/^https?:\/\//, '');

const mailbox = (envValue, localPart) =>
  String(envValue || '').trim() || `${localPart}@${PUBLIC_APP_DOMAIN}`;

// Each address is overridable on its own, because they do not have to live on
// the app domain — a support desk on a different provider is common, and a
// reviewer emailing an address that bounces is a problem regardless of which
// domain it sits on. Confirm these mailboxes actually receive mail.
export const SUPPORT_EMAIL = mailbox(import.meta.env.VITE_SUPPORT_EMAIL, 'support');
export const SALES_EMAIL = mailbox(import.meta.env.VITE_SALES_EMAIL, 'sales');
export const PRIVACY_EMAIL = mailbox(import.meta.env.VITE_PRIVACY_EMAIL, 'privacy');
export const SECURITY_EMAIL = mailbox(import.meta.env.VITE_SECURITY_EMAIL, 'security');
export const LEGAL_EMAIL = mailbox(import.meta.env.VITE_LEGAL_EMAIL, 'legal');
export const REVIEW_EMAIL = mailbox(import.meta.env.VITE_REVIEW_EMAIL, 'review');

// Base URL used in the developer documentation's copy-pasteable examples.
export const API_DOCS_BASE_URL = `${PUBLIC_APP_URL}/api`;

export const publicUrl = (path = '') => `${PUBLIC_APP_URL}${path.startsWith('/') ? path : `/${path}`}`;

// The three URLs Meta fetches during App Review. Named so a grep for
// "privacy-policy" lands somewhere that explains why they matter.
export const PRIVACY_POLICY_URL = publicUrl('/privacy-policy');
export const TERMS_OF_SERVICE_URL = publicUrl('/terms-of-service');
export const DATA_DELETION_URL = publicUrl('/data-deletion');
