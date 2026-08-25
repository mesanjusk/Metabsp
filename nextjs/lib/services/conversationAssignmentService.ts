import ConversationAssignment from '../models/ConversationAssignment';

// Ported from backend/src/services/conversationAssignmentService.js.
// Shared-inbox ownership: which team member is handling which conversation.

export async function getAssignmentsForAccount(
  whatsappAccountId: unknown
): Promise<Map<string, string | null>> {
  const rows: any[] = await ConversationAssignment.find({ whatsappAccountId }).lean();
  const byPhone = new Map<string, string | null>();
  rows.forEach((row) =>
    byPhone.set(row.contactPhone, row.assignedToUserId ? String(row.assignedToUserId) : null)
  );
  return byPhone;
}

export async function setAssignment({
  whatsappAccountId,
  contactPhone,
  assignedToUserId,
}: {
  whatsappAccountId: unknown;
  contactPhone: string;
  assignedToUserId?: string | null;
}) {
  return ConversationAssignment.findOneAndUpdate(
    { whatsappAccountId, contactPhone },
    { $set: { assignedToUserId: assignedToUserId || null } },
    { upsert: true, new: true }
  );
}
