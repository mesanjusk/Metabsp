import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { errorResponse } from '@/lib/http/errorResponse';
import { requireInstagramService } from '@/lib/instagram/access';
import { getInstagramAccess, instagramGraphRequest } from '@/lib/instagram/meta';

/**
 * The numbers behind a connected Instagram account.
 *
 * Deliberately only what the Graph API actually returns for this login type:
 * follower and media counts, and how much is currently in the inbox. The
 * Instagram webhook stores no message bodies, so there is no history here to
 * count over time the way there is for WhatsApp — and inventing a trend line
 * from data nobody is persisting would be worse than showing three true
 * numbers.
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireInstagramService(req);
    const { account, accessToken } = await getInstagramAccess(authed.id);

    // Each half is optional: a permission the merchant declined, or a field
    // Instagram stops returning, must not blank the whole panel.
    const [profileResult, conversationsResult] = await Promise.allSettled([
      instagramGraphRequest<any>('me', accessToken, {
        params: { fields: 'followers_count,follows_count,media_count' },
      }),
      instagramGraphRequest<any>(`${account.instagramUserId}/conversations`, accessToken, {
        params: { platform: 'instagram', fields: 'id', limit: 50 },
      }),
    ]);

    const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
    const conversations = conversationsResult.status === 'fulfilled' ? conversationsResult.value : null;

    return NextResponse.json({
      success: true,
      data: {
        followersCount: Number(profile?.followers_count ?? 0),
        followsCount: Number(profile?.follows_count ?? 0),
        mediaCount: Number(profile?.media_count ?? 0),
        openConversations: Array.isArray(conversations?.data) ? conversations.data.length : 0,
        // Report the page boundary instead of presenting a capped count as a total.
        conversationsHasMore: Boolean(conversations?.paging?.next),
        // Said plainly so the panel can show a dash rather than a zero that
        // looks like a real measurement of nothing.
        profileAvailable: profileResult.status === 'fulfilled',
        conversationsAvailable: conversationsResult.status === 'fulfilled',
        webhookSubscribed: Boolean(account.webhookSubscribed),
        connectedAt: account.connectedAt,
        lastSyncAt: account.lastSyncAt,
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load Instagram insights');
  }
}
