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

  logger.error('[api] Unhandled error:', error);
  return NextResponse.json({ success: false, message: fallbackMessage }, { status: 500 });
}
