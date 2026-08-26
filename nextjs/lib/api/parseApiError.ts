// Ported from frontend/src/utils/parseApiError.js, with one hardening.
//
// The original returned `responseData` verbatim whenever it was a string. That
// is right for a plain-text API message and badly wrong for an HTML body: a
// request to a path this deployment does not serve gets Next.js's HTML error
// page back, and the panel rendered the entire document — doctype, script
// tags and all — into the UI as if it were an error message. Which is exactly
// what the dashboard's Settings tab did for /api/billing/admin/overview.
//
// So a string response is only used when it actually looks like a message.
// Anything that smells like markup falls through to the generic fallback,
// because whatever the real problem is, the user cannot act on a stack of
// <script> tags.

const looksLikeMarkup = (value: string): boolean =>
  /^\s*(<!doctype|<html|<\?xml|<head|<body)/i.test(value) || /<\/(html|body|script)>/i.test(value);

export function parseApiError(error: any, fallback = 'Something went wrong. Please try again.'): string {
  const responseData = error?.response?.data;

  if (typeof responseData === 'string') {
    const trimmed = responseData.trim();
    if (trimmed && !looksLikeMarkup(trimmed)) {
      // Guard against a plain-text body that is technically a message but far
      // too long to belong in a toast or an inline alert.
      return trimmed.length > 300 ? `${trimmed.slice(0, 300)}…` : trimmed;
    }
    // Markup, or an empty body: fall through and let the status speak.
    const status = error?.response?.status;
    if (status === 404) return 'That endpoint is not available on this deployment.';
    if (status) return `Request failed (HTTP ${status}).`;
    return fallback;
  }

  if (responseData?.message) return responseData.message;
  if (responseData?.error?.message) return responseData.error.message;
  if (Array.isArray(responseData?.errors) && responseData.errors.length > 0) {
    return responseData.errors[0]?.message || fallback;
  }

  return error?.message || fallback;
}

export default parseApiError;
