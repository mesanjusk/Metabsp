import { NextRequest, NextResponse } from 'next/server';
import { requireApiKey, ApiKeyPrincipal } from '../auth/apiKey';
import { loadActiveWhatsAppAccountForUser } from '../services/whatsappAccountService';
import { checkUserRateLimit } from './rateLimit';
import AppError from '../utils/AppError';
import logger from '../utils/logger';

export const normalizeExternalPhone = (value: unknown) => String(value || '').replace(/\D/g, '');

// Mirrors the same test in lib/http/errorResponse.ts: infrastructure being
// down is not the caller's fault and is usually transient.
const INFRASTRUCTURE_ERROR =
  /MONGO_URI is not set|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|failed to connect|Topology|server selection|buffering timed out/i;

/**
 * Error shape for /api/v1.
 *
 * Meta's own error text is the useful part of a failure ("template does not
 * exist", "recipient not in allowed list"), so it is passed through — that is
 * what makes the API debuggable for an integrator. Everything else is not:
 * an unexpected `error.message` can carry a connection string, a query
 * fragment or a hostname, and this endpoint answers unauthenticated callers.
 * Those go to the log and the caller gets a generic message.
 */
export function externalApiError(error: any, operation: string): NextResponse {
  const metaMessage = error?.response?.data?.error?.message;
  const metaCode = error?.response?.data?.error?.code;

  if (metaMessage) {
    const status =
      error?.response?.status && error.response.status >= 400 && error.response.status <= 499 ? 400 : 502;
    return NextResponse.json(
      { success: false, operation, message: metaMessage, ...(metaCode ? { code: metaCode } : {}) },
      { status }
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json({ success: false, operation, message: error.message }, { status: error.statusCode });
  }

  if (INFRASTRUCTURE_ERROR.test(String(error?.message || ''))) {
    logger.error(`[external-api] ${operation}: infrastructure unavailable:`, error?.message);
    return NextResponse.json(
      { success: false, operation, message: 'Service temporarily unavailable. Please retry.' },
      { status: 503 }
    );
  }

  logger.error(`[external-api] ${operation} failed:`, error);
  return NextResponse.json({ success: false, operation, message: `${operation} failed` }, { status: 502 });
}

interface HandlerContext {
  req: NextRequest;
  principal: ApiKeyPrincipal;
  accountContext: any;
  body: any;
}

/**
 * Wraps an /api/v1 route: authenticate the key, rate limit it, and resolve the
 * WhatsApp account it is allowed to act on.
 *
 * The account is always resolved from the key's own owner. A phone number or
 * account id in the request body is never trusted for that decision, so a key
 * can only ever send from the number its owner connected — the single most
 * important isolation rule in a multi-tenant BSP.
 */
export function withApiKeyAccount(
  operation: string,
  handler: (ctx: HandlerContext) => Promise<NextResponse>,
  { rateLimit = { windowMs: 60 * 1000, maxRequests: 60 } } = {}
) {
  return async function route(req: NextRequest): Promise<NextResponse> {
    try {
      // requireApiKey opens the DB connection itself, after it has confirmed a
      // key was supplied — see the note there.
      const principal = await requireApiKey(req);

      // Keyed on the API key, not the user: one customer's runaway integration
      // must not consume another integration's budget on the same account.
      const allowed = await checkUserRateLimit(`apikey:${principal.apiKeyId}`, rateLimit);
      if (!allowed) {
        return NextResponse.json(
          { success: false, operation, message: 'Rate limit exceeded. Slow down and retry.' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.windowMs / 1000)) } }
        );
      }

      let accountContext: any;
      try {
        accountContext = await loadActiveWhatsAppAccountForUser(principal.userId);
      } catch {
        return NextResponse.json(
          {
            success: false,
            operation,
            message:
              'No active WhatsApp account is connected for this API key. Connect a number in the dashboard first.',
          },
          { status: 409 }
        );
      }

      const body = await req.json().catch(() => ({}));
      return await handler({ req, principal, accountContext, body });
    } catch (error: any) {
      return externalApiError(error, operation);
    }
  };
}
