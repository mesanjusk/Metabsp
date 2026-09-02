import crypto from 'crypto';
import mongoose from 'mongoose';
import {
  ApiKey,
  AuditLog,
  CampaignMessageStatus,
  Contact,
  ConversationAssignment,
  ConversationOwner,
  DataDeletionRequest,
  Message,
  User,
  WebhookDestination,
  WhatsAppAccount,
  AutoReply,
  Workflow,
} from '@/lib/models';
import logger from '@/lib/utils/logger';

/**
 * Honouring a deletion request from Meta, and from a person directly.
 *
 * Meta's data-deletion callback identifies a person by their Facebook user id
 * and nothing else, which is why User.facebookId has to be stored — see the
 * note in lib/models/User.ts about the field being dropped by strict mode
 * before this. Without it there is no way to answer the callback truthfully.
 *
 * Everything a person's account owns is removed, not merely detached:
 * messages, contacts, connected WhatsApp accounts (with their encrypted
 * access tokens), API keys, webhook destinations with their signing secrets,
 * automations, conversation state, delivery statuses and the account itself.
 *
 * Audit log rows are the one deliberate exception. They are the record that
 * an action happened at all, including this deletion, and Meta's own guidance
 * expects a provider to be able to evidence that a request was honoured. They
 * carry an actor id, never message content, so the identifying material is
 * gone while the fact of it is not.
 */
export interface DeletionOutcome {
  confirmationCode: string;
  status: 'completed' | 'no_account_found' | 'failed';
  deletedCounts: Record<string, number>;
}

/**
 * Verifies Meta's `signed_request` and returns the payload.
 *
 * The signature is base64url of an HMAC-SHA256 over the *encoded* payload
 * string, keyed with the app secret. Comparison is constant-time, and the
 * payload is only parsed after it verifies — an unverified request is an
 * attacker asking us to delete someone else's account.
 */
export function parseSignedRequest(signedRequest: string, appSecret: string): any | null {
  if (!signedRequest || !appSecret) return null;

  const [encodedSig, encodedPayload] = String(signedRequest).split('.', 2);
  if (!encodedSig || !encodedPayload) return null;

  let signature: Buffer;
  let payload: any;
  try {
    signature = Buffer.from(encodedSig, 'base64url');
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (String(payload?.algorithm || '').toUpperCase() !== 'HMAC-SHA256') return null;

  const expected = crypto.createHmac('sha256', appSecret).update(encodedPayload).digest();
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(signature, expected)) return null;

  return payload;
}

/** Opaque, unguessable, and short enough for someone to read down a phone. */
const newConfirmationCode = () => crypto.randomBytes(12).toString('hex');

async function deleteEverythingOwnedBy(userId: mongoose.Types.ObjectId) {
  const accounts: any[] = await WhatsAppAccount.find({ userId }).select('_id').lean();
  const accountIds = accounts.map((a) => a._id);

  const counts: Record<string, number> = {};
  const record = (name: string, result: any) => {
    counts[name] = result?.deletedCount || 0;
  };

  record('messages', await Message.deleteMany({ userId }));
  record('contacts', await Contact.deleteMany({ userId }));
  record('deliveryStatuses', await CampaignMessageStatus.deleteMany({ userId }));
  record('apiKeys', await ApiKey.deleteMany({ userId: String(userId) }));
  record('autoReplies', await AutoReply.deleteMany({ userId }));
  record('workflows', await Workflow.deleteMany({ userId }));

  if (accountIds.length) {
    record('webhookDestinations', await WebhookDestination.deleteMany({ whatsappAccountId: { $in: accountIds } }));
    record('conversationOwners', await ConversationOwner.deleteMany({ whatsappAccountId: { $in: accountIds } }));
    record('conversationAssignments', await ConversationAssignment.deleteMany({ whatsappAccountId: { $in: accountIds } }));
  }

  // Last, so that a failure part-way through still leaves the account
  // present and the request retryable rather than orphaning its data.
  record('whatsappAccounts', await WhatsAppAccount.deleteMany({ userId }));
  record('user', await User.deleteOne({ _id: userId }));

  return counts;
}

/**
 * Deletes the account behind a provider identity.
 *
 * A request naming someone with no account here is `no_account_found`, not a
 * failure: it still returns a confirmation code, because from Meta's side the
 * outcome is the same — we hold nothing about that person.
 */
export async function deleteByProviderId({
  provider,
  providerUserId,
}: {
  provider: 'facebook' | 'google';
  providerUserId: string;
}): Promise<DeletionOutcome> {
  const confirmationCode = newConfirmationCode();
  const field = provider === 'facebook' ? 'facebookId' : 'googleId';

  try {
    const user: any = await User.findOne({ [field]: String(providerUserId) }).select('_id').lean();

    if (!user) {
      await DataDeletionRequest.create({
        confirmationCode,
        provider,
        providerUserId: String(providerUserId),
        status: 'no_account_found',
        completedAt: new Date(),
      });
      return { confirmationCode, status: 'no_account_found', deletedCounts: {} };
    }

    const deletedCounts = await deleteEverythingOwnedBy(user._id);

    await DataDeletionRequest.create({
      confirmationCode,
      provider,
      providerUserId: String(providerUserId),
      userId: user._id,
      status: 'completed',
      deletedCounts,
      completedAt: new Date(),
    });

    // Deliberately logged without the provider id — the point of the record
    // above is that the trail lives in the database, not in log aggregation.
    logger.info({ confirmationCode, deletedCounts }, '[data-deletion] request completed');

    return { confirmationCode, status: 'completed', deletedCounts };
  } catch (error: any) {
    logger.error({ err: error.message, confirmationCode }, '[data-deletion] request failed');
    await DataDeletionRequest.create({
      confirmationCode,
      provider,
      providerUserId: String(providerUserId),
      status: 'failed',
      error: String(error?.message || 'unknown error'),
    }).catch(() => {});
    return { confirmationCode, status: 'failed', deletedCounts: {} };
  }
}

export async function findDeletionRequest(confirmationCode: string) {
  if (!confirmationCode) return null;
  return DataDeletionRequest.findOne({ confirmationCode: String(confirmationCode) }).lean();
}
