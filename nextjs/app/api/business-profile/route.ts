import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import SmbRecord from '@/lib/models/SmbRecord';
import { isBusinessType, recommendedServices } from '@/lib/smb/businessProfiles';
import { SERVICE_SLUGS } from '@/lib/services/serviceAccess';

function profileFromRecord(record: any) {
  if (!record) return null;
  const data = record.data || {};
  return {
    _id: record._id,
    userId: record.userId,
    businessType: data.businessType || '',
    businessName: data.businessName || '',
    teamSize: data.teamSize || 'solo',
    selectedServices: Array.isArray(data.selectedServices) ? data.selectedServices : [],
    completedAt: record.completedAt || data.completedAt || record.updatedAt || record.createdAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const record = await SmbRecord.findOne({ userId: authed.doc._id, kind: 'business_profile' }).lean();
    return NextResponse.json({ success: true, data: profileFromRecord(record) });
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

    const completedAt = new Date();
    const data = {
      businessType,
      businessName: String(body?.businessName || '').trim().slice(0, 120),
      teamSize: ['solo', '2-5', '6-20', '21-50', '50+'].includes(String(body?.teamSize)) ? String(body.teamSize) : 'solo',
      selectedServices,
      completedAt,
    };

    let record = await SmbRecord.findOne({ userId: authed.doc._id, kind: 'business_profile' });
    if (record) {
      record.title = 'Business profile';
      record.status = 'completed';
      record.completedAt = completedAt;
      record.data = data;
      await record.save();
    } else {
      record = await SmbRecord.create({
        userId: authed.doc._id,
        kind: 'business_profile',
        title: 'Business profile',
        status: 'completed',
        completedAt,
        data,
      });
    }

    return NextResponse.json({ success: true, data: profileFromRecord(record.toObject()) });
  } catch (error) {
    return errorResponse(error, 'Failed to save business profile');
  }
}
