import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';

// Ported from backend/src/routes/Users.js's POST /logout — a no-op since
// auth is stateless JWT (no server-side session to invalidate), same as
// the original.
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    return NextResponse.json({ success: true, message: 'Logged out successfully' }, { status: 200 });
  } catch (error) {
    return errorResponse(error, 'Logout failed');
  }
}
