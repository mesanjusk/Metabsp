import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import RcsAgent from '@/lib/models/RcsAgent';
import { deliverRcsWithFallback } from '@/lib/rcs/delivery';

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body = await req.json();
    const agent: any = await RcsAgent.findOne({ userId: authed.id, isActive: true }).lean();
    if (!agent) throw new AppError('Configure your RCS agent first', 409);

    const recipients = Array.from(
      new Set(
        (Array.isArray(body?.recipients) ? body.recipients : [])
          .map((value: unknown) => String(value || '').trim())
          .filter(Boolean)
      )
    );

    if (!recipients.length) throw new AppError('Add at least one campaign recipient', 400);
    if (recipients.length > 100) throw new AppError('A single RCS campaign request supports up to 100 recipients', 400);
    if (body?.consentConfirmed !== true) {
      throw new AppError('Confirm that these recipients have opted in before sending an RCS campaign', 400);
    }

    const text = String(body?.text || '').trim();
    const trafficType = String(body?.trafficType || 'PROMOTION');
    if (!text) throw new AppError('Campaign message text is required', 400);

    const results: any[] = [];

    for (let offset = 0; offset < recipients.length; offset += 5) {
      const batch = recipients.slice(offset, offset + 5);
      const batchResults = await Promise.all(
        batch.map(async (phone: string) => {
          try {
            const result: any = await deliverRcsWithFallback({
              authed,
              agent,
              phone,
              text,
              trafficType,
            });
            return { phone, success: result.channel !== 'none', channel: result.channel, data: result };
          } catch (error: any) {
            return {
              phone,
              success: false,
              channel: 'none',
              message: String(error?.message || 'Send failed'),
              statusCode: Number(error?.statusCode || 500),
            };
          }
        })
      );
      results.push(...batchResults);
    }

    const summary = results.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.success) acc.sent += 1;
        else acc.failed += 1;
        if (item.channel === 'rcs') acc.rcs += 1;
        if (item.channel === 'whatsapp') acc.whatsapp += 1;
        if (item.channel === 'sms') acc.sms += 1;
        return acc;
      },
      { total: 0, sent: 0, failed: 0, rcs: 0, whatsapp: 0, sms: 0 }
    );

    return NextResponse.json({ success: true, data: { summary, results } });
  } catch (error) {
    return errorResponse(error, 'Failed to send RCS campaign');
  }
}
