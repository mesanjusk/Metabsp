import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import StoreProfile from '@/lib/models/StoreProfile';
import crypto from 'crypto';
import { normalizeStoreDomain, storeSlug } from '@/lib/store/helpers';
import { defaultStoreProfile, ensureStoreProfile, storeProfileResponse } from '@/lib/store/profile';

export async function GET(req: NextRequest) {
  try {
    await connectDB(); const authed = await requireAuth(req);
    // Loading settings must stay read-only. PR #140 created a missing profile
    // here, which made the whole Store overview depend on a successful write
    // before it could render for an existing account. A profile is persisted
    // on signup or the first Save; until then this deterministic draft is enough.
    const profile: any = await StoreProfile.findOne({ ownerUserId: authed.doc._id }).select('+domainVerificationToken').lean();
    const value = profile || defaultStoreProfile(authed.doc);
    return NextResponse.json({ success: true, data: { ...storeProfileResponse(value, authed.doc), domainVerificationToken: profile?.domainVerificationToken || '' } });
  } catch (error) { return errorResponse(error, 'Failed to load store settings'); }
}

export async function PUT(req: NextRequest) {
  try {
    await connectDB(); const authed = await requireAuth(req); const body = await req.json();
    const name = String(body.name || '').trim(); if (!name) return NextResponse.json({ success: false, message: 'Store name is required' }, { status: 400 });
    const slug = storeSlug(body.slug, `store-${authed.id.slice(-6)}`);
    const collision = await StoreProfile.findOne({ slug, ownerUserId: { $ne: authed.doc._id } }).select('_id').lean();
    if (collision) return NextResponse.json({ success: false, message: 'This store address is already in use' }, { status: 409 });
    const current: any = await ensureStoreProfile(authed.doc, authed.tenantId);
    const requestedDomain = body.customDomain === undefined ? String(current.customDomain || '') : normalizeStoreDomain(body.customDomain);
    if (body.customDomain && !requestedDomain) return NextResponse.json({ success: false, message: 'Enter a valid domain such as shop.example.com' }, { status: 400 });
    if (requestedDomain === 'meta.sanjusk.in' || requestedDomain.endsWith('.meta.sanjusk.in') || requestedDomain.endsWith('.onrender.com')) return NextResponse.json({ success: false, message: 'Use your own domain here. Your MetaBSP subdomain is created automatically.' }, { status: 400 });
    const domainChanged = requestedDomain !== String(current.customDomain || '');
    const data: any = { tenantId: authed.tenantId || null, slug, name: name.slice(0, 100), tagline: String(body.tagline || '').trim().slice(0, 180), description: String(body.description || '').trim().slice(0, 1200), logoUrl: String(body.logoUrl || '').trim(), heroImageUrl: String(body.heroImageUrl || '').trim(), accentColor: /^#[0-9a-f]{6}$/i.test(body.accentColor) ? body.accentColor : '#5b4bdb', whatsapp: String(body.whatsapp || '').replace(/[^0-9]/g, '').slice(0, 16), phone: String(body.phone || '').trim().slice(0, 24), email: String(body.email || '').trim().slice(0, 160), address: String(body.address || '').trim().slice(0, 500), currency: ['INR','USD','GBP','EUR','AED'].includes(body.currency) ? body.currency : 'INR', isPublished: Boolean(body.isPublished) };
    if (requestedDomain) data.customDomain = requestedDomain;
    if (domainChanged) Object.assign(data, { domainVerificationToken: requestedDomain ? `metabsp-${crypto.randomBytes(16).toString('hex')}` : '', domainStatus: requestedDomain ? 'pending' : 'none', domainError: '', domainVerifiedAt: null });
    const profile = await StoreProfile.findOneAndUpdate({ ownerUserId: authed.doc._id }, { $set: data, ...(!requestedDomain ? { $unset: { customDomain: 1 } } : {}) }, { new: true, runValidators: true }).select('+domainVerificationToken').lean();
    return NextResponse.json({ success: true, data: { ...storeProfileResponse(profile), domainVerificationToken: profile?.domainVerificationToken || '' } });
  } catch (error: any) {
    if (error?.code === 11000) return NextResponse.json({ success: false, message: 'That store address or custom domain is already connected to another account.' }, { status: 409 });
    return errorResponse(error, 'Failed to save store settings');
  }
}
