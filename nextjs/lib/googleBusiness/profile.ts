import AppError from '@/lib/utils/AppError';
import { GOOGLE_HOSTS, googleRequest } from './google';

/** Google returns the rating as a word, and every UI wants a number. */
const STAR_WORDS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

export function starRatingToNumber(value: unknown): number {
  return STAR_WORDS[String(value || '').toUpperCase()] || 0;
}

/**
 * The metrics worth showing a shop owner, in the order a shop owner reads them:
 * how many people saw you, then how many of them did something about it.
 *
 * Impressions arrive split four ways (maps/search x desktop/mobile) and are
 * summed here — nobody running a salon needs the desktop-Maps number on its own,
 * and four near-identical rows crowd out the three that lead to a customer.
 */
export const PERFORMANCE_METRICS = [
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  'CALL_CLICKS',
  'WEBSITE_CLICKS',
  'BUSINESS_DIRECTION_REQUESTS',
  'BUSINESS_CONVERSATIONS',
] as const;

const IMPRESSION_METRICS = new Set<string>([
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
]);

/** "accounts/123" → "123", and "123" → "123". */
export function bareId(resourceName: unknown): string {
  const value = String(resourceName || '').trim();
  return value.includes('/') ? value.split('/').filter(Boolean).pop() || '' : value;
}

/** The v4 review/post endpoints want the two-segment path, not either half. */
export function locationPath(accountName: string, locationName: string): string {
  const account = bareId(accountName);
  const location = bareId(locationName);
  if (!account || !location) {
    throw new AppError('Select a Google Business Profile location first', 409);
  }
  return `accounts/${account}/locations/${location}`;
}

export async function listGoogleAccounts(accessToken: string) {
  const data = await googleRequest<any>(`${GOOGLE_HOSTS.accountManagement}/accounts`, accessToken, {
    params: { pageSize: 20 },
  });
  return (data?.accounts || []).map((account: any) => ({
    name: String(account?.name || ''),
    accountName: String(account?.accountName || ''),
    type: String(account?.type || ''),
    verificationState: String(account?.verificationState || ''),
  }));
}

// readMask is mandatory on this endpoint — omitting it is a 400, not a default.
const LOCATION_READ_MASK = [
  'name',
  'title',
  'storefrontAddress',
  'phoneNumbers',
  'websiteUri',
  'metadata',
  'profile',
  'categories',
].join(',');

export function formatAddress(storefrontAddress: any): string {
  if (!storefrontAddress) return '';
  const lines = Array.isArray(storefrontAddress.addressLines) ? storefrontAddress.addressLines : [];
  return [...lines, storefrontAddress.locality, storefrontAddress.administrativeArea, storefrontAddress.postalCode]
    .map((part: unknown) => String(part || '').trim())
    .filter(Boolean)
    .join(', ');
}

export function normalizeLocation(location: any) {
  return {
    name: String(location?.name || ''),
    title: String(location?.title || ''),
    address: formatAddress(location?.storefrontAddress),
    phone: String(location?.phoneNumbers?.primaryPhone || ''),
    website: String(location?.websiteUri || ''),
    mapsUri: String(location?.metadata?.mapsUri || ''),
    newReviewUri: String(location?.metadata?.newReviewUri || ''),
    placeId: String(location?.metadata?.placeId || ''),
    // The one flag that decides whether posting and replying will work at all:
    // an unverified profile accepts neither, and says so only at write time.
    hasVoiceOfMerchant: Boolean(location?.metadata?.hasVoiceOfMerchant),
    canOperateLocalPost: location?.metadata?.canOperateLocalPost !== false,
    primaryCategory: String(location?.categories?.primaryCategory?.displayName || ''),
    description: String(location?.profile?.description || ''),
  };
}

export async function listGoogleLocations(accessToken: string, accountName: string) {
  const account = bareId(accountName);
  if (!account) throw new AppError('A Google Business account is required', 400);

  const data = await googleRequest<any>(
    `${GOOGLE_HOSTS.businessInformation}/accounts/${account}/locations`,
    accessToken,
    { params: { readMask: LOCATION_READ_MASK, pageSize: 100 } }
  );
  return (data?.locations || []).map(normalizeLocation);
}

export function normalizeReview(review: any) {
  return {
    reviewId: String(review?.reviewId || bareId(review?.name)),
    name: String(review?.name || ''),
    reviewer: String(review?.reviewer?.displayName || 'A Google customer'),
    reviewerPhoto: String(review?.reviewer?.profilePhotoUrl || ''),
    rating: starRatingToNumber(review?.starRating),
    comment: String(review?.comment || ''),
    createTime: review?.createTime || null,
    updateTime: review?.updateTime || null,
    reply: review?.reviewReply?.comment ? String(review.reviewReply.comment) : '',
    repliedAt: review?.reviewReply?.updateTime || null,
  };
}

export type NormalizedReview = ReturnType<typeof normalizeReview>;

/**
 * Review-side health, which is the number the owner actually acts on.
 *
 * `unanswered` counts only what is still answerable; `unansweredNegative` is
 * split out because a 1-star with no reply is a different job from a 5-star
 * with no reply, and a single "12 unanswered" hides which one you have.
 */
export function summarizeReviews(reviews: NormalizedReview[], averageRating = 0, totalReviewCount = 0) {
  const unanswered = reviews.filter((review) => !review.reply);
  return {
    averageRating: Math.round(Number(averageRating || 0) * 10) / 10,
    totalReviewCount: Number(totalReviewCount || 0),
    fetched: reviews.length,
    unanswered: unanswered.length,
    unansweredNegative: unanswered.filter((review) => review.rating > 0 && review.rating <= 3).length,
    replyRate: reviews.length ? Math.round(((reviews.length - unanswered.length) / reviews.length) * 100) : 0,
  };
}

export async function listGoogleReviews(accessToken: string, path: string, pageSize = 50) {
  const data = await googleRequest<any>(`${GOOGLE_HOSTS.legacy}/${path}/reviews`, accessToken, {
    params: { pageSize, orderBy: 'updateTime desc' },
  });
  const reviews = (data?.reviews || []).map(normalizeReview);
  return {
    reviews,
    summary: summarizeReviews(reviews, data?.averageRating, data?.totalReviewCount),
    nextPageToken: String(data?.nextPageToken || ''),
  };
}

export async function replyToGoogleReview(accessToken: string, path: string, reviewId: string, comment: string) {
  const id = bareId(reviewId);
  if (!id) throw new AppError('A review is required', 400);
  const text = String(comment || '').trim();
  if (!text) throw new AppError('A reply is required', 400);
  // Google truncates silently past this; refusing is more honest than posting
  // half a reply the owner never sees again.
  if (text.length > 4096) throw new AppError('A Google review reply must be 4096 characters or fewer', 400);

  const data = await googleRequest<any>(`${GOOGLE_HOSTS.legacy}/${path}/reviews/${id}/reply`, accessToken, {
    method: 'PUT',
    data: { comment: text },
  });
  return { comment: String(data?.comment || text), updateTime: data?.updateTime || null };
}

export async function deleteGoogleReviewReply(accessToken: string, path: string, reviewId: string) {
  const id = bareId(reviewId);
  if (!id) throw new AppError('A review is required', 400);
  await googleRequest(`${GOOGLE_HOSTS.legacy}/${path}/reviews/${id}/reply`, accessToken, { method: 'DELETE' });
  return true;
}

export function normalizeLocalPost(post: any) {
  return {
    name: String(post?.name || ''),
    postId: bareId(post?.name),
    summary: String(post?.summary || ''),
    state: String(post?.state || ''),
    topicType: String(post?.topicType || 'STANDARD'),
    searchUrl: String(post?.searchUrl || ''),
    mediaUrl: String(post?.media?.[0]?.googleUrl || post?.media?.[0]?.sourceUrl || ''),
    callToActionUrl: String(post?.callToAction?.url || ''),
    callToActionType: String(post?.callToAction?.actionType || ''),
    createTime: post?.createTime || null,
    updateTime: post?.updateTime || null,
  };
}

export async function listGoogleLocalPosts(accessToken: string, path: string, pageSize = 20) {
  const data = await googleRequest<any>(`${GOOGLE_HOSTS.legacy}/${path}/localPosts`, accessToken, {
    params: { pageSize },
  });
  return (data?.localPosts || []).map(normalizeLocalPost);
}

export const POST_CALL_TO_ACTIONS = [
  'BOOK',
  'ORDER',
  'SHOP',
  'LEARN_MORE',
  'SIGN_UP',
  'CALL',
] as const;

export function buildLocalPostPayload({
  summary,
  actionType = 'LEARN_MORE',
  actionUrl = '',
  mediaUrl = '',
  languageCode = 'en',
}: {
  summary: string;
  actionType?: string;
  actionUrl?: string;
  mediaUrl?: string;
  languageCode?: string;
}) {
  const text = String(summary || '').trim();
  if (!text) throw new AppError('Post text is required', 400);
  // Google's own limit for a STANDARD local post.
  if (text.length > 1500) throw new AppError('A Google post must be 1500 characters or fewer', 400);

  const payload: Record<string, any> = {
    languageCode: String(languageCode || 'en'),
    summary: text,
    topicType: 'STANDARD',
  };

  const url = String(actionUrl || '').trim();
  const action = String(actionType || '').trim().toUpperCase();
  if (action && action !== 'NONE') {
    if (!(POST_CALL_TO_ACTIONS as readonly string[]).includes(action)) {
      throw new AppError('Unsupported call-to-action for a Google post', 400);
    }
    // CALL is the one action type Google resolves from the profile's own phone
    // number, so it must not carry a url; every other type requires one.
    if (action === 'CALL') {
      payload.callToAction = { actionType: 'CALL' };
    } else {
      if (!/^https?:\/\//i.test(url)) throw new AppError('A call-to-action needs an http(s) link', 400);
      payload.callToAction = { actionType: action, url };
    }
  }

  const media = String(mediaUrl || '').trim();
  if (media) {
    if (!/^https?:\/\//i.test(media)) throw new AppError('The post image must be a public http(s) URL', 400);
    payload.media = [{ mediaFormat: 'PHOTO', sourceUrl: media }];
  }

  return payload;
}

export async function createGoogleLocalPost(accessToken: string, path: string, payload: Record<string, any>) {
  const data = await googleRequest<any>(`${GOOGLE_HOSTS.legacy}/${path}/localPosts`, accessToken, {
    method: 'POST',
    data: payload,
  });
  return normalizeLocalPost(data);
}

function toGoogleDate(date: Date) {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/**
 * Collapse the daily time series into the four numbers the dashboard shows,
 * plus a per-day series for the sparkline.
 *
 * Google omits `value` entirely on a zero day rather than sending 0, so every
 * read defaults — a missing key here would otherwise read as NaN and take the
 * whole total with it.
 */
export function summarizePerformance(response: any) {
  const series: Record<string, { date: string; value: number }[]> = {};
  const totals: Record<string, number> = {};

  const multi = response?.multiDailyMetricTimeSeries || [];
  for (const group of multi) {
    for (const entry of group?.dailyMetricTimeSeries || []) {
      const metric = String(entry?.dailyMetric || '');
      if (!metric) continue;
      const points = (entry?.timeSeries?.datedValues || []).map((row: any) => {
        const year = Number(row?.date?.year || 0);
        const month = String(Number(row?.date?.month || 0)).padStart(2, '0');
        const day = String(Number(row?.date?.day || 0)).padStart(2, '0');
        return { date: `${year}-${month}-${day}`, value: Number(row?.value || 0) };
      });
      series[metric] = points;
      totals[metric] = points.reduce((sum: number, point: any) => sum + point.value, 0);
    }
  }

  const sumOf = (metrics: Iterable<string>) =>
    [...metrics].reduce((sum, metric) => sum + (totals[metric] || 0), 0);

  const impressions = sumOf(IMPRESSION_METRICS);
  const calls = totals.CALL_CLICKS || 0;
  const websiteClicks = totals.WEBSITE_CLICKS || 0;
  const directions = totals.BUSINESS_DIRECTION_REQUESTS || 0;
  const conversations = totals.BUSINESS_CONVERSATIONS || 0;
  const actions = calls + websiteClicks + directions + conversations;

  // A daily impressions line, summed across the four splits, for the chart.
  const impressionsByDay = new Map<string, number>();
  for (const metric of IMPRESSION_METRICS) {
    for (const point of series[metric] || []) {
      impressionsByDay.set(point.date, (impressionsByDay.get(point.date) || 0) + point.value);
    }
  }

  return {
    totals: {
      impressions,
      calls,
      websiteClicks,
      directions,
      conversations,
      actions,
      // Percent of people who saw the profile and then did something. This is
      // the number that tells an owner whether the profile is doing its job.
      actionRate: impressions > 0 ? Math.round((actions / impressions) * 1000) / 10 : 0,
    },
    impressionsByDay: [...impressionsByDay.entries()]
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    metrics: totals,
  };
}

export async function fetchGooglePerformance(accessToken: string, locationName: string, days = 30) {
  const location = bareId(locationName);
  if (!location) throw new AppError('Select a Google Business Profile location first', 409);

  // Google has no data for the current day and rejects a future end date, so
  // the window ends yesterday.
  const end = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - Math.max(1, days - 1) * 24 * 60 * 60 * 1000);
  const startDate = toGoogleDate(start);
  const endDate = toGoogleDate(end);

  const params = new URLSearchParams();
  for (const metric of PERFORMANCE_METRICS) params.append('dailyMetrics', metric);
  params.set('dailyRange.start_date.year', String(startDate.year));
  params.set('dailyRange.start_date.month', String(startDate.month));
  params.set('dailyRange.start_date.day', String(startDate.day));
  params.set('dailyRange.end_date.year', String(endDate.year));
  params.set('dailyRange.end_date.month', String(endDate.month));
  params.set('dailyRange.end_date.day', String(endDate.day));

  const data = await googleRequest<any>(
    `${GOOGLE_HOSTS.performance}/locations/${location}:fetchMultiDailyMetricsTimeSeries?${params.toString()}`,
    accessToken
  );

  return {
    range: { days, start: `${startDate.year}-${startDate.month}-${startDate.day}`, end: `${endDate.year}-${endDate.month}-${endDate.day}` },
    ...summarizePerformance(data),
  };
}
