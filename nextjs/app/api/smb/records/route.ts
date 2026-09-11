import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import Contact from '@/lib/models/Contact';
import SmbRecord, { SMB_RECORD_KINDS } from '@/lib/models/SmbRecord';

const VALID_KINDS = new Set<string>(SMB_RECORD_KINDS as readonly string[]);
const CLOSED = new Set(['completed', 'paid', 'done', 'closed', 'cancelled', 'lost', 'rejected']);

function numberToPaise(value: unknown) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100);
}

function cleanPhone(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

function parseDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

async function resolveContact(userId: any, body: any) {
  if (body.contactId && mongoose.isValidObjectId(body.contactId)) {
    return Contact.findOne({ _id: body.contactId, userId });
  }

  const phone = cleanPhone(body.customerPhone);
  if (!phone) return null;

  let contact = await Contact.findOne({ userId, phone });
  if (!contact) {
    contact = await Contact.create({
      userId,
      phone,
      name: String(body.customerName || '').trim(),
      category: body.kind === 'lead' ? 'New' : '',
    });
  } else if (!contact.name && body.customerName) {
    contact.name = String(body.customerName).trim();
    await contact.save();
  }
  return contact;
}

function categoryFor(kind: string, status: string, stage = '') {
  if (kind === 'lead') return stage || 'New';
  if (kind === 'followup') return 'Follow-up';
  if (kind === 'quotation') return ['rejected', 'lost'].includes(status) ? 'Lost' : 'Quotation';
  if (kind === 'order' && !['cancelled', 'lost'].includes(status)) return 'Converted';
  return '';
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const url = new URL(req.url);
    const kind = url.searchParams.get('kind');
    const status = url.searchParams.get('status');
    const contactId = url.searchParams.get('contactId');
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 100), 1), 250);

    const query: any = { userId: authed.doc._id };
    if (kind) {
      const kinds = kind.split(',').map((item) => item.trim()).filter((item) => VALID_KINDS.has(item));
      if (kinds.length) query.kind = { $in: kinds };
    }
    if (status) query.status = status.trim().toLowerCase();
    if (contactId && mongoose.isValidObjectId(contactId)) query.contactId = contactId;

    const records = await SmbRecord.find(query)
      .sort({ dueAt: 1, createdAt: -1 })
      .limit(limit)
      .populate('contactId', 'name phone email company category assignedAgent')
      .lean();

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    return errorResponse(error, 'Failed to load business records');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body = await req.json();
    const kind = String(body.kind || '').trim().toLowerCase();
    if (!VALID_KINDS.has(kind)) {
      return NextResponse.json({ success: false, message: 'Invalid business record type' }, { status: 400 });
    }

    const title = String(body.title || '').trim();
    if (!title) return NextResponse.json({ success: false, message: 'Title is required' }, { status: 400 });

    const contact = await resolveContact(authed.doc._id, body);
    const status = String(body.status || 'open').trim().toLowerCase();
    const amountInPaise = body.amountInPaise != null ? Math.max(0, Number(body.amountInPaise || 0)) : numberToPaise(body.amount);
    const balanceInPaise = body.balanceInPaise != null
      ? Math.max(0, Number(body.balanceInPaise || 0))
      : (body.balance != null ? numberToPaise(body.balance) : amountInPaise);

    const record = await SmbRecord.create({
      userId: authed.doc._id,
      contactId: contact?._id || null,
      parentId: mongoose.isValidObjectId(body.parentId) ? body.parentId : null,
      kind,
      title,
      status,
      stage: String(body.stage || '').trim(),
      source: String(body.source || '').trim(),
      reference: String(body.reference || '').trim(),
      assignedTo: String(body.assignedTo || '').trim(),
      amountInPaise,
      balanceInPaise,
      quantity: Math.max(0, Number(body.quantity || 0)),
      dueAt: parseDate(body.dueAt),
      completedAt: CLOSED.has(status) ? new Date() : null,
      data: body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {},
    });

    const category = contact ? categoryFor(kind, status, String(body.stage || '').trim()) : '';
    if (contact && category) {
      contact.category = category;
      if (body.assignedTo) contact.assignedAgent = String(body.assignedTo).trim();
      await contact.save();
    }

    const populated = await SmbRecord.findById(record._id)
      .populate('contactId', 'name phone email company category assignedAgent')
      .lean();

    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to create business record');
  }
}
