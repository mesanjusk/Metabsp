import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { User } from '@/lib/models';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';

// Ported from backend/src/routes/Users.js's PUT /whatsapp-provider.
const WHATSAPP_PROVIDER_VALUES = ['baileys', 'meta', 'both'];

const isAdminRole = (user: any) => Array.isArray(user?.roleId?.permissions) && user.roleId.permissions.includes('*');
const sanitizeUser = (userDoc: any) => ({
  id: String(userDoc._id),
  User_name: userDoc.username,
  User_group: isAdminRole(userDoc) ? 'admin' : 'user',
  Mobile_number: userDoc.mobile || '',
  Whatsapp_provider: userDoc.whatsappProviderPreference || '',
  createdAt: userDoc.createdAt,
  updatedAt: userDoc.updatedAt,
});

export async function PUT(req: NextRequest) {
  await connectDB();
  try {
    const authed = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const provider = String(body?.provider || '').trim().toLowerCase();

    if (!WHATSAPP_PROVIDER_VALUES.includes(provider)) {
      return NextResponse.json(
        { success: false, message: `provider must be one of: ${WHATSAPP_PROVIDER_VALUES.join(', ')}` },
        { status: 400 }
      );
    }

    const user: any = await User.findByIdAndUpdate(authed.id, { $set: { whatsappProviderPreference: provider } }, { new: true }).populate(
      'roleId'
    );
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });

    return NextResponse.json({ success: true, user: sanitizeUser(user) }, { status: 200 });
  } catch (error) {
    return errorResponse(error, 'Failed to update preference');
  }
}
