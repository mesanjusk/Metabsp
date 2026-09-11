import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import Contact from '@/lib/models/Contact';
import SmbRecord from '@/lib/models/SmbRecord';
import { requireSmbKindAccess } from '@/lib/services/smbAccess';

const EDITABLE = new Set([
  'title', 'status', 'stage', 'source', 'reference', 'assignedTo', 'amountInPaise',
  'balanceInPaise', 'quantity', 'dueAt', 'data', 'parentId',
]);

function categoryFor(kind: string, status: string, stage = '') {
  if (kind === 'lead') return stage || 'New';
  if (kind === 'followup') return 'Follow-up';
  if (kind === 'quotation') return ['rejected', 'lost'].includes(status) ? 'Lost' : 'Quotation';
  if (kind === 'order' && !['cancelled', 'lost'].includes(status)) return 'Converted';
  return '';
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, message: 'Invalid record id' }, { status: 400 });

    const existing: any = await SmbRecord.findOne({ _id: id, userId: authed.doc._id }).select('kind').lean();
    if (!existing) return NextResponse.json({ success: false, message: 'Record not found' }, { status: 404 });
    await requireSmbKindAccess(authed, existing.kind);

    const body = await req.json();
    const update: any = {};
    for (const [key, value] of Object.entries(body || {})) if (EDITABLE.has(key)) update[key] = value;
    if (typeof update.status === 'string') update.status = update.status.trim().toLowerCase();
    if (typeof update.stage === 'string') update.stage = update.stage.trim().toLowerCase();
    if (typeof update.source === 'string') update.source = update.source.trim().toLowerCase();
    if (update.dueAt === '') update.dueAt = null;

    if (Object.prototype.hasOwnProperty.call(update, 'parentId')) {
      if (!update.parentId || !mongoose.isValidObjectId(update.parentId)) update.parentId = null;
      else {
        const ownedParent: any = await SmbRecord.findOne({ _id: update.parentId, userId: authed.doc._id }).select('_id kind').lean();
        if (ownedParent) await requireSmbKindAccess(authed, ownedParent.kind);
        update.parentId = ownedParent?._id || null;
      }
    }

    if (['completed', 'paid', 'done', 'closed'].includes(update.status)) update.completedAt = new Date();
    if (['open', 'pending', 'new', 'active'].includes(update.status)) update.completedAt = null;

    const record: any = await SmbRecord.findOneAndUpdate(
      { _id: id, userId: authed.doc._id },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!record) return NextResponse.json({ success: false, message: 'Record not found' }, { status: 404 });

    if (record.contactId) {
      const category = categoryFor(record.kind, record.status, record.stage);
      if (category) {
        await Contact.updateOne(
          { _id: record.contactId, userId: authed.doc._id },
          { $set: { category, ...(record.assignedTo ? { assignedAgent: record.assignedTo } : {}) } }
        );
      }
    }

    const populated = await SmbRecord.findById(record._id)
      .populate('contactId', 'name phone email company category assignedAgent')
      .lean();
    return NextResponse.json({ success: true, data: populated });
  } catch (error) {
    return errorResponse(error, 'Failed to update business record');
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, message: 'Invalid record id' }, { status: 400 });
    const existing: any = await SmbRecord.findOne({ _id: id, userId: authed.doc._id }).select('kind').lean();
    if (!existing) return NextResponse.json({ success: false, message: 'Record not found' }, { status: 404 });
    await requireSmbKindAccess(authed, existing.kind);
    const deleted = await SmbRecord.findOneAndDelete({ _id: id, userId: authed.doc._id });
    if (!deleted) return NextResponse.json({ success: false, message: 'Record not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Failed to delete business record');
  }
}
