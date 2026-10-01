import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import RcsAgent from '@/lib/models/RcsAgent';
import RcsMessage from '@/lib/models/RcsMessage';
import { deliverRcsWithFallback } from '@/lib/rcs/delivery';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const messages = await RcsMessage.find({ userId: authed.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({ success: true, data: messages });
  } catch (error) {
    return errorResponse(error, 'Failed to load RCS activity');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body = await req.json();
    const agent: any = await RcsAgent.findOne({ userId: authed.id, isActive: true }).lean();
    if (!agent) throw new AppError('Configure your RCS agent first', 409);

    const result: any = await deliverRcsWithFallback({
      authed,
      agent,
      phone: body?.phone,
      text: body?.text,
      trafficType: body?.trafficType,
      suggestions: Array.isArray(body?.suggestions) ? body.suggestions : [],
    });

    if (result?.channel === 'none') {
      return NextResponse.json(
        {
          success: false,
          message:
            result.code === 'WHATSAPP_TEMPLATE_REQUIRED'
              ? 'RCS is unavailable and WhatsApp fallback requires an approved template outside the 24-hour window.'
              : 'This recipient is not reachable by the configured RCS agent and no automatic fallback was sent.',
          data: result,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, message: `Message sent by ${result.channel}`, data: result });
  } catch (error) {
    return errorResponse(error, 'Failed to send RCS message');
  }
}
