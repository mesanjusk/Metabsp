import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth, requireAdmin } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { getWebhookVerifyToken } from '@/lib/config/graphApi';

// Ported from backend/src/controllers/whatsappController.js's getMetaWebhookConfig.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    requireAdmin(authed);

    const forwardedProto = (req.headers.get('x-forwarded-proto') || '').split(',')[0].trim();
    const url = new URL(req.url);
    const protocol = forwardedProto || url.protocol.replace(':', '') || 'https';
    const host = req.headers.get('host') || url.host;

    return NextResponse.json({
      success: true,
      data: {
        callbackUrl: `${protocol}://${host}/webhook`,
        verifyToken: getWebhookVerifyToken(),
        appId: process.env.META_APP_ID || '',
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load webhook config');
  }
}
