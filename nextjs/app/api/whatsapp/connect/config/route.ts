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

// The `sessionInfoVersion` passed to FB.login's `extras`, which decides the
// shape of the WA_EMBEDDED_SIGNUP messages the popup posts back. Read from the
// environment so the version can be changed without a code deploy — but note
// that a version bump is not only this number: Meta deprecates Embedded Signup
// v2 on 2026-10-15, and the `coex` feature type does not migrate to v4
// automatically. Confirm the payload shape parsed in lib/client/facebookSdk.js
// against Meta's current documentation before changing this.
// See docs/meta-tech-provider/COEXISTENCE.md § Embedded Signup v4.
const SESSION_INFO_VERSION = String(process.env.META_ES_SESSION_INFO_VERSION || '3');

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
        sessionInfoVersion: SESSION_INFO_VERSION,
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load connect config');
  }
}
