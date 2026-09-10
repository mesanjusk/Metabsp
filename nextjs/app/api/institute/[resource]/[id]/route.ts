import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { InstituteRecord } from '@/lib/models';
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

async function findOwned(authed: any, resource: string, id: string) {
  const filter: any = { ...scopeFor(authed), entityType: resource };
  if (mongoose.Types.ObjectId.isValid(id)) {
    filter._id = id;
  } else {
    filter.legacyId = id;
  }
  return InstituteRecord.findOne(filter);
}

export async function GET(req: NextRequest, context: { params: Promise<{ resource: string; id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { resource, id } = await context.params;
    const normalized = String(resource || '').toLowerCase();
    if (!isInstituteResource(normalized)) {
      return NextResponse.json({ success: false, message: 'Unknown institute resource' }, { status: 404 });
    }
    const record = await findOwned(authed, normalized, id);
    if (!record) return NextResponse.json({ success: false, message: 'Record not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    return errorResponse(error, 'Failed to load institute record');
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ resource: string; id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { resource, id } = await context.params;
    const normalized = String(resource || '').toLowerCase();
    if (!isInstituteResource(normalized)) {
      return NextResponse.json({ success: false, message: 'Unknown institute resource' }, { status: 404 });
    }
    const record: any = await findOwned(authed, normalized, id);
    if (!record) return NextResponse.json({ success: false, message: 'Record not found' }, { status: 404 });

    const patch = cleanPayload(await req.json().catch(() => ({})));
    const nextPayload = { ...(record.payload || {}), ...patch };
    record.payload = nextPayload;
    if (typeof patch.archived === 'boolean') record.archived = patch.archived;
    await record.save();

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    return errorResponse(error, 'Failed to update institute record');
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ resource: string; id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { resource, id } = await context.params;
    const normalized = String(resource || '').toLowerCase();
    if (!isInstituteResource(normalized)) {
      return NextResponse.json({ success: false, message: 'Unknown institute resource' }, { status: 404 });
    }
    const record = await findOwned(authed, normalized, id);
    if (!record) return NextResponse.json({ success: false, message: 'Record not found' }, { status: 404 });
    await record.deleteOne();
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Failed to delete institute record');
  }
}
