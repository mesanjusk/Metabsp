import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import StoreProfile from '@/lib/models/StoreProfile';
import { storeSlug } from '@/lib/store/helpers';

export async function GET(req: NextRequest) {
  try {
    await connectDB(); const authed = await requireAuth(req);
    const profile = await StoreProfile.findOne({ ownerUserId: authed.doc._id }).lean();
    return NextResponse.json({ success: true, data: profile || { name: authed.doc.name || 'My Store', slug: storeSlug(authed.doc.name, `store-${authed.id.slice(-6)}`), tagline: '', description: '', currency: 'INR', accentColor: '#5b4bdb', isPublished: false } });
  } catch (error) { return errorResponse(error, 'Failed to load store settings'); }
}

export async function PUT(req: NextRequest) {
  try {
    await connectDB(); const authed = await requireAuth(req); const body = await req.json();
    const name = String(body.name || '').trim(); if (!name) return NextResponse.json({ success: false, message: 'Store name is required' }, { status: 400 });
    const slug = storeSlug(body.slug, `store-${authed.id.slice(-6)}`);
    const collision = await StoreProfile.findOne({ slug, ownerUserId: { $ne: authed.doc._id } }).select('_id').lean();
    if (collision) return NextResponse.json({ success: false, message: 'This store address is already in use' }, { status: 409 });
    const data = { tenantId: authed.tenantId || null, slug, name: name.slice(0, 100), tagline: String(body.tagline || '').trim().slice(0, 180), description: String(body.description || '').trim().slice(0, 1200), logoUrl: String(body.logoUrl || '').trim(), heroImageUrl: String(body.heroImageUrl || '').trim(), accentColor: /^#[0-9a-f]{6}$/i.test(body.accentColor) ? body.accentColor : '#5b4bdb', whatsapp: String(body.whatsapp || '').replace(/[^0-9]/g, '').slice(0, 16), phone: String(body.phone || '').trim().slice(0, 24), email: String(body.email || '').trim().slice(0, 160), address: String(body.address || '').trim().slice(0, 500), currency: ['INR','USD','GBP','EUR','AED'].includes(body.currency) ? body.currency : 'INR', isPublished: Boolean(body.isPublished) };
    const profile = await StoreProfile.findOneAndUpdate({ ownerUserId: authed.doc._id }, { $set: data, $setOnInsert: { ownerUserId: authed.doc._id } }, { upsert: true, new: true, runValidators: true }).lean();
    return NextResponse.json({ success: true, data: profile });
  } catch (error) { return errorResponse(error, 'Failed to save store settings'); }
}
