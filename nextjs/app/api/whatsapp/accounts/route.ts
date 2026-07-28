import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';
import { sanitizeAccount } from '@/lib/whatsapp/connect';

// Ported from backend/src/controllers/whatsappController.js's listAccounts.
export async function GET(req: NextRequest) {
  await connectDB();
  try {
    const authed = await requireAuth(req);
    const accounts = await WhatsAppAccount.find({ userId: authed.id }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data: accounts.map(sanitizeAccount) });
  } catch (error) {
    return errorResponse(error, 'Failed to list accounts');
  }
}
