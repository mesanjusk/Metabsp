import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { getGraphApiVersion } from '@/lib/config/graphApi';

// Ported from backend/src/controllers/whatsappController.js's getConnectConfig.
export async function GET(req: NextRequest) {
  await connectDB();
  try {
    await requireAuth(req);
    return NextResponse.json({
      success: true,
      data: {
        appId: process.env.META_APP_ID || '',
        configId: process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '',
        apiVersion: getGraphApiVersion(),
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load connect config');
  }
}
