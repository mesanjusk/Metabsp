// Single source of truth for Meta Graph API config that used to be
// duplicated (with three different fallback defaults — v18.0, v19.0,
// v20.0 — across separate files, meaning otherwise-identical calls could
// silently hit different Graph API versions depending on which module
// handled the request) and for the webhook verify-token lookup (which had
// two files each checking a different subset of the WHATSAPP_WEBHOOK_VERIFY_TOKEN
// / WHATSAPP_VERIFY_TOKEN / VERIFY_TOKEN env var aliases).
const DEFAULT_GRAPH_API_VERSION = 'v20.0';

function getGraphApiVersion() {
  return process.env.WHATSAPP_API_VERSION || process.env.META_API_VERSION || DEFAULT_GRAPH_API_VERSION;
}

function getWebhookVerifyToken() {
  return (
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
    process.env.WHATSAPP_VERIFY_TOKEN ||
    process.env.VERIFY_TOKEN ||
    ''
  );
}

module.exports = { getGraphApiVersion, getWebhookVerifyToken };
