import { getGoogleBusinessAccess } from './google';
import { locationPath } from './profile';
import type { BusinessContext } from './ai';

/**
 * Everything a review/post/insight route needs, resolved once.
 *
 * `locationPath` throws a 409 when no location has been selected yet, which is
 * the correct answer for a connection that exists but has not been pointed at a
 * shop — the dashboard turns that into "choose your location", not an error.
 */
export async function resolveGoogleWorkspace(userId: string) {
  const { account, accessToken } = await getGoogleBusinessAccess(userId);
  const path = locationPath(account.accountName, account.locationName);

  const business: BusinessContext = {
    businessName: account.locationTitle || account.accountDisplayName || 'this business',
    category: String(account.metadata?.primaryCategory || ''),
    address: account.locationAddress || '',
    website: account.locationWebsite || '',
    description: String(account.metadata?.description || ''),
  };

  return { account, accessToken, path, business };
}
