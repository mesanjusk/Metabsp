import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import BusinessProfile from '@/lib/models/BusinessProfile';
import { isBusinessType, recommendedServices } from '@/lib/smb/businessProfiles';
import { SERVICE_SLUGS } from '@/lib/services/serviceAccess';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const profile = await BusinessProfile.findOne({ userId: authed.doc._id }).lean();
    return NextResponse.json({ success: true, data: profile || null });
  } catch (error) {
    return errorResponse(error, 'Failed to load business profile');
  }
}

export async function PUT(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body = await req.json();
    const businessType = String(body?.businessType || '');
    if (!isBusinessType(businessType)) {
      return NextResponse.json({ success: false, message: 'Choose a valid business type.' }, { status: 400 });
    }

    const allowedSlugs = new Set(SERVICE_SLUGS);
    const defaults = recommendedServices(businessType);
    const requested = Array.isArray(body?.selectedServices) ? body.selectedServices.map(String) : defaults;
    const selectedServices = Array.from(new Set(requested.filter((slug) => allowedSlugs.has(slug as any))));
    for (const slug of defaults) {
      if (allowedSlugs.has(slug as any) && !selectedServices.includes(slug)) selectedServices.push(slug);
    }

    const values = {
      businessType,
      businessName: String(body?.businessName || '').trim().slice(0, 120),
      teamSize: ['solo', '2-5', '6-20', '21-50', '50+'].includes(String(body?.teamSize)) ? String(body.teamSize) : 'solo',
      selectedServices,
      completedAt: new Date(),
    };

    let profile = await BusinessProfile.findOne({ userId: authed.doc._id });
    if (profile) {
      profile.set(values);
      await profile.save();
    } else {
      profile = await BusinessProfile.create({ userId: authed.doc._id, ...values });
    }

    return NextResponse.json({ success: true, data: profile.toObject() });
  } catch (error) {
    return errorResponse(error, 'Failed to save business profile');
  }
}
