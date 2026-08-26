import { NextResponse } from 'next/server';
import {
  isGoogleEnabled,
  isFacebookEnabled,
  getGoogleClientId,
  getFacebookAppId,
  getFacebookLoginScopes,
} from '@/lib/services/socialAuthService';

// Ported from backend/src/routes/Users.js's GET /auth/providers.
//
// This is what decides whether the login page shows a Google or Facebook
// button at all — SocialSignIn renders nothing for a provider this reports as
// disabled, so a deployment without GOOGLE_CLIENT_ID simply keeps the password
// form it already had, rather than offering a button that 503s on click.
//
// It was missing from the port, which is why the buttons never appeared on the
// Next.js app however the environment was configured: the component asked, got
// a 404, and rendered nothing.
//
// No secrets here. The client id and app id are public by design — the browser
// needs them to open the provider's dialog — and the app secret never leaves
// the server.
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      google: { enabled: isGoogleEnabled(), clientId: getGoogleClientId() },
      facebook: {
        enabled: isFacebookEnabled(),
        appId: getFacebookAppId(),
        // The browser must request exactly the scopes this app actually has —
        // an unavailable scope fails the whole login dialog.
        scopes: getFacebookLoginScopes(),
      },
    },
  });
}
