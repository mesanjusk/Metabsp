import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { getJwtSecret } from '@/lib/auth/jwt';
import { errorResponse } from '@/lib/http/errorResponse';
import {
  buildGoogleAuthorizationUrl,
  getGoogleBusinessConfig,
  GOOGLE_BUSINESS_SCOPES,
} from '@/lib/googleBusiness/google';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    // Same short-lived signed state as the Instagram flow: Google's callback is
    // unauthenticated, so the dashboard user has to travel in the state itself.
    const state = jwt.sign({ id: authed.id, purpose: 'google-business-oauth' }, getJwtSecret(), {
      expiresIn: '10m',
    });

    const { redirectUri } = getGoogleBusinessConfig();
    return NextResponse.json({
      success: true,
      data: {
        authorizationUrl: buildGoogleAuthorizationUrl(state),
        redirectUri,
        scopes: [...GOOGLE_BUSINESS_SCOPES],
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to start Google Business authorization');
  }
}
