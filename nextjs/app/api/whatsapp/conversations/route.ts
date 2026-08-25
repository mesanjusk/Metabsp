import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import { getAssignmentsForAccount } from '@/lib/services/conversationAssignmentService';
import { normalizePhone } from '@/lib/whatsapp/dispatch';
import Message from '@/lib/models/Message';
import Contact from '@/lib/models/Contact';
import { buildScopedContactFilter } from '@/lib/whatsapp/contacts';

// Ported from backend/src/controllers/whatsappController.js's getConversations.
//
// The chatKey $addFields is the crux: a conversation is identified by the
// OTHER party, which is `from` on an inbound message and `to` on an outbound
// one. Grouping on either field alone splits one conversation into two.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id, {
      requireAccount: false,
    });

    const ownershipClauses: any[] = [{ userId: authed.id }];
    if (accountContext?.account?._id) ownershipClauses.push({ whatsappAccountId: accountContext.account._id });
    const matchStage = ownershipClauses.length === 1 ? ownershipClauses[0] : { $or: ownershipClauses };

    const conversations: any[] = await Message.aggregate([
      { $match: matchStage },
      { $addFields: { chatKey: { $cond: [{ $eq: ['$direction', 'incoming'] }, '$from', '$to'] } } },
      { $sort: { timestamp: -1, createdAt: -1 } },
      {
        $group: {
          _id: '$chatKey',
          lastMessage: { $first: '$message' },
          lastTimestamp: { $first: '$timestamp' },
          direction: { $first: '$direction' },
        },
      },
      { $sort: { lastTimestamp: -1 } },
    ]);

    const phones = conversations.map((item) => normalizePhone(item._id)).filter(Boolean);

    // Scoped, not a bare phone lookup. Contacts are keyed by phone number and
    // two tenants routinely hold the same number, so an unscoped $in returns
    // other tenants' rows and the name shown against a conversation becomes
    // whichever one Mongo happened to return last. $and, never a spread — the
    // scope is itself an $or (see buildScopedContactFilter).
    const contacts: any[] = await Contact.find({
      $and: [buildScopedContactFilter(authed.id, accountContext), { phone: { $in: phones } }],
    }).lean();

    // A legacy shared contact (no userId) can still collide with one this user
    // owns. Prefer the owned row so a customer's own naming always wins.
    const contactMap = new Map<string, any>();
    for (const contact of contacts) {
      const existing = contactMap.get(contact.phone);
      if (!existing || (!existing.userId && contact.userId)) contactMap.set(contact.phone, contact);
    }

    const assignments = accountContext?.account?._id
      ? await getAssignmentsForAccount(accountContext.account._id)
      : new Map<string, string | null>();

    let data = conversations.map((item) => {
      const phone = normalizePhone(item._id);
      const contact: any = contactMap.get(phone);
      return {
        phone,
        name: contact?.name || phone,
        lastMessage: item.lastMessage,
        lastTimestamp: item.lastTimestamp,
        direction: item.direction,
        assignedToUserId: assignments.get(phone) || null,
      };
    });

    const assignedToFilter = String(searchParams.get('assignedTo') || '').trim();
    if (assignedToFilter === 'me') {
      data = data.filter((item) => item.assignedToUserId === String(authed.id));
    } else if (assignedToFilter === 'unassigned') {
      data = data.filter((item) => !item.assignedToUserId);
    } else if (assignedToFilter) {
      data = data.filter((item) => item.assignedToUserId === assignedToFilter);
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error, 'Failed to load conversations');
  }
}
