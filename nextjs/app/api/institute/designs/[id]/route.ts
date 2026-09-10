import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { InstituteDesign } from '@/lib/models';
import { instituteScope } from '@/lib/institute/idCards';

function refFilter(id: string) {
  const v = String(id || '').trim();
  return mongoose.isValidObjectId(v) ? { $or: [{ _id: v }, { designUuid: v }] } : { designUuid: v };
}
function dto(row: any) {
  return { _id: String(row._id), design_uuid: row.designUuid, name: row.name, docType: row.docType, width: row.width, height: row.height, canvas: row.canvas || {}, thumbnail: row.thumbnail || '', createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB(); const authed = await requireAuth(req); const { id } = await context.params;
    const row: any = await InstituteDesign.findOne({ ...instituteScope(authed), archived: { $ne: true }, ...refFilter(id) }).lean();
    if (!row) return NextResponse.json({ success: false, message: 'Design not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: dto(row) });
  } catch (error) { return errorResponse(error, 'Failed to load design'); }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB(); const authed = await requireAuth(req); const { id } = await context.params;
    const body: any = await req.json().catch(() => ({}));
    const row: any = await InstituteDesign.findOne({ ...instituteScope(authed), archived: { $ne: true }, ...refFilter(id) });
    if (!row) return NextResponse.json({ success: false, message: 'Design not found' }, { status: 404 });
    if (body.name !== undefined) row.name = String(body.name || 'Untitled Design');
    if (body.width !== undefined) row.width = Math.max(100, Number(body.width));
    if (body.height !== undefined) row.height = Math.max(100, Number(body.height));
    if (body.canvas !== undefined) row.canvas = body.canvas;
    if (body.thumbnail !== undefined) row.thumbnail = String(body.thumbnail || '');
    row.updatedBy = authed.id; await row.save();
    return NextResponse.json({ success: true, data: dto(row) });
  } catch (error) { return errorResponse(error, 'Failed to save design'); }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB(); const authed = await requireAuth(req); const { id } = await context.params;
    const row: any = await InstituteDesign.findOne({ ...instituteScope(authed), archived: { $ne: true }, ...refFilter(id) });
    if (!row) return NextResponse.json({ success: false, message: 'Design not found' }, { status: 404 });
    row.archived = true; row.updatedBy = authed.id; await row.save();
    return NextResponse.json({ success: true });
  } catch (error) { return errorResponse(error, 'Failed to delete design'); }
}
