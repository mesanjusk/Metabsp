import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import Campaign from '@/lib/models/Campaign';

/**
 * Campaign sending previously ran over an unofficial WhatsApp Web session,
 * which is how it could blast free-form text at an arbitrary recipient list.
 * The official Cloud API cannot do that: outside Meta's 24-hour customer
 * service window only an approved template may be sent, and delivery is rate
 * limited per number.
 *
 * The endpoint is kept so existing clients get a reason rather than a 404,
 * and ownership is still checked first so it cannot be used to probe for
 * campaign ids belonging to other users.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;

    const campaign: any = await Campaign.findOne({
      _id: id,
      ...(authed.isAdmin ? {} : { userId: authed.id }),
    }).lean();
    if (!campaign) throw new AppError('Campaign not found', 404);
    if (campaign.status === 'SENDING') throw new AppError('Already sending', 409);

    return NextResponse.json(
      {
        success: false,
        message:
          'Campaign sending now goes through the WhatsApp Cloud API broadcast endpoint, which requires an approved message template. Use POST /api/whatsapp/broadcast with a template name.',
        campaignId: String(campaign._id),
      },
      { status: 501 }
    );
  } catch (error) {
    return errorResponse(error, 'Failed to send campaign');
  }
}
