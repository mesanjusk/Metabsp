import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import Contact from '@/lib/models/Contact';
import SmbRecord from '@/lib/models/SmbRecord';
import { requireSmbKindAccess } from '@/lib/services/smbAccess';

const TRANSITIONS: Record<string, string[]> = {
  lead: ['followup', 'quotation'],
  followup: ['quotation'],
  quotation: ['order'],
  order: ['invoice', 'payment'],
};

const CATEGORY: Record<string, string> = {
  followup: 'Follow-up',
  quotation: 'Quotation',
  order: 'Converted',
};

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ success: false, message: 'Invalid record id' }, { status: 400 });
    }

    const body = await req.json();
    const targetKind = String(body?.targetKind || '').trim().toLowerCase();
    const source: any = await SmbRecord.findOne({ _id: id, userId: authed.doc._id });
    if (!source) return NextResponse.json({ success: false, message: 'Record not found' }, { status: 404 });
    await requireSmbKindAccess(authed, source.kind);

    if (!(TRANSITIONS[source.kind] || []).includes(targetKind)) {
      return NextResponse.json({ success: false, message: `Cannot convert ${source.kind} to ${targetKind}` }, { status: 400 });
    }
    await requireSmbKindAccess(authed, targetKind);

    const targetStatus = targetKind === 'payment' ? 'received' : 'open';
    const created: any = await SmbRecord.create({
      userId: authed.doc._id,
      contactId: source.contactId || null,
      parentId: source._id,
      kind: targetKind,
      title: source.title,
      status: targetStatus,
      source: source.source,
      reference: source.reference,
      assignedTo: source.assignedTo,
      amountInPaise: source.amountInPaise,
      balanceInPaise: targetKind === 'payment' ? 0 : source.balanceInPaise,
      data: { ...(source.data || {}), convertedFrom: source.kind },
    });

    source.status = 'completed';
    source.completedAt = new Date();
    if (source.kind === 'order' && targetKind === 'payment') source.balanceInPaise = 0;
    source.data = { ...(source.data || {}), convertedTo: targetKind };
    await source.save();

    if (source.contactId && CATEGORY[targetKind]) {
      await Contact.updateOne(
        { _id: source.contactId, userId: authed.doc._id },
        { $set: { category: CATEGORY[targetKind] } }
      );
    }

    const populated = await SmbRecord.findById(created._id)
      .populate('contactId', 'name phone email company category assignedAgent')
      .lean();
    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to convert business record');
  }
}
