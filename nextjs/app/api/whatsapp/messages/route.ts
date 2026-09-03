import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import Message from '@/lib/models/Message';
import { hydrateLegacyTemplateMessages } from '@/lib/whatsapp/templates';

// Ported from backend/src/controllers/whatsappController.js's getMessages.
//
// Ownership is an $or over userId and the active account's id rather than a
// single clause: messages saved before an account was connected carry only a
// userId, while webhook-saved ones carry both. Filtering on either alone
// silently hides half the history.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50));
    const skip = (page - 1) * limit;

    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id, {
      requireAccount: false,
    });

    const ownershipClauses: any[] = [{ userId: authed.id }];
    if (accountContext?.account?._id) ownershipClauses.push({ whatsappAccountId: accountContext.account._id });
    const filter = ownershipClauses.length === 1 ? ownershipClauses[0] : { $or: ownershipClauses };

    const [data, total] = await Promise.all([
      Message.find(filter).sort({ timestamp: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Message.countDocuments(filter),
    ]);

    // Template rows saved before sends recorded their rendered text hold only
    // the template's name; render what can still be recovered so old threads
    // read as messages rather than as identifiers.
    const hydrated = await hydrateLegacyTemplateMessages(data, accountContext);

    return NextResponse.json({
      success: true,
      data: hydrated,
      pagination: { page, limit, total, hasMore: skip + hydrated.length < total },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load messages');
  }
}
