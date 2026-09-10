import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireInstagramService } from '@/lib/instagram/access';
import { getJwtSecret } from '@/lib/auth/jwt';
import { errorResponse } from '@/lib/http/errorResponse';
import { buildInstagramAuthorizationUrl, getInstagramConfig, INSTAGRAM_SCOPES } from '@/lib/instagram/meta';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireInstagramService(req);
    const state = jwt.sign(
      { id: authed.id, purpose: 'instagram-oauth' },
      getJwtSecret(),
      { expiresIn: '10m' }
    );

    const { redirectUri } = getInstagramConfig();
    return NextResponse.json({
      success: true,
      data: {
        authorizationUrl: buildInstagramAuthorizationUrl(state),
        redirectUri,
        scopes: [...INSTAGRAM_SCOPES],
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to start Instagram authorization');
  }
}
