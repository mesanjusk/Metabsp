import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import { setAssignment } from '@/lib/services/conversationAssignmentService';
import { normalizePhone } from '@/lib/whatsapp/dispatch';
import AppError from '@/lib/utils/AppError';

// Assign a conversation to a team member (or clear it with a null userId).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ phone: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { phone: rawPhone } = await params;

    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id);
    const phone = normalizePhone(rawPhone);
    if (!phone) throw new AppError('A valid phone number is required', 400);

    const body = (await req.json().catch(() => ({}))) as any;
    const assignedToUserId = body?.userId ? String(body.userId) : null;

    // A conversation may only be assigned to the owner or a current team
    // member — otherwise any user id could be written into the assignment.
    if (assignedToUserId) {
      const account = accountContext.account;
      const isOwner = String(account?.userId) === assignedToUserId;
      const isMember = (account?.teamMemberIds || []).some(
        (memberId: unknown) => String(memberId) === assignedToUserId
      );
      if (!isOwner && !isMember) {
        throw new AppError('Can only assign to the account owner or a team member', 400);
      }
    }

    const assignment: any = await setAssignment({
      whatsappAccountId: accountContext.account._id,
      contactPhone: phone,
      assignedToUserId,
    });

    return NextResponse.json({
      success: true,
      data: { phone, assignedToUserId: assignment.assignedToUserId },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to assign conversation');
  }
}
