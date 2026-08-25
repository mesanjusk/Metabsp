import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { listTeamMembers, addTeamMember, getOwnedAccount } from '@/lib/services/teamService';

// Shared-inbox roster. Ownership is verified inside the service on every call,
// so a team member cannot manage the roster of an account they merely belong to.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;

    const account = await getOwnedAccount(id, authed.id);
    const members: any[] = await listTeamMembers(account);

    return NextResponse.json({
      success: true,
      data: members.map((m) => ({ id: m._id, name: m.name, mobile: m.mobile, email: m.email })),
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load team members');
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;
    const { mobile } = (await req.json().catch(() => ({}))) as any;

    const member = await addTeamMember({ accountId: id, ownerUserId: authed.id, mobile });
    return NextResponse.json({ success: true, data: member }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to add team member');
  }
}
