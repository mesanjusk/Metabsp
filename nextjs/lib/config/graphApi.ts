// Ported unchanged from backend/src/config/graphApi.js — single source of
// truth for Meta Graph API version + webhook verify-token lookup. Must stay
// in lockstep with the always-on host's copy (same env var names).
const DEFAULT_GRAPH_API_VERSION = 'v23.0';

export function getGraphApiVersion(): string {
  return process.env.WHATSAPP_API_VERSION || process.env.META_API_VERSION || DEFAULT_GRAPH_API_VERSION;
}

export function getWebhookVerifyToken(): string {
  return (
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
    process.env.WHATSAPP_VERIFY_TOKEN ||
    process.env.VERIFY_TOKEN ||
    ''
  );
}
