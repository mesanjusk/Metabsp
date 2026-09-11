import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import SmbRecord from '@/lib/models/SmbRecord';

const PRINTABLE_KINDS = new Set(['quotation', 'order', 'invoice', 'payment', 'expense']);

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function money(paise: unknown) {
  const amount = Math.round(Number(paise || 0)) / 100;
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function documentLabel(kind: string) {
  if (kind === 'quotation') return 'QUOTATION';
  if (kind === 'order') return 'ORDER / JOB SHEET';
  if (kind === 'invoice') return 'INVOICE';
  if (kind === 'payment') return 'PAYMENT RECEIPT';
  if (kind === 'expense') return 'EXPENSE VOUCHER';
  return kind.toUpperCase();
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  await connectDB();
  const authed = await requireAuth(req);
  const { id } = await context.params;

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ success: false, message: 'Invalid record id' }, { status: 400 });
  }

  const record: any = await SmbRecord.findOne({ _id: id, userId: authed.doc._id })
    .populate('contactId', 'name phone email company')
    .lean();

  if (!record) return NextResponse.json({ success: false, message: 'Record not found' }, { status: 404 });
  if (!PRINTABLE_KINDS.has(record.kind)) {
    return NextResponse.json({ success: false, message: 'This record does not have a printable business document' }, { status: 400 });
  }

  const owner: any = authed.doc;
  const businessName = escapeHtml(owner.businessName || owner.company || owner.name || 'Business');
  const customer = record.contactId || {};
  const createdAt = new Date(record.createdAt).toLocaleString('en-IN');
  const dueAt = record.dueAt ? new Date(record.dueAt).toLocaleString('en-IN') : '—';
  const reference = record.reference || String(record._id).slice(-8).toUpperCase();
  const label = documentLabel(record.kind);

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(label)} ${escapeHtml(reference)}</title>
<style>
  *{box-sizing:border-box} body{margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#17202a}
  .sheet{width:min(900px,calc(100% - 24px));margin:24px auto;background:#fff;padding:42px;border:1px solid #e5e7eb;border-radius:16px}
  .top{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}.brand{font-size:26px;font-weight:800}.label{font-size:24px;font-weight:800;letter-spacing:.06em;text-align:right}
  .muted{color:#667085;font-size:13px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:30px}.box{border:1px solid #e5e7eb;border-radius:12px;padding:16px}
  .title{font-weight:800;font-size:18px;margin:30px 0 8px}.row{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #eef0f3;padding:11px 0}.row:last-child{border-bottom:0}.total{font-size:20px;font-weight:800}
  .actions{text-align:center;margin:18px}.actions button{padding:10px 18px;border:0;border-radius:8px;background:#111827;color:#fff;cursor:pointer}
  @media(max-width:640px){.sheet{padding:24px}.top{flex-direction:column}.label{text-align:left}.grid{grid-template-columns:1fr}}
  @media print{body{background:#fff}.sheet{border:0;border-radius:0;margin:0;width:100%;padding:18mm}.actions{display:none}}
</style>
</head>
<body>
<div class="actions"><button onclick="window.print()">Print / Save PDF</button></div>
<main class="sheet">
  <section class="top">
    <div><div class="brand">${businessName}</div><div class="muted">Small Business Digital OS</div></div>
    <div><div class="label">${escapeHtml(label)}</div><div class="muted">Ref: ${escapeHtml(reference)}</div></div>
  </section>
  <section class="grid">
    <div class="box"><strong>Customer</strong><div style="margin-top:8px">${escapeHtml(customer.name || 'Walk-in / unassigned')}</div><div class="muted">${escapeHtml(customer.phone || '')}${customer.email ? ` · ${escapeHtml(customer.email)}` : ''}</div>${customer.company ? `<div class="muted">${escapeHtml(customer.company)}</div>` : ''}</div>
    <div class="box"><strong>Details</strong><div class="muted" style="margin-top:8px">Created: ${escapeHtml(createdAt)}</div><div class="muted">Due: ${escapeHtml(dueAt)}</div><div class="muted">Status: ${escapeHtml(record.status || 'open')}</div></div>
  </section>
  <div class="title">${escapeHtml(record.title)}</div>
  <section class="box">
    <div class="row"><span>Amount</span><strong>${money(record.amountInPaise)}</strong></div>
    <div class="row"><span>Balance / Due</span><strong>${money(record.balanceInPaise)}</strong></div>
    ${record.assignedTo ? `<div class="row"><span>Assigned to</span><strong>${escapeHtml(record.assignedTo)}</strong></div>` : ''}
    ${record.source ? `<div class="row"><span>Source</span><strong>${escapeHtml(record.source)}</strong></div>` : ''}
    <div class="row total"><span>${record.kind === 'payment' ? 'Received' : 'Total'}</span><span>${money(record.amountInPaise)}</span></div>
  </section>
  <p class="muted" style="margin-top:28px">Generated from the business workspace. Verify tax/legal fields before using this as a statutory tax invoice.</p>
</main>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Disposition': `inline; filename="${record.kind}-${reference}.html"`,
    },
  });
}
