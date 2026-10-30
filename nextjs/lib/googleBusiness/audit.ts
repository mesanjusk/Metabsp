import type { listAllGoogleReviews, normalizeLocation } from './profile';

type Location = ReturnType<typeof normalizeLocation>;
type ReviewPages = Awaited<ReturnType<typeof listAllGoogleReviews>>;

export type GoogleAuditCheck = {
  id: string;
  title: string;
  status: 'measured' | 'guidance' | 'not-measured';
  result: string;
  explanation: string;
};

/**
 * A factual alternative to third-party "Google ranking scores". There is no
 * score, category-volume threshold or claim that keywords in the legal name
 * improve rank. Every observed number comes from the connected profile.
 */
export function buildGoogleBusinessAudit(location: Location, pages: ReviewPages, now = new Date()) {
  const { reviews, summary } = pages;
  const totalsMatch = summary.totalReviewCount === reviews.length;
  const complete = pages.complete && totalsMatch;
  const replied = reviews.filter((review) => Boolean(review.reply)).length;
  const twelveWeeksAgo = now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000;
  const recentReviews = reviews.filter((review) => {
    const created = review.createTime ? new Date(review.createTime).getTime() : NaN;
    return Number.isFinite(created) && created >= twelveWeeksAgo && created <= now.getTime();
  }).length;
  const weeklyRate = complete ? Math.round((recentReviews / 12) * 100) / 100 : null;
  const observedDescription = location.description || '';
  const printingPhrasePresent = /printing shop/i.test(observedDescription);

  const checks: GoogleAuditCheck[] = [
    {
      id: 'review-frequency',
      title: 'New reviews per week',
      status: complete ? 'measured' : 'not-measured',
      result: complete ? `${weeklyRate} reviews/week (last 12 weeks)` : 'Complete review history unavailable',
      explanation: 'Calculated from Google review dates. Google does not require two new reviews every week.',
    },
    {
      id: 'unanswered-reviews',
      title: 'Unanswered reviews and reply rate',
      status: complete ? 'measured' : 'not-measured',
      result: complete
        ? `${summary.unanswered} unanswered; ${summary.replyRate}% replied`
        : `${summary.unanswered} unanswered in ${reviews.length} loaded; incomplete coverage`,
      explanation: 'The reply count and rate use the same set of reviews, so they cannot contradict each other.',
    },
    {
      id: 'keywords-everywhere',
      title: 'Keywords required in five fields',
      status: 'guidance',
      result: 'Not an official Google rule',
      explanation: 'Use accurate services, categories and a helpful description; do not force identical keywords into every field.',
    },
    {
      id: 'keyword-in-title',
      title: 'Primary keyword missing from business name',
      status: 'guidance',
      result: 'Do not keyword-stuff the business name',
      explanation: 'The name must match the actual public-facing business name, including signage and branding.',
    },
    {
      id: 'primary-category-top-three',
      title: 'Primary category not among three high-volume terms',
      status: 'guidance',
      result: location.primaryCategory || 'Primary category not returned',
      explanation: 'Choose the category that most accurately describes the main business. There is no top-three volume requirement.',
    },
    {
      id: 'additional-categories-top-ten',
      title: 'At least three additional high-volume categories',
      status: 'guidance',
      result: `${location.additionalCategories.length} additional categories`,
      explanation: 'Only add categories for genuine activities. Google does not prescribe three categories in a top-ten list.',
    },
    {
      id: 'keyword-in-services',
      title: '“Printing shop” missing from services',
      status: 'not-measured',
      result: 'Service keyword not independently checked',
      explanation: 'This audit does not yet load the service-item catalog. A missing exact phrase is not itself a Google penalty.',
    },
    {
      id: 'keyword-in-description',
      title: '“Printing shop” missing from description',
      status: 'measured',
      result: printingPhrasePresent ? 'Exact phrase appears' : 'Exact phrase does not appear',
      explanation: 'An accurate, natural description helps customers; Google does not require this exact phrase.',
    },
  ];

  return {
    auditedAt: now.toISOString(),
    source: 'Connected Google Business Profile API; no third-party ranking score',
    rankingAvailable: false,
    profile: {
      title: location.title,
      address: location.address,
      website: location.website,
      phone: location.phone,
      primaryCategory: location.primaryCategory,
      additionalCategories: location.additionalCategories,
      description: location.description,
      hasVoiceOfMerchant: location.hasVoiceOfMerchant,
    },
    reviews: {
      averageRating: summary.averageRating,
      googleTotal: summary.totalReviewCount,
      loaded: reviews.length,
      replied,
      unanswered: summary.unanswered,
      unansweredNegative: summary.unansweredNegative,
      replyRate: complete ? summary.replyRate : null,
      recentReviews,
      weeklyRate,
      complete,
      pagesFetched: pages.pagesFetched,
      ...(totalsMatch ? {} : { coverageWarning: 'Google review total differs from the number returned by the API.' }),
    },
    checks,
  };
}
