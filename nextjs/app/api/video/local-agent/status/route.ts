import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { getExtensionPresence } from '@/lib/video/core/browser/extension-presence';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const configured = Boolean(String(process.env.BROWSER_EXTENSION_TOKEN || '').trim());
    const presence = configured ? await getExtensionPresence() : { connected: false };
    return NextResponse.json({
      success: true,
      data: {
        configured,
        online: Boolean(presence.connected),
        workerId: presence.workerId || null,
        lastSeenAt: presence.lastSeenAt || null,
        detail: presence.detail || null,
        message: !configured
          ? 'Local Video Runner is not configured on this deployment.'
          : presence.connected
            ? `Local Video PC online${presence.workerId ? ` (${presence.workerId})` : ''}`
            : 'Local Video PC offline. Open Chrome on the configured PC and enable automatic task claiming.',
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load Video Studio local runner status');
  }
}
