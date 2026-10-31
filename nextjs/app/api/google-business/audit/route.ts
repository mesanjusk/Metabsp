import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { requireServiceAccess } from '@/lib/services/serviceAccess';
import { errorResponse } from '@/lib/http/errorResponse';
import { resolveGoogleWorkspace } from '@/lib/googleBusiness/workspace';
import { getGoogleLocation, listAllGoogleReviews } from '@/lib/googleBusiness/profile';
import { buildGoogleBusinessAudit } from '@/lib/googleBusiness/audit';

/** Evidence-based, read-only audit. No review replies, AI calls or public edits. */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    await requireServiceAccess(authed, 'google-business');
    const { account, accessToken, path } = await resolveGoogleWorkspace(authed.id);
    const [location, reviewPages] = await Promise.all([
      getGoogleLocation(accessToken, account.locationName),
      listAllGoogleReviews(accessToken, path),
    ]);
    return NextResponse.json({ success: true, data: buildGoogleBusinessAudit(location, reviewPages) });
  } catch (error) {
    return errorResponse(error, 'Failed to audit the Google Business Profile');
  }
}
