import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { errorResponse } from '@/lib/http/errorResponse';
import StoreProfile from '@/lib/models/StoreProfile';
import StoreProduct from '@/lib/models/StoreProduct';
import StoreCategory from '@/lib/models/StoreCategory';
import { normalizeStoreDomain } from '@/lib/store/helpers';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const host = normalizeStoreDomain(req.nextUrl.searchParams.get('host') || req.headers.get('host'));
    const profile: any = host ? await StoreProfile.findOne({ customDomain: host, domainStatus: 'active', isPublished: true }).lean() : null;
    if (!profile) return NextResponse.json({ success: false, message: 'Store domain is not active.' }, { status: 404 });
    const [products, categories] = await Promise.all([StoreProduct.find({ ownerUserId: profile.ownerUserId, isActive: true }).sort({ isFeatured: -1, createdAt: -1 }).lean(), StoreCategory.find({ ownerUserId: profile.ownerUserId, isActive: true }).sort({ order: 1, name: 1 }).lean()]);
    return NextResponse.json({ success: true, data: { profile: { name: profile.name, slug: profile.slug, tagline: profile.tagline, description: profile.description, logoUrl: profile.logoUrl, heroImageUrl: profile.heroImageUrl, accentColor: profile.accentColor, whatsapp: profile.whatsapp, phone: profile.phone, email: profile.email, address: profile.address, currency: profile.currency }, products, categories } });
  } catch (error) { return errorResponse(error, 'Failed to load store'); }
}
