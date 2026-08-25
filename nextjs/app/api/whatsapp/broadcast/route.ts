import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { checkUserRateLimit } from '@/lib/http/rateLimit';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import { enqueueBroadcastRecipients, waitForJobResults } from '@/lib/queues/whatsappSendQueue';
import { normalizePhone } from '@/lib/whatsapp/dispatch';
import AppError from '@/lib/utils/AppError';

// Ported from backend/src/controllers/whatsappController.js's sendBroadcast.
//
// CARRIED-OVER RISK (see docs/NEXTJS_MIGRATION_AUDIT_AND_PLAN.md §1.2/§2.3):
// this still synchronously blocks the HTTP response on waitForJobResults
// (up to 5 minutes) to keep the response shape the frontend
// (BulkSender.jsx: response.data.results) depends on unchanged — same
// tradeoff the original made. maxDuration below budgets for that, but a
// broadcast slow enough to approach it will still time out; a proper fix
// is to make this fire-and-forget with a polling/websocket status endpoint
// instead, not yet done here.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);

    const allowed = await checkUserRateLimit(authed.id, { windowMs: 60 * 1000, maxRequests: 30 });
    if (!allowed) {
      return NextResponse.json({ success: false, message: 'Rate limit exceeded. Please retry later.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { recipients = [], contacts = [], messageType = 'text', text = '', body: bodyField = '', templateName = '', language = 'en_US', components = [], campaignId } =
      body || {};

    const incomingRecipients = Array.isArray(recipients) && recipients.length ? recipients : contacts;
    const normalizedRecipients = incomingRecipients
      .map((item: any) => (typeof item === 'string' ? item : item?.phone || item?.mobile || item?.number || ''))
      .map((item: string) => normalizePhone(item))
      .filter(Boolean);

    const uniqueRecipients: string[] = [...new Set(normalizedRecipients)] as string[];
    if (!uniqueRecipients.length) throw new AppError('recipients must be a non-empty array', 400);

    const resolvedBody = String(text || bodyField || '').trim();
    if (String(messageType).toLowerCase() === 'text' && !resolvedBody) throw new AppError('Text message body is required', 400);
    if (String(messageType).toLowerCase() === 'template' && !String(templateName || '').trim()) throw new AppError('templateName is required', 400);

    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id);
    const accountId = accountContext?.account?._id;
    if (!accountId) throw new AppError('A connected WhatsApp account is required to send a broadcast', 400);

    const finalCampaignId = String(campaignId || `campaign_${Date.now()}`);

    const jobs = await enqueueBroadcastRecipients({
      accountId,
      userId: authed.id,
      recipients: uniqueRecipients,
      messageType: String(messageType).toLowerCase(),
      body: resolvedBody,
      templateName,
      language,
      components,
      campaignId: finalCampaignId,
    });
    const results = await waitForJobResults(jobs);

    return NextResponse.json({
      success: true,
      campaignId: finalCampaignId,
      total: uniqueRecipients.length,
      sent: results.filter((item: any) => item.success).length,
      failed: results.filter((item: any) => !item.success).length,
      results,
    });
  } catch (error) {
    return errorResponse(error, 'Failed to send broadcast');
  }
}
