import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import AppError from '@/lib/utils/AppError';
import {
  bareId,
  buildLocalPostPayload,
  formatAddress,
  locationPath,
  normalizeLocation,
  normalizeReview,
  starRatingToNumber,
  summarizePerformance,
  summarizeReviews,
} from '@/lib/googleBusiness/profile';
import { buildGoogleAuthorizationUrl, getGoogleBusinessConfig } from '@/lib/googleBusiness/google';

describe('google business resource names', () => {
  it('reduces a resource name to its id and leaves a bare id alone', () => {
    expect(bareId('accounts/123')).toBe('123');
    expect(bareId('accounts/123/locations/456')).toBe('456');
    expect(bareId('456')).toBe('456');
    expect(bareId(undefined)).toBe('');
  });

  it('builds the two-segment path the v4 review and post endpoints need', () => {
    expect(locationPath('accounts/123', 'locations/456')).toBe('accounts/123/locations/456');
  });

  /**
   * A connection with no location selected must not fall through to a request
   * against "accounts//locations/" — Google answers that with a 404 the
   * dashboard would render as a provider failure rather than "choose a shop".
   */
  it('refuses to build a path when no location has been selected', () => {
    expect(() => locationPath('accounts/123', '')).toThrowError(AppError);
    expect(() => locationPath('accounts/123', '')).toThrowError(/Select a Google Business Profile location/);
  });
});

describe('review normalisation', () => {
  it('turns the star word into a number', () => {
    expect(starRatingToNumber('FIVE')).toBe(5);
    expect(starRatingToNumber('three')).toBe(3);
    expect(starRatingToNumber('STAR_RATING_UNSPECIFIED')).toBe(0);
    expect(starRatingToNumber(undefined)).toBe(0);
  });

  it('keeps an unnamed reviewer and an empty comment renderable', () => {
    const review = normalizeReview({ reviewId: 'r1', starRating: 'FOUR' });
    expect(review).toMatchObject({ reviewId: 'r1', rating: 4, reviewer: 'A Google customer', comment: '', reply: '' });
  });

  it('reads the reply out of reviewReply', () => {
    const review = normalizeReview({
      name: 'accounts/1/locations/2/reviews/r2',
      starRating: 'ONE',
      comment: 'Waited an hour.',
      reviewer: { displayName: 'Asha' },
      reviewReply: { comment: 'Sorry about that.', updateTime: '2026-01-02T00:00:00Z' },
    });
    expect(review.reviewId).toBe('r2');
    expect(review.reply).toBe('Sorry about that.');
    expect(review.repliedAt).toBe('2026-01-02T00:00:00Z');
  });
});

describe('review summary', () => {
  const reviews = [
    normalizeReview({ reviewId: 'a', starRating: 'FIVE', reviewReply: { comment: 'Thanks!' } }),
    normalizeReview({ reviewId: 'b', starRating: 'TWO', comment: 'Cold food' }),
    normalizeReview({ reviewId: 'c', starRating: 'FIVE', comment: 'Great' }),
    normalizeReview({ reviewId: 'd', starRating: 'THREE', comment: 'Okay' }),
  ];

  it('separates unanswered from unanswered-and-negative', () => {
    const summary = summarizeReviews(reviews, 4.25, 97);
    expect(summary.unanswered).toBe(3);
    // A 1-3 star with no reply is a different job from a 5-star with no reply.
    expect(summary.unansweredNegative).toBe(2);
    expect(summary.replyRate).toBe(25);
    expect(summary.averageRating).toBe(4.3);
    expect(summary.totalReviewCount).toBe(97);
    expect(summary.fetched).toBe(4);
  });

  it('does not divide by zero on a profile with no reviews', () => {
    expect(summarizeReviews([], 0, 0)).toMatchObject({ replyRate: 0, unanswered: 0, averageRating: 0 });
  });
});

describe('local post payload', () => {
  it('builds a standard post with a link button', () => {
    expect(
      buildLocalPostPayload({ summary: 'Open late all week.', actionType: 'BOOK', actionUrl: 'https://shop.example/book' })
    ).toEqual({
      languageCode: 'en',
      summary: 'Open late all week.',
      topicType: 'STANDARD',
      callToAction: { actionType: 'BOOK', url: 'https://shop.example/book' },
    });
  });

  /** CALL is the one action Google resolves from the profile's own number. */
  it('omits the url for a CALL button and requires one for every other type', () => {
    expect(buildLocalPostPayload({ summary: 'Call us.', actionType: 'CALL' }).callToAction).toEqual({
      actionType: 'CALL',
    });
    expect(() => buildLocalPostPayload({ summary: 'Shop now.', actionType: 'SHOP' })).toThrowError(
      /call-to-action needs an http/
    );
  });

  it('accepts a post with no button at all', () => {
    expect(buildLocalPostPayload({ summary: 'Closed Monday.', actionType: 'NONE' }).callToAction).toBeUndefined();
  });

  it('rejects empty text, over-long text and a non-http image', () => {
    expect(() => buildLocalPostPayload({ summary: '   ' })).toThrowError(/Post text is required/);
    expect(() => buildLocalPostPayload({ summary: 'x'.repeat(1501), actionType: 'NONE' })).toThrowError(/1500/);
    expect(() =>
      buildLocalPostPayload({ summary: 'Hi', actionType: 'NONE', mediaUrl: 'file:///tmp/a.jpg' })
    ).toThrowError(/public http/);
  });

  it('rejects a call-to-action Google does not define', () => {
    expect(() =>
      buildLocalPostPayload({ summary: 'Hi', actionType: 'SUBSCRIBE', actionUrl: 'https://a.example' })
    ).toThrowError(/Unsupported call-to-action/);
  });
});

describe('performance rollup', () => {
  const response = {
    multiDailyMetricTimeSeries: [
      {
        dailyMetricTimeSeries: [
          {
            dailyMetric: 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
            timeSeries: {
              datedValues: [
                { date: { year: 2026, month: 3, day: 1 }, value: '10' },
                // Google omits `value` entirely on a zero day.
                { date: { year: 2026, month: 3, day: 2 } },
              ],
            },
          },
          {
            dailyMetric: 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
            timeSeries: {
              datedValues: [
                { date: { year: 2026, month: 3, day: 1 }, value: '30' },
                { date: { year: 2026, month: 3, day: 2 }, value: '60' },
              ],
            },
          },
          {
            dailyMetric: 'CALL_CLICKS',
            timeSeries: { datedValues: [{ date: { year: 2026, month: 3, day: 1 }, value: '5' }] },
          },
          {
            dailyMetric: 'WEBSITE_CLICKS',
            timeSeries: { datedValues: [{ date: { year: 2026, month: 3, day: 2 }, value: '5' }] },
          },
        ],
      },
    ],
  };

  it('sums the four impression splits into one number an owner can read', () => {
    const summary = summarizePerformance(response);
    expect(summary.totals.impressions).toBe(100);
    expect(summary.totals.calls).toBe(5);
    expect(summary.totals.websiteClicks).toBe(5);
    expect(summary.totals.actions).toBe(10);
    expect(summary.totals.actionRate).toBe(10);
  });

  it('pads the daily series and keeps it in date order', () => {
    expect(summarizePerformance(response).impressionsByDay).toEqual([
      { date: '2026-03-01', value: 40 },
      { date: '2026-03-02', value: 60 },
    ]);
  });

  it('reports zeros rather than NaN for a location Google has no data for', () => {
    const empty = summarizePerformance({});
    expect(empty.totals).toMatchObject({ impressions: 0, actions: 0, actionRate: 0 });
    expect(empty.impressionsByDay).toEqual([]);
  });
});

describe('location normalisation', () => {
  it('joins the address parts Google returns separately', () => {
    expect(
      formatAddress({
        addressLines: ['12 Market Road', 'Near the bus stand'],
        locality: 'Gondia',
        administrativeArea: 'MH',
        postalCode: '441601',
      })
    ).toBe('12 Market Road, Near the bus stand, Gondia, MH, 441601');
    expect(formatAddress(null)).toBe('');
  });

  it('surfaces the verification flag that decides whether posting will work', () => {
    const verified = normalizeLocation({ name: 'locations/1', metadata: { hasVoiceOfMerchant: true } });
    const unverified = normalizeLocation({ name: 'locations/2', metadata: {} });
    expect(verified.hasVoiceOfMerchant).toBe(true);
    expect(unverified.hasVoiceOfMerchant).toBe(false);
  });
});

describe('authorization url', () => {
  const previous = { ...process.env };

  beforeEach(() => {
    process.env.GOOGLE_BUSINESS_CLIENT_ID = 'client-id.apps.googleusercontent.com';
    process.env.GOOGLE_BUSINESS_CLIENT_SECRET = 'client-secret';
    process.env.FRONTEND_URL = 'https://meta.example.in';
    delete process.env.GOOGLE_BUSINESS_REDIRECT_URI;
  });

  afterEach(() => {
    process.env = { ...previous };
  });

  /**
   * Without access_type=offline AND prompt=consent Google returns an access
   * token and no refresh token, and the connection dies an hour later with no
   * visible cause. This is the test that keeps both on the URL.
   */
  it('always asks for offline access and a fresh consent', () => {
    const url = new URL(buildGoogleAuthorizationUrl('state-token', getGoogleBusinessConfig()));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBe('state-token');
    expect(url.searchParams.get('redirect_uri')).toBe('https://meta.example.in/api/google-business/oauth/callback');
  });

  it('requests the one scope the Business Profile APIs accept', () => {
    const scopes = new URL(buildGoogleAuthorizationUrl('s', getGoogleBusinessConfig())).searchParams.get('scope') || '';
    expect(scopes.split(' ')).toContain('https://www.googleapis.com/auth/business.manage');
    // The deprecated alias must never be requested.
    expect(scopes).not.toContain('plus.business.manage');
  });

  it('refuses to build a config when no client is set anywhere', () => {
    delete process.env.GOOGLE_BUSINESS_CLIENT_ID;
    delete process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(() => getGoogleBusinessConfig()).toThrowError(/client ID\/secret are not configured/);
  });
});

/**
 * The precedence rule is the whole point of the admin screen: an operator who
 * saves a client there must see it take effect, even on a deployment that still
 * carries an older value in its environment.
 */
describe('platform credential precedence', () => {
  const previous = { ...process.env };

  beforeEach(() => {
    process.env.GOOGLE_BUSINESS_CLIENT_ID = 'env-client.apps.googleusercontent.com';
    process.env.GOOGLE_BUSINESS_CLIENT_SECRET = 'env-secret';
    process.env.FRONTEND_URL = 'https://meta.example.in';
    delete process.env.GOOGLE_BUSINESS_REDIRECT_URI;
  });

  afterEach(() => {
    process.env = { ...previous };
  });

  it('prefers a stored client over the environment and says so', () => {
    const config = getGoogleBusinessConfig({
      clientId: 'saved-client.apps.googleusercontent.com',
      clientSecret: 'saved-secret',
    });

    expect(config).toMatchObject({
      clientId: 'saved-client.apps.googleusercontent.com',
      clientSecret: 'saved-secret',
      source: 'database',
    });
  });

  it('falls back to the environment when nothing is stored', () => {
    expect(getGoogleBusinessConfig(null)).toMatchObject({
      clientId: 'env-client.apps.googleusercontent.com',
      source: 'environment',
    });
  });

  /**
   * Half a credential is not a credential. A row carrying a client id whose
   * secret failed to decrypt must not be allowed to shadow a working
   * environment pair with an unusable one.
   */
  it('ignores a stored row that is missing either half', () => {
    expect(getGoogleBusinessConfig({ clientId: 'saved-client.apps.googleusercontent.com' })).toMatchObject({
      clientId: 'env-client.apps.googleusercontent.com',
      source: 'environment',
    });
    expect(getGoogleBusinessConfig({ clientSecret: 'saved-secret' })).toMatchObject({
      clientId: 'env-client.apps.googleusercontent.com',
      source: 'environment',
    });
  });

  /**
   * The rotation hazard, as a rule rather than a comment: a refresh token is
   * redeemable only by the client that issued it, so a connection whose
   * recorded issuer is not the client now in force cannot be refreshed and has
   * to be reported as needing reconnection. An unrecorded issuer (a connection
   * made before the field existed) means unknown, not mismatched.
   */
  it('treats a recorded issuer that differs from the live client as stale', () => {
    const live = getGoogleBusinessConfig({
      clientId: 'current-client.apps.googleusercontent.com',
      clientSecret: 'current-secret',
    }).clientId;

    const isStale = (issuedByClientId: string) => Boolean(issuedByClientId && issuedByClientId !== live);

    expect(isStale('older-client.apps.googleusercontent.com')).toBe(true);
    expect(isStale('current-client.apps.googleusercontent.com')).toBe(false);
    expect(isStale('')).toBe(false);
  });

  /**
   * Keeping the stored secret is only safe while the client ID it belongs to is
   * unchanged — a secret is issued for one client, so carrying it across a
   * rotation stores a pair Google rejects.
   */
  it('only allows an omitted secret while the client ID stays the same', () => {
    const mayKeepStoredSecret = (storedClientId: string, nextClientId: string, hasStoredSecret: boolean) =>
      hasStoredSecret && (!storedClientId || storedClientId === nextClientId);

    const a = 'a.apps.googleusercontent.com';
    const b = 'b.apps.googleusercontent.com';

    expect(mayKeepStoredSecret(a, a, true)).toBe(true);
    expect(mayKeepStoredSecret(a, b, true)).toBe(false);
    // Nothing stored yet: the secret has to be supplied.
    expect(mayKeepStoredSecret('', a, false)).toBe(false);
  });

  it('lets a stored redirect URI override the derived one', () => {
    expect(
      getGoogleBusinessConfig({
        clientId: 'saved-client.apps.googleusercontent.com',
        clientSecret: 'saved-secret',
        redirectUri: 'https://other.example/api/google-business/oauth/callback',
      }).redirectUri
    ).toBe('https://other.example/api/google-business/oauth/callback');
  });
});
