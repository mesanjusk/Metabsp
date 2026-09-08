import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { getGraphApiVersion, getJsSdkVersion } from '@/lib/config/graphApi';

// Coexistence onboarding is opt-in per deployment: it requires the Meta app to
// be subscribed to the `history`, `smb_message_echoes` and `smb_app_state_sync`
// webhook fields. See docs/meta-tech-provider/COEXISTENCE.md.
const isCoexistenceEnabled = () =>
  String(process.env.META_ENABLE_COEXISTENCE ?? 'true').toLowerCase() !== 'false';

const COEXISTENCE_FEATURE_TYPE = 'whatsapp_business_app_onboarding';
const EMBEDDED_SIGNUP_VERSION = String(process.env.META_EMBEDDED_SIGNUP_VERSION || 'v4');

// Meta's Builder still reports Session Info Version = 3 for this configuration.
// We expose it for diagnostics/backward compatibility, but the current v4
// FB.login launch does not send sessionInfoVersion; Meta's generated code sends
// extras.version="v4" plus the coexistence featureType instead.
const SESSION_INFO_VERSION = String(process.env.META_ES_SESSION_INFO_VERSION || '3');

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
        // The Graph API version drives server-side calls; sdkVersion is what the
        // browser passes to FB.init for the Embedded Signup popup. They are
        // separate because Meta's Builder can advance the browser SDK without
        // requiring every WhatsApp Graph call to move with it.
        apiVersion: getGraphApiVersion(),
        sdkVersion: getJsSdkVersion(),
        embeddedSignupVersion: EMBEDDED_SIGNUP_VERSION,
        coexistenceEnabled,
        featureType: coexistenceEnabled ? COEXISTENCE_FEATURE_TYPE : '',
        sessionInfoVersion: SESSION_INFO_VERSION,
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load connect config');
  }
}
