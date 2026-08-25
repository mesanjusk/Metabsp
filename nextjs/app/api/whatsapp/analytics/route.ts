import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import CampaignMessageStatus from '@/lib/models/CampaignMessageStatus';

// Ported from backend/src/controllers/whatsappController.js's getAnalytics.
//
// distinct('messageId') rather than countDocuments: a message accumulates one
// status row per transition (sent → delivered → read), so counting rows would
// report a delivery rate above 100%.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id);

    const filter = {
      userId: authed.id,
      ...(accountContext?.account?._id ? { whatsappAccountId: accountContext.account._id } : {}),
    };

    const [sent, delivered, read, failed] = await Promise.all([
      CampaignMessageStatus.distinct('messageId', { ...filter, status: 'sent' }),
      CampaignMessageStatus.distinct('messageId', { ...filter, status: 'delivered' }),
      CampaignMessageStatus.distinct('messageId', { ...filter, status: 'read' }),
      CampaignMessageStatus.distinct('messageId', { ...filter, status: 'failed' }),
    ]);

    const totalSent = sent.length;
    const pct = (count: number) => (totalSent > 0 ? Number(((count / totalSent) * 100).toFixed(2)) : 0);

    return NextResponse.json({
      success: true,
      data: {
        totalSent,
        deliveredPercentage: pct(delivered.length),
        readPercentage: pct(read.length),
        failedPercentage: pct(failed.length),
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load analytics');
  }
}
