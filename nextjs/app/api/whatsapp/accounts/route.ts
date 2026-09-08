import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';
import { sanitizeAccount } from '@/lib/whatsapp/connect';

// Ported from backend/src/controllers/whatsappController.js's listAccounts.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    // This endpoint powers the UI section titled "Connected WhatsApp numbers".
    // Keep disconnected rows in Mongo for audit/reconnect history, but do not
    // present a Meta-revoked customer as if they were still connected to us.
    const accounts = await WhatsAppAccount.find({ userId: authed.id, status: { $ne: 'disconnected' } })
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json({ success: true, data: accounts.map(sanitizeAccount) });
  } catch (error) {
    return errorResponse(error, 'Failed to list accounts');
  }
}
