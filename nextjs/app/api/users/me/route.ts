import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { sanitizeUser } from '@/lib/http/sanitizeUser';

// Ported from backend/src/routes/Users.js's GET /me.
export async function GET(req: NextRequest) {
  await connectDB();
  try {
    const authed = await requireAuth(req);
    return NextResponse.json({ success: true, user: sanitizeUser(authed.doc) }, { status: 200 });
  } catch (error) {
    return errorResponse(error, 'Failed to load user');
  }
}
