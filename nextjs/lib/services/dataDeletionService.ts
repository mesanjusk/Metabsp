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
  InstagramAccount,
  Message,
  User,
  WebhookDestination,
  WhatsAppAccount,
  AutoReply,
  Workflow,
  GoogleBusinessAccount,
  GoogleBusinessReview,
  RcsAgent,
  RcsConsent,
  RcsMessage,
  ServiceEntitlement,
  StoreProfile,
  StoreProduct,
  StoreCategory,
  StoreInquiry,
  InstituteRecord,
  InstituteAdmission,
  InstituteFee,
  InstituteIDCardProject,
  InstituteIDCardStudent,
  InstituteDesign,
  InstituteForm,
  InstituteFormResponse,
  CloudOtpVerification,
} from '@/lib/models';
import SmbRecord from '@/lib/models/SmbRecord';
import BusinessProfile from '@/lib/models/BusinessProfile';
import AttendanceDevice from '@/lib/models/AttendanceDevice';
import AttendanceProfile from '@/lib/models/AttendanceProfile';
import AttendanceRecord from '@/lib/models/AttendanceRecord';
import AttendanceSettings from '@/lib/models/AttendanceSettings';
import LeadSearchJob from '@/lib/models/LeadSearchJob';
import ProspectLead from '@/lib/models/ProspectLead';
import cloudinary from '@/lib/utils/cloudinary';
import { derivePublicIdFromUrl } from '@/lib/services/dataRetentionService';
import logger from '@/lib/utils/logger';

/**
 * Honouring a deletion request from Meta, and from a person directly.
 *
 * Meta's data-deletion callback identifies a person by their provider-specific
 * user id and nothing else. Facebook identities resolve through User.facebookId;
 * Instagram Login identities resolve through InstagramAccount, which stores
 * the Instagram app-scoped id returned by the authorization flow.
 *
 * Everything a person's account owns is removed, not merely detached:
 * messages, contacts, connected WhatsApp/Instagram accounts (with encrypted
 * access tokens), API keys, webhook destinations with their signing secrets,
 * automations, conversation state, delivery statuses, SMB business records and
 * the account itself.
 *
 * Audit log rows are the one deliberate exception. They are the record that
 * an action happened at all, including this deletion, and Meta's own guidance
 * expects a provider to be able to evidence that a request was honoured. They
 * carry an actor id, never message content, so the identifying material is
 * gone while the fact of it is not.
 */
export interface DeletionOutcome {
  confirmationCode: string;
  status: 'pending' | 'completed' | 'no_account_found' | 'failed';
  deletedCounts: Record<string, number>;
}

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

const newConfirmationCode = () => crypto.randomBytes(12).toString('hex');

export async function createManualDeletionRequest({
  requesterEmail,
  accountId = '',
  reason = '',
  notes = '',
}: {
  requesterEmail: string;
  accountId?: string;
  reason?: string;
  notes?: string;
}) {
  const confirmationCode = newConfirmationCode();
  const request = await DataDeletionRequest.create({
    confirmationCode,
    provider: 'manual',
    requestType: 'manual',
    requesterEmail: String(requesterEmail || '').trim().toLowerCase(),
    accountId: String(accountId || '').trim().slice(0, 120),
    reason: String(reason || '').trim().slice(0, 120),
    notes: String(notes || '').trim().slice(0, 2000),
    status: 'pending',
  });

  await AuditLog.create({
    action: 'data_deletion.manual_request',
    resource: 'data_deletion',
    outcome: 'success',
    metadata: { confirmationCode },
  }).catch(() => {});

  logger.info({ confirmationCode }, '[data-deletion] manual privacy request recorded');
  return request.toObject();
}

async function deleteEverythingOwnedBy(userId: mongoose.Types.ObjectId, mobile = '') {
  const accounts: any[] = await WhatsAppAccount.find({ userId }).select('_id').lean();
  const accountIds = accounts.map((a) => a._id);
  const counts: Record<string, number> = {};
  const record = (name: string, result: any) => { counts[name] = result?.deletedCount || 0; };

  // Delete mirrored WhatsApp media before deleting the rows that tell us where
  // those assets live. A database-only delete would leave customer media in
  // Cloudinary with no remaining dashboard record pointing to it.
  const mediaRows: any[] = await Message.find({ userId, mediaUrl: { $exists: true, $ne: '' } })
    .select('mediaUrl mediaPublicId mediaResourceType')
    .lean();
  let mediaFiles = 0;
  for (const row of mediaRows) {
    const parsed = derivePublicIdFromUrl(String(row.mediaUrl || ''));
    const publicId = row.mediaPublicId || parsed?.publicId;
    if (!publicId) continue;
    try {
      await (cloudinary as any).uploader.destroy(publicId, {
        resource_type: row.mediaResourceType || parsed?.resourceType || 'image',
      });
      mediaFiles += 1;
    } catch (error: any) {
      logger.warn({ err: error?.message, publicId }, '[data-deletion] could not remove mirrored media');
    }
  }
  counts.mediaFiles = mediaFiles;

  record('messages', await Message.deleteMany({ userId }));
  record('contacts', await Contact.deleteMany({ userId }));
  record('smbRecords', await SmbRecord.deleteMany({ userId }));
  record('businessProfiles', await BusinessProfile.deleteMany({ userId }));
  record('deliveryStatuses', await CampaignMessageStatus.deleteMany({ userId }));
  record('apiKeys', await ApiKey.deleteMany({ userId: String(userId) }));
  record('autoReplies', await AutoReply.deleteMany({ userId }));
  record('workflows', await Workflow.deleteMany({ userId }));
  record('googleBusinessReviews', await GoogleBusinessReview.deleteMany({ userId }));
  record('googleBusinessAccounts', await GoogleBusinessAccount.deleteMany({ userId }));
  record('rcsMessages', await RcsMessage.deleteMany({ userId }));
  record('rcsConsents', await RcsConsent.deleteMany({ userId }));
  record('rcsAgents', await RcsAgent.deleteMany({ userId }));
  record('serviceEntitlements', await ServiceEntitlement.deleteMany({ userId }));
  record('storeInquiries', await StoreInquiry.deleteMany({ ownerUserId: userId }));
  record('storeProducts', await StoreProduct.deleteMany({ ownerUserId: userId }));
  record('storeCategories', await StoreCategory.deleteMany({ ownerUserId: userId }));
  record('storeProfiles', await StoreProfile.deleteMany({ ownerUserId: userId }));
  record('instituteFormResponses', await InstituteFormResponse.deleteMany({ ownerUserId: userId }));
  record('instituteForms', await InstituteForm.deleteMany({ ownerUserId: userId }));
  record('instituteIdCardStudents', await InstituteIDCardStudent.deleteMany({ ownerUserId: userId }));
  record('instituteIdCardProjects', await InstituteIDCardProject.deleteMany({ ownerUserId: userId }));
  record('instituteDesigns', await InstituteDesign.deleteMany({ ownerUserId: userId }));
  record('instituteFees', await InstituteFee.deleteMany({ ownerUserId: userId }));
  record('instituteAdmissions', await InstituteAdmission.deleteMany({ ownerUserId: userId }));
  record('instituteRecords', await InstituteRecord.deleteMany({ ownerUserId: userId }));
  record('attendanceRecords', await AttendanceRecord.deleteMany({ ownerUserId: userId }));
  record('attendanceProfiles', await AttendanceProfile.deleteMany({ ownerUserId: userId }));
  record('attendanceSettings', await AttendanceSettings.deleteMany({ ownerUserId: userId }));
  record('attendanceDevices', await AttendanceDevice.deleteMany({ ownerUserId: userId }));
  record('prospectLeads', await ProspectLead.deleteMany({ userId }));
  record('leadSearchJobs', await LeadSearchJob.deleteMany({ userId }));
  if (mobile) record('otpVerifications', await CloudOtpVerification.deleteMany({ mobile }));

  if (accountIds.length) {
    record('webhookDestinations', await WebhookDestination.deleteMany({ whatsappAccountId: { $in: accountIds } }));
    record('conversationOwners', await ConversationOwner.deleteMany({ whatsappAccountId: { $in: accountIds } }));
    record('conversationAssignments', await ConversationAssignment.deleteMany({ whatsappAccountId: { $in: accountIds } }));
  }

  record('whatsappAccounts', await WhatsAppAccount.deleteMany({ userId }));
  record('instagramAccounts', await InstagramAccount.deleteMany({ userId }));
  record('user', await User.deleteOne({ _id: userId }));
  return counts;
}

export async function deleteByProviderId({
  provider,
  providerUserId,
}: {
  provider: 'facebook' | 'google' | 'instagram';
  providerUserId: string;
}): Promise<DeletionOutcome> {
  const confirmationCode = newConfirmationCode();

  try {
    let user: any = null;
    if (provider === 'instagram') {
      const instagramAccount: any = await InstagramAccount.findOne({
        $or: [
          { instagramAppScopedId: String(providerUserId) },
          { instagramUserId: String(providerUserId) },
        ],
      }).select('userId').lean();
      if (instagramAccount?.userId) user = await User.findById(instagramAccount.userId).select('_id mobile').lean();
    } else {
      const field = provider === 'facebook' ? 'facebookId' : 'googleId';
      user = await User.findOne({ [field]: String(providerUserId) }).select('_id mobile').lean();
    }

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

    const deletedCounts = await deleteEverythingOwnedBy(user._id, String(user.mobile || ''));

    await DataDeletionRequest.create({
      confirmationCode,
      provider,
      providerUserId: String(providerUserId),
      userId: user._id,
      status: 'completed',
      deletedCounts,
      completedAt: new Date(),
    });

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
