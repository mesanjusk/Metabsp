import { NextResponse } from 'next/server';
import AppError from '../utils/AppError';
import logger from '../utils/logger';

// Ported from backend/src/middleware/errorHandler.js's response shape —
// {success: false, message} — so the existing frontend's error handling
// (utils/parseApiError.js) keeps working unchanged against this app too.
export function errorResponse(error: unknown, fallbackMessage = 'Request failed') {
  if (error instanceof AppError) {
    return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
  }

  // A database or cache that is unreachable is not the caller's fault and is
  // usually transient, so it answers 503 (retry later) rather than 500. The
  // distinction matters to monitoring and to any client with retry logic.
  const message = String((error as any)?.message || '');
  const isInfrastructureError =
    /MONGO_URI is not set|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|failed to connect|Topology|server selection/i.test(message);

  if (isInfrastructureError) {
    logger.error('[api] Infrastructure unavailable:', message);
    return NextResponse.json(
      { success: false, message: 'Service temporarily unavailable. Please retry.' },
      { status: 503 }
    );
  }

  // Never returns error.message for an unexpected throw — it can carry query
  // fragments, connection strings or stack context. The detail goes to the log.
  logger.error('[api] Unhandled error:', error);
  return NextResponse.json({ success: false, message: fallbackMessage }, { status: 500 });
}
