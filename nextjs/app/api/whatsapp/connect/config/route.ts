import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { getGraphApiVersion } from '@/lib/config/graphApi';

// Coexistence onboarding is opt-in per deployment: it requires the Meta app to
// be subscribed to the `history`, `smb_message_echoes` and `smb_app_state_sync`
// webhook fields. See backend/src/controllers/whatsappController.js's
// getConnectConfig and docs/meta-tech-provider/COEXISTENCE.md.
const isCoexistenceEnabled = () =>
  String(process.env.META_ENABLE_COEXISTENCE ?? 'true').toLowerCase() !== 'false';

const COEXISTENCE_FEATURE_TYPE = 'whatsapp_business_app_onboarding';

// Ported from backend/src/controllers/whatsappController.js's getConnectConfig.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    await requireAuth(req);
    const coexistenceEnabled = isCoexistenceEnabled();
    return NextResponse.json({
      success: true,
      data: {
        appId: process.env.META_APP_ID || '',
        configId: process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '',
        apiVersion: getGraphApiVersion(),
        coexistenceEnabled,
        featureType: coexistenceEnabled ? COEXISTENCE_FEATURE_TYPE : '',
        sessionInfoVersion: '3',
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load connect config');
  }
}
