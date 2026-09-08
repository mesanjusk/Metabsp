import axios from 'axios';
import AppError from '../utils/AppError';
import WhatsAppAccount from '../models/WhatsAppAccount';
import { sanitizeAccount } from '../services/whatsappAccountService';
import { ensureTenantForUser } from '../services/tenantService';
import { getGraphApiVersion } from '../config/graphApi';
import { decryptSensitiveValue } from '../utils/crypto';
import {
  checkWhatsAppHealth,
  isDefinitiveWhatsAppDisconnectReason,
} from '../services/whatsappHealthService';
import logger from '../utils/logger';

// Ported from backend/src/controllers/whatsappController.js's connection-
// management section (upsertAndActivateAccountForUser, subscribeAppToWaba,
// isMetaNumericId) — shared by the connect/embedded-signup/manual-connect
// route handlers.
export { sanitizeAccount };

export const isMetaNumericId = (value: unknown) => /^\d+$/.test(String(value || ''));

/**
 * Reclaim a WhatsApp phone number only when an older SanjuSK claim is stale.
 *
 * A customer can remove the integration directly in Meta and then reconnect
 * before the old SanjuSK workspace has polled Meta again. The old Mongo row can
 * therefore still say numberClaimed=true even though Meta has revoked it.
 *
 * We never steal a healthy claim: only a locally-disconnected row or a row
 * whose stored token definitively fails Meta authorization/object access is
 * released. Timeouts and Meta 5xx responses keep the old claim intact.
 */
export const ensurePhoneClaimAvailable = async ({
  phoneNumberId,
  userId,
}: {
  phoneNumberId: string;
  userId: string;
}) => {
  const normalizedPhoneNumberId = String(phoneNumberId || '').trim();

  // Repair historical rows created before disconnect reconciliation cleared
  // numberClaimed. They are already disconnected, so they cannot own the
  // number anymore.
  await WhatsAppAccount.updateMany(
    {
      phoneNumberId: normalizedPhoneNumberId,
      userId: { $ne: userId },
      status: 'disconnected',
      numberClaimed: true,
    },
    {
      $set: {
        numberClaimed: false,
        isActive: false,
        webhookSubscribed: false,
      },
    }
  );

  const conflict: any = await WhatsAppAccount.findOne({
    phoneNumberId: normalizedPhoneNumberId,
    userId: { $ne: userId },
    numberClaimed: true,
  }).lean();

  if (!conflict) return;

  try {
    const encryptedToken = String(conflict.accessTokenEncrypted || '');
    if (encryptedToken) {
      const accessToken = decryptSensitiveValue(encryptedToken);
      const health = await checkWhatsAppHealth({
        accessToken,
        phoneNumberId: normalizedPhoneNumberId,
        graphVersion: getGraphApiVersion(),
      });

      if (!health.isConnected && isDefinitiveWhatsAppDisconnectReason(health.reason)) {
        const now = new Date();
        const released = await WhatsAppAccount.updateOne(
          { _id: conflict._id, numberClaimed: true },
          {
            $set: {
              status: 'disconnected',
              isActive: false,
              numberClaimed: false,
              webhookSubscribed: false,
              lastSyncAt: now,
              'metadata.metaDisconnectedAt': now,
              'metadata.metaDisconnectReason': String(health.reason || 'ACCESS_REVOKED'),
            },
          }
        );

        if (Number(released.modifiedCount || 0) > 0) {
          logger.info(
            `[whatsapp] Released stale phone-number claim ${normalizedPhoneNumberId} from account ${String(conflict._id)}`
          );
          return;
        }
      }
    }
  } catch (error: any) {
    // A decryption/config/network error is not proof that the old workspace
    // lost ownership. Keeping the claim is the safe failure mode.
    logger.warn(
      `[whatsapp] Could not verify existing claim for phone_number_id=${normalizedPhoneNumberId}: ${error.message}`
    );
  }

  throw new AppError(
    'This WhatsApp number is still connected to another SanjuSK account. Remove it from that account first, or disconnect the integration in Meta and try again after the old access is revoked.',
    409
  );
};

export const upsertAndActivateAccountForUser = async ({
  userId,
  phoneNumberId,
  setPayload,
}: {
  userId: string;
  phoneNumberId: string;
  setPayload: Record<string, unknown>;
}) => {
  await ensurePhoneClaimAvailable({ phoneNumberId, userId });
  await WhatsAppAccount.updateMany({ userId, isActive: true }, { $set: { isActive: false } });

  let tenantId = null;
  try {
    tenantId = await ensureTenantForUser(userId);
  } catch (error: any) {
    logger.error('[tenant] Failed to provision tenant for user', userId, error.message);
  }

  try {
    const account = await WhatsAppAccount.findOneAndUpdate(
      { userId, phoneNumberId: String(phoneNumberId) },
      {
        $set: {
          userId,
          phoneNumberId: String(phoneNumberId),
          ...setPayload,
          ...(tenantId ? { tenantId } : {}),
          isActive: true,
          numberClaimed: true,
        },
      },
      { upsert: true, new: true }
    );
    return account;
  } catch (error: any) {
    if (error?.code === 11000) {
      throw new AppError('This WhatsApp number is already connected to a different account.', 409);
    }
    throw error;
  }
};

// Best-effort — a WABA connected via Embedded Signup or a manually pasted
// token does not receive webhooks until the app is added to its
// subscribed_apps list.
export const subscribeAppToWaba = async ({ wabaId, accessToken }: { wabaId: string; accessToken: string }): Promise<boolean> => {
  try {
    await axios.post(
      `https://graph.facebook.com/${getGraphApiVersion()}/${wabaId}/subscribed_apps`,
      {},
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 15000 }
    );
    return true;
  } catch (error: any) {
    // Not '[embedded-signup]': this also runs from account revalidation, and a
    // prefix naming the wrong flow sends whoever greps for it to the wrong
    // place. Meta's own reason is the useful part — without it the failure is
    // indistinguishable from a network blip, and the consequence is that the
    // number sends fine and receives nothing.
    logger.error(
      `[whatsapp] Failed to subscribe this app to WABA ${wabaId} — inbound webhooks will NOT be delivered for it. ` +
        `Meta said: ${JSON.stringify(error?.response?.data || error.message)}`
    );
    return false;
  }
};
