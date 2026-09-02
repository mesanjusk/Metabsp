import axios from 'axios';
import AppError from '../utils/AppError';
import WhatsAppAccount from '../models/WhatsAppAccount';
import { assertPhoneNumberAvailable, sanitizeAccount } from '../services/whatsappAccountService';
import { ensureTenantForUser } from '../services/tenantService';
import { getGraphApiVersion } from '../config/graphApi';
import logger from '../utils/logger';

// Ported from backend/src/controllers/whatsappController.js's connection-
// management section (upsertAndActivateAccountForUser, subscribeAppToWaba,
// isMetaNumericId) — shared by the connect/embedded-signup/manual-connect
// route handlers.
export { sanitizeAccount };

export const isMetaNumericId = (value: unknown) => /^\d+$/.test(String(value || ''));

export const upsertAndActivateAccountForUser = async ({
  userId,
  phoneNumberId,
  setPayload,
}: {
  userId: string;
  phoneNumberId: string;
  setPayload: Record<string, unknown>;
}) => {
  await assertPhoneNumberAvailable({ phoneNumberId, userId });
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
