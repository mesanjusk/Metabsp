import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import { normalizeContactPayload } from '@/lib/whatsapp/contacts';
import AppError from '@/lib/utils/AppError';
import Contact from '@/lib/models/Contact';

// Bulk import. `ordered: false` so one bad row does not abort the rest, and the
// partial result is reported rather than swallowed — an import of 500 contacts
// where 3 fail should still land 497 and say which 3 did not.
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id, { requireAccount: false });

    const body = await req.json().catch(() => ({}));
    const rows = Array.isArray(body?.contacts) ? body.contacts : [];
    if (!rows.length) throw new AppError('contacts must be a non-empty array', 400);

    const waId = accountContext?.account?._id || null;
    const ops: any[] = [];
    let skipped = 0;

    for (const row of rows) {
      const payload = normalizeContactPayload(row);
      if (!payload.phone) {
        skipped += 1;
        continue;
      }
      ops.push({
        updateOne: {
          filter: { userId: authed.id, phone: payload.phone },
          update: { $set: { ...payload, userId: authed.id, whatsappAccountId: waId } },
          upsert: true,
        },
      });
    }

    if (!ops.length) {
      return NextResponse.json({ success: true, imported: 0, failed: skipped, errors: [] });
    }

    try {
      const result: any = await Contact.bulkWrite(ops, { ordered: false });
      const imported =
        (result.upsertedCount || 0) + (result.modifiedCount || 0) + (result.matchedCount || 0);
      return NextResponse.json({ success: true, imported, failed: skipped, errors: [] });
    } catch (err: any) {
      // bulkWrite with ordered:false throws a BulkWriteError that still carries
      // the partial result — report what landed instead of failing the lot.
      const result = err.result || {};
      const imported = (result.nUpserted || 0) + (result.nModified || 0);
      const writeErrors = (err.writeErrors || []).slice(0, 20).map((e: any) => ({
        phone: ops[e.index]?.updateOne?.filter?.phone,
        message: e.errmsg || e.message,
      }));
      return NextResponse.json({
        success: true,
        imported,
        failed: skipped + (err.writeErrors?.length || 0),
        errors: writeErrors,
      });
    }
  } catch (error) {
    return errorResponse(error, 'Failed to import contacts');
  }
}
