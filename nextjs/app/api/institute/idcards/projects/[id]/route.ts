import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { InstituteIDCardProject } from '@/lib/models';
import { instituteScope, projectDto } from '@/lib/institute/idCards';

function refFilter(id: string) {
  const value = String(id || '').trim();
  return mongoose.isValidObjectId(value) ? { $or: [{ _id: value }, { projectUuid: value }] } : { projectUuid: value };
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await context.params;
    const project: any = await InstituteIDCardProject.findOne({ ...instituteScope(authed), archived: { $ne: true }, ...refFilter(id) }).lean();
    if (!project) return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: projectDto(project) });
  } catch (error) { return errorResponse(error, 'Failed to load ID card project'); }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await context.params;
    const body: any = await req.json().catch(() => ({}));
    const project: any = await InstituteIDCardProject.findOne({ ...instituteScope(authed), archived: { $ne: true }, ...refFilter(id) });
    if (!project) return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
    if (body.title !== undefined) project.title = String(body.title || '').trim() || project.title;
    if (body.academic_year !== undefined || body.academicYear !== undefined) project.academicYear = String(body.academic_year ?? body.academicYear ?? '');
    if (body.design_id !== undefined || body.designId !== undefined) project.designId = body.design_id ?? body.designId ?? null;
    if (body.principal_signature_url !== undefined || body.principalSignatureUrl !== undefined) project.principalSignatureUrl = String(body.principal_signature_url ?? body.principalSignatureUrl ?? '');
    if (body.status !== undefined && ['active', 'completed'].includes(body.status)) project.status = body.status;
    project.updatedBy = authed.id;
    await project.save();
    return NextResponse.json({ success: true, data: projectDto(project) });
  } catch (error) { return errorResponse(error, 'Failed to update ID card project'); }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await context.params;
    const project: any = await InstituteIDCardProject.findOne({ ...instituteScope(authed), archived: { $ne: true }, ...refFilter(id) });
    if (!project) return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
    project.archived = true; project.updatedBy = authed.id; await project.save();
    return NextResponse.json({ success: true, message: 'Project archived' });
  } catch (error) { return errorResponse(error, 'Failed to archive ID card project'); }
}
