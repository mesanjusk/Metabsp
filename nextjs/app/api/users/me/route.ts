import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';

// Ported from backend/src/routes/Users.js's GET /me.
const isAdminRole = (user: any) => Array.isArray(user?.roleId?.permissions) && user.roleId.permissions.includes('*');

const sanitizeUser = (userDoc: any) => {
  if (!userDoc) return null;
  return {
    id: String(userDoc._id),
    User_name: userDoc.username,
    User_group: isAdminRole(userDoc) ? 'admin' : 'user',
    Mobile_number: userDoc.mobile || '',
    Whatsapp_provider: userDoc.whatsappProviderPreference || '',
    createdAt: userDoc.createdAt,
    updatedAt: userDoc.updatedAt,
  };
};

export async function GET(req: NextRequest) {
  await connectDB();
  try {
    const authed = await requireAuth(req);
    return NextResponse.json({ success: true, user: sanitizeUser(authed.doc) }, { status: 200 });
  } catch (error) {
    return errorResponse(error, 'Failed to load user');
  }
}
