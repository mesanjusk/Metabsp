import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import StoreProfile from '@/lib/models/StoreProfile';
import { STORE_DOMAIN_CNAME_TARGET } from '@/lib/store/helpers';
import { provisionRenderDomain, verifyStoreDns } from '@/lib/store/domains';
import { storeProfileResponse } from '@/lib/store/profile';

export async function POST(req: NextRequest) {
  try {
    await connectDB(); const authed = await requireAuth(req);
    const profile: any = await StoreProfile.findOne({ ownerUserId: authed.doc._id }).select('+domainVerificationToken');
    if (!profile?.customDomain || !profile.domainVerificationToken) return NextResponse.json({ success: false, message: 'Save a custom domain first.' }, { status: 400 });
    const dns = await verifyStoreDns(profile.customDomain, profile.domainVerificationToken);
    if (!dns.valid) {
      profile.domainStatus = 'pending';
      profile.domainError = `${!dns.cname ? `CNAME must point to ${STORE_DOMAIN_CNAME_TARGET}. ` : ''}${!dns.txt ? 'Verification TXT record was not found.' : ''}`.trim();
      await profile.save();
      return NextResponse.json({ success: false, message: profile.domainError, data: storeProfileResponse(profile) }, { status: 409 });
    }
    const hosted = await provisionRenderDomain(profile.customDomain);
    profile.domainStatus = hosted.active ? 'active' : 'dns_verified';
    profile.domainVerifiedAt = new Date();
    profile.domainError = hosted.message;
    await profile.save();
    return NextResponse.json({ success: true, active: hosted.active, message: hosted.active ? 'Custom domain is active with HTTPS.' : hosted.message, data: storeProfileResponse(profile) });
  } catch (error) { return errorResponse(error, 'Could not verify the custom domain'); }
}
