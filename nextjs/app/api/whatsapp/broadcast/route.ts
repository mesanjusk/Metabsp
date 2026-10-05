import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { checkUserRateLimit } from '@/lib/http/rateLimit';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import {
  DurableQueuePendingError,
  enqueueBroadcastRecipients,
  waitForJobResults,
} from '@/lib/queues/whatsappSendQueue';
import { normalizePhone } from '@/lib/whatsapp/dispatch';
import SmbRecord from '@/lib/models/SmbRecord';
import AppError from '@/lib/utils/AppError';

// Immediate broadcasts preserve the existing synchronous response contract.
// Scheduled broadcasts are different: they are persisted in the shared SMB
// record collection and return immediately. The background campaign scheduler
// queues them when due, so a Redis restart before send time does not erase the
// campaign definition.
export const maxDuration = 300;

const mapCampaign = (item: any) => ({
  id: String(item._id),
  campaignId: String(item.reference || item.data?.campaignId || ''),
  title: item.title,
  status: item.status,
  dueAt: item.dueAt,
  recipientCount: Number(item.quantity || item.data?.recipientCount || 0),
  templateName: String(item.data?.templateName || ''),
  createdAt: item.createdAt,
  queuedAt: item.data?.queuedAt || null,
  lastError: String(item.data?.lastError || ''),
});

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);

    const records: any[] = await SmbRecord.find({
      userId: authed.id,
      kind: 'whatsapp_campaign',
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    return NextResponse.json({ success: true, data: records.map(mapCampaign) });
  } catch (error) {
    return errorResponse(error, 'Failed to load broadcast campaigns');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const id = String(searchParams.get('id') || '').trim();
    if (!id) throw new AppError('Campaign id is required', 400);

    const cancelled: any = await SmbRecord.findOneAndUpdate(
      {
        _id: id,
        userId: authed.id,
        kind: 'whatsapp_campaign',
        status: 'scheduled',
      },
      {
        $set: {
          status: 'cancelled',
          completedAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!cancelled) {
      throw new AppError('Campaign was not found or is already being sent and can no longer be cancelled', 409);
    }

    return NextResponse.json({ success: true, data: mapCampaign(cancelled) });
  } catch (error) {
    return errorResponse(error, 'Failed to cancel broadcast campaign');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);

    const allowed = await checkUserRateLimit(authed.id, { windowMs: 60 * 1000, maxRequests: 30 });
    if (!allowed) {
      return NextResponse.json({ success: false, message: 'Rate limit exceeded. Please retry later.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      recipients = [],
      contacts = [],
      messageType = 'text',
      text = '',
      body: bodyField = '',
      templateName = '',
      language = 'en_US',
      components = [],
      campaignId,
      campaignName = '',
      scheduleAt = '',
    } = body || {};

    const incomingRecipients = Array.isArray(recipients) && recipients.length ? recipients : contacts;
    const normalizedRecipients = incomingRecipients
      .map((item: any) => (typeof item === 'string' ? item : item?.phone || item?.mobile || item?.number || ''))
      .map((item: string) => normalizePhone(item))
      .filter(Boolean);

    const uniqueRecipients: string[] = [...new Set(normalizedRecipients)] as string[];
    if (!uniqueRecipients.length) throw new AppError('recipients must be a non-empty array', 400);

    const normalizedMessageType = String(messageType).toLowerCase();
    const resolvedBody = String(text || bodyField || '').trim();
    if (normalizedMessageType === 'text' && !resolvedBody) throw new AppError('Text message body is required', 400);
    if (normalizedMessageType === 'template' && !String(templateName || '').trim()) throw new AppError('templateName is required', 400);

    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id);
    const accountId = accountContext?.account?._id;
    if (!accountId) throw new AppError('A connected WhatsApp account is required to send a broadcast', 400);

    const finalCampaignId = String(campaignId || `campaign_${Date.now()}`);
    const requestedScheduleAt = String(scheduleAt || '').trim();

    if (requestedScheduleAt) {
      if (normalizedMessageType !== 'template') {
        throw new AppError('Scheduled campaigns must use an approved WhatsApp template', 400);
      }

      const dueAt = new Date(requestedScheduleAt);
      if (Number.isNaN(dueAt.getTime())) throw new AppError('scheduleAt must be a valid date and time', 400);
      if (dueAt.getTime() <= Date.now()) throw new AppError('scheduleAt must be in the future', 400);

      const record: any = await SmbRecord.create({
        userId: authed.id,
        kind: 'whatsapp_campaign',
        title: String(campaignName || '').trim() || `${templateName} campaign`,
        status: 'scheduled',
        source: 'whatsapp',
        reference: finalCampaignId,
        quantity: uniqueRecipients.length,
        dueAt,
        data: {
          campaignId: finalCampaignId,
          whatsappAccountId: String(accountId),
          recipientCount: uniqueRecipients.length,
          recipients: uniqueRecipients,
          messageType: 'template',
          templateName: String(templateName).trim(),
          language: String(language || 'en_US'),
          components: Array.isArray(components) ? components : [],
          scheduleAttempts: 0,
        },
      });

      return NextResponse.json(
        {
          success: true,
          scheduled: true,
          campaignId: finalCampaignId,
          total: uniqueRecipients.length,
          campaign: mapCampaign(record.toObject()),
        },
        { status: 202 }
      );
    }

    let jobs: any[] = [];
    try {
      jobs = await enqueueBroadcastRecipients({
        accountId,
        userId: authed.id,
        recipients: uniqueRecipients,
        messageType: normalizedMessageType,
        body: resolvedBody,
        templateName,
        language,
        components,
        campaignId: finalCampaignId,
      });
    } catch (error: any) {
      if (error instanceof DurableQueuePendingError || error?.code === 'DURABLE_QUEUE_PENDING') {
        return NextResponse.json(
          {
            success: true,
            scheduled: false,
            queuedForRetry: true,
            campaignId: finalCampaignId,
            total: uniqueRecipients.length,
            sent: 0,
            failed: 0,
            pending: uniqueRecipients.length,
            message: 'Messages are safely queued for retry while the delivery queue recovers.',
          },
          { status: 202 }
        );
      }
      throw error;
    }

    const results = await waitForJobResults(jobs);

    return NextResponse.json({
      success: true,
      scheduled: false,
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
