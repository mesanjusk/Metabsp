import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { InstituteIDCardStudent } from '@/lib/models';
import { createMagicToken, idCardPublicBaseUrl, instituteScope, studentDto } from '@/lib/institute/idCards';

function refFilter(id: string) {
  const v = String(id || '').trim();
  return mongoose.isValidObjectId(v) ? { $or: [{ _id: v }, { idcardUuid: v }] } : { idcardUuid: v };
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB(); const authed = await requireAuth(req); const { id } = await context.params;
    const row: any = await InstituteIDCardStudent.findOne({ ...instituteScope(authed), archived: { $ne: true }, ...refFilter(id) }).lean();
    if (!row) return NextResponse.json({ success: false, message: 'Student not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: studentDto(row) });
  } catch (error) { return errorResponse(error, 'Failed to load ID card student'); }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB(); const authed = await requireAuth(req); const { id } = await context.params;
    const body: any = await req.json().catch(() => ({}));
    const row: any = await InstituteIDCardStudent.findOne({ ...instituteScope(authed), archived: { $ne: true }, ...refFilter(id) });
    if (!row) return NextResponse.json({ success: false, message: 'Student not found' }, { status: 404 });
    if (body.student_name !== undefined) row.studentName = String(body.student_name || '').trim() || row.studentName;
    if (body.class_name !== undefined) row.className = String(body.class_name || '');
    if (body.section !== undefined) row.section = String(body.section || '');
    if (body.roll_number !== undefined) row.rollNumber = String(body.roll_number || '');
    if (body.photo_url !== undefined) { row.photoUrl = String(body.photo_url || ''); row.photoSource = body.photo_source || 'teacher'; }
    if (body.bg_removed_url !== undefined) row.bgRemovedUrl = String(body.bg_removed_url || '');
    if (body.use_bg_removed !== undefined) row.useBgRemoved = Boolean(body.use_bg_removed);
    if (body.card_status !== undefined && ['pending','not_available','student_submitted','approved'].includes(body.card_status)) row.cardStatus = body.card_status;
    if (body.action === 'approve') { row.cardStatus = 'approved'; row.approvedBy = authed.id; row.approvedAt = new Date(); }
    if (body.action === 'reject') { row.cardStatus = 'pending'; row.approvedBy = null; row.approvedAt = null; }
    if (body.action === 'magic-link') {
      row.magicToken = createMagicToken(); row.magicTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await row.save();
      return NextResponse.json({ success: true, data: studentDto(row), link: `${idCardPublicBaseUrl(req)}/idcard-preview/${row.magicToken}` });
    }
    await row.save();
    return NextResponse.json({ success: true, data: studentDto(row) });
  } catch (error) { return errorResponse(error, 'Failed to update ID card student'); }
}
