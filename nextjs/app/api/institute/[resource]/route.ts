import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { Contact, InstituteRecord } from '@/lib/models';
import { isInstituteResource } from '@/lib/institute/resources';

function scopeFor(authed: any) {
  return authed.tenantId
    ? { tenantId: authed.tenantId }
    : { tenantId: null, ownerUserId: authed.id };
}

function cleanPayload(body: any) {
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? { ...body } : {};
  delete payload._id;
  delete payload.tenantId;
  delete payload.ownerUserId;
  delete payload.entityType;
  delete payload.createdAt;
  delete payload.updatedAt;
  return payload;
}

function legacyIdFrom(payload: any) {
  return String(
    payload.uuid ||
      payload.Lead_uuid ||
      payload.Course_uuid ||
      payload.Attendance_uuid ||
      payload.Transaction_uuid ||
      payload.id ||
      ''
  ).trim();
}

async function syncSharedContact(authed: any, resource: string, payload: any) {
  if (!['students', 'leads'].includes(resource)) return;

  const phone = String(
    payload.mobileSelf || payload.mobileParent || payload.phone || payload.mobile || payload.Mobile_number || ''
  ).replace(/\D/g, '');
  if (!phone) return;

  const fullName = String(
    payload.name ||
      [payload.firstName, payload.middleName, payload.lastName].filter(Boolean).join(' ') ||
      payload.studentName ||
      ''
  ).trim();

  const existing = await Contact.findOne({ userId: authed.id, phone });
  if (existing) {
    existing.name = fullName || existing.name;
    existing.category = resource === 'leads' ? 'Lead' : existing.category || 'Student';
    existing.customFields = {
      ...(existing.customFields || {}),
      instituteResource: resource,
      instituteLegacyId: legacyIdFrom(payload),
    };
    await existing.save();
    return;
  }

  await Contact.create({
    userId: authed.id,
    phone,
    name: fullName,
    category: resource === 'leads' ? 'Lead' : 'Student',
    customFields: {
      instituteResource: resource,
      instituteLegacyId: legacyIdFrom(payload),
    },
  });
}

export async function GET(req: NextRequest, context: { params: Promise<{ resource: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { resource } = await context.params;
    const normalized = String(resource || '').toLowerCase();
    if (!isInstituteResource(normalized)) {
      return NextResponse.json({ success: false, message: 'Unknown institute resource' }, { status: 404 });
    }

    const url = new URL(req.url);
    const q = String(url.searchParams.get('q') || '').trim();
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 50)));
    const includeArchived = url.searchParams.get('archived') === '1';

    const filter: any = { ...scopeFor(authed), entityType: normalized };
    if (!includeArchived) filter.archived = { $ne: true };
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { legacyId: rx },
        { 'payload.name': rx },
        { 'payload.firstName': rx },
        { 'payload.lastName': rx },
        { 'payload.studentName': rx },
        { 'payload.mobileSelf': rx },
        { 'payload.mobileParent': rx },
        { 'payload.phone': rx },
        { 'payload.course': rx },
      ];
    }

    const [items, total] = await Promise.all([
      InstituteRecord.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      InstituteRecord.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load institute records');
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ resource: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { resource } = await context.params;
    const normalized = String(resource || '').toLowerCase();
    if (!isInstituteResource(normalized)) {
      return NextResponse.json({ success: false, message: 'Unknown institute resource' }, { status: 404 });
    }

    const payload = cleanPayload(await req.json().catch(() => ({})));
    const record = await InstituteRecord.create({
      ...scopeFor(authed),
      ownerUserId: authed.id,
      entityType: normalized,
      legacyId: legacyIdFrom(payload),
      payload,
      source: payload.__source === 'instify' ? 'instify' : 'metabsp',
    });

    await syncSharedContact(authed, normalized, payload);

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to create institute record');
  }
}
