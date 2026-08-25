import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { removeTeamMember } from '@/lib/services/teamService';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id, memberId } = await params;

    await removeTeamMember({ accountId: id, ownerUserId: authed.id, memberUserId: memberId });
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'Failed to remove team member');
  }
}
