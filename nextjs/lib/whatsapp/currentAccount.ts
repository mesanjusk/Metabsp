import { loadActiveWhatsAppAccountForUser } from '../services/whatsappAccountService';

// Ported from backend/src/services/whatsappAccountService.js's
// resolveCurrentWhatsAppAccount(req) — that version also stashed the result
// on req.whatsappAccountContext for later middleware/handlers in the same
// Express request; Route Handlers have no equivalent shared mutable req, so
// callers just use the return value directly.
export async function resolveCurrentWhatsAppAccountForUser(userId: string, options: { requireAccount?: boolean } = {}) {
  return loadActiveWhatsAppAccountForUser(userId, options);
}
