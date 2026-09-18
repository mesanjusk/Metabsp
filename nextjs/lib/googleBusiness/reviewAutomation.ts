import { connectDB } from '@/lib/db/mongo';
import { GoogleBusinessAccount, GoogleBusinessReview } from '@/lib/models';
import logger from '@/lib/utils/logger';
import { draftReviewReply, isAiDraftingConfigured } from './ai';
import { getGoogleBusinessAccess } from './google';
import { listGoogleReviews, locationPath, replyToGoogleReview } from './profile';
import { withLeaderLock } from '@/lib/services/schedulerLock';

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;

function replyTone(account: any) {
  return String(account.customToneRules || 'warm and professional').trim() || 'warm and professional';
}

export async function syncGoogleReviewsForUser(userId: string, { pageSize = 50 } = {}) {
  await connectDB();
  const { account, accessToken } = await getGoogleBusinessAccess(userId);
  const path = locationPath(account.accountName, account.locationName);
  const result = await listGoogleReviews(accessToken, path, pageSize);

  let ingested = 0;
  let drafted = 0;
  let published = 0;
  let failed = 0;

  for (const review of result.reviews) {
    const existing: any = await GoogleBusinessReview.findOne({ userId, reviewId: review.reviewId });

    if (review.reply) {
      await GoogleBusinessReview.findOneAndUpdate(
        { userId, reviewId: review.reviewId },
        {
          $set: {
            tenantId: account.tenantId || null,
            googleBusinessAccountId: account._id,
            reviewerName: review.reviewer,
            starRating: review.rating,
            reviewText: review.comment,
            reviewReplyText: review.reply,
            replyStatus: 'PUBLISHED',
            failureReason: '',
            googleCreatedAt: review.createTime ? new Date(review.createTime) : null,
            googleUpdatedAt: review.updateTime ? new Date(review.updateTime) : null,
            publishedAt: review.repliedAt ? new Date(review.repliedAt) : new Date(),
            lastSyncedAt: new Date(),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      if (!existing) ingested += 1;
      continue;
    }

    if (existing?.replyStatus === 'PUBLISHED') continue;

    let record: any = existing;
    if (!record) {
      record = await GoogleBusinessReview.create({
        userId,
        tenantId: account.tenantId || null,
        googleBusinessAccountId: account._id,
        reviewId: review.reviewId,
        reviewerName: review.reviewer,
        starRating: review.rating,
        reviewText: review.comment,
        replyStatus: 'PENDING_APPROVAL',
        googleCreatedAt: review.createTime ? new Date(review.createTime) : null,
        googleUpdatedAt: review.updateTime ? new Date(review.updateTime) : null,
        lastSyncedAt: new Date(),
      });
      ingested += 1;
    } else {
      record.reviewerName = review.reviewer;
      record.starRating = review.rating;
      record.reviewText = review.comment;
      record.googleUpdatedAt = review.updateTime ? new Date(review.updateTime) : null;
      record.lastSyncedAt = new Date();
      await record.save();
    }

    if (record.reviewReplyText || !isAiDraftingConfigured()) continue;

    try {
      const draft = await draftReviewReply(
        {
          businessName: account.locationTitle || account.accountDisplayName || 'this business',
          category: String(account.metadata?.primaryCategory || ''),
          address: account.locationAddress || '',
          website: account.locationWebsite || '',
          description: String(account.metadata?.description || ''),
        },
        review,
        replyTone(account),
        { allowEmojis: Boolean(account.allowReviewReplyEmojis), supportContact: String(account.reviewSupportContact || '') }
      );

      record.reviewReplyText = draft;
      record.replyStatus = 'PENDING_APPROVAL';
      record.failureReason = '';
      await record.save();
      drafted += 1;

      const threshold = Math.min(5, Math.max(1, Number(account.autoReplyMinRating || 4)));
      if (account.autoReplyEnabled && review.rating >= threshold) {
        const posted = await replyToGoogleReview(accessToken, path, review.reviewId, draft);
        record.reviewReplyText = posted.comment || draft;
        record.replyStatus = 'PUBLISHED';
        record.failureReason = '';
        record.publishedAt = posted.updateTime ? new Date(posted.updateTime) : new Date();
        await record.save();
        published += 1;
      }
    } catch (error: any) {
      record.replyStatus = 'FAILED';
      record.failureReason = String(error?.message || 'Could not generate or publish reply').slice(0, 500);
      await record.save();
      failed += 1;
      logger.error(`[google-review-automation] ${userId}/${review.reviewId}: ${record.failureReason}`);
    }
  }

  account.lastSyncAt = new Date();
  await account.save();

  return {
    ...result,
    automation: { ingested, drafted, published, failed },
  };
}

export async function syncAllGoogleReviewAccounts() {
  await connectDB();
  const accounts: any[] = await GoogleBusinessAccount.find({
    isActive: true,
    status: 'active',
    accountName: { $ne: '' },
    locationName: { $ne: '' },
  }).select('userId');

  let succeeded = 0;
  let failed = 0;

  for (const account of accounts) {
    try {
      await syncGoogleReviewsForUser(String(account.userId));
      succeeded += 1;
    } catch (error: any) {
      failed += 1;
      logger.error(`[google-review-automation] Account ${account._id} sync failed: ${error?.message || error}`);
    }
  }

  return { checked: accounts.length, succeeded, failed };
}

export function startGoogleReviewAutomationScheduler({ intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  const run = () =>
    withLeaderLock('google-review-automation', syncAllGoogleReviewAccounts, { ttlMs: Math.min(intervalMs, 10 * 60 * 1000) })
      .catch((error) => logger.error('[google-review-automation] Scheduled run failed:', error?.message || error));

  void run();
  return setInterval(run, intervalMs).unref();
}
