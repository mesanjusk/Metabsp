import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { getGoogleBusinessAccess } from '@/lib/googleBusiness/google';
import { listGoogleAccounts, listGoogleLocations } from '@/lib/googleBusiness/profile';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { account, accessToken } = await getGoogleBusinessAccess(authed.id);

    const accounts = await listGoogleAccounts(accessToken);
    const requested = String(req.nextUrl.searchParams.get('accountName') || '').trim();
    const activeAccount = requested || account.accountName || accounts[0]?.name || '';

    const locations = activeAccount ? await listGoogleLocations(accessToken, activeAccount) : [];

    return NextResponse.json({
      success: true,
      data: { accounts, activeAccount, locations, selectedLocation: account.locationName || '' },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load Google Business locations');
  }
}
