import axios from 'axios';
import AppError from '../utils/AppError';
import { getGraphApiVersion } from '../config/graphApi';

// Ported from backend/src/services/whatsappCredentialValidationService.js, with
// the WABA id actually checked — see assertIsWhatsAppBusinessAccount.
const authHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` });

/**
 * Is this id a WhatsApp Business Account, or something else entirely?
 *
 * It has to be asked, because the three ids a person copies out of the Meta
 * App Dashboard look identical — same length, same digits, adjacent on screen:
 * the App ID, the business portfolio id, and the WABA id. Only the last one is
 * a WABA, and nothing downstream notices the difference until inbound messages
 * silently never arrive. A deployment was found storing its App ID here: sends
 * worked (those go to /{phone_number_id}/messages), and not one webhook was
 * ever delivered, for months, with no error anywhere.
 *
 * `subscribed_apps` is the discriminator rather than a field list because it is
 * the exact edge the app needs next: only a WABA has it, and an App node
 * answers `(#100) Tried accessing nonexisting field (subscribed_apps)`. Asking
 * the question with the same call that will later do the work means a pass
 * here cannot be a pass on a technicality.
 */
export const assertIsWhatsAppBusinessAccount = async ({
  id,
  accessToken,
  graphVersion,
}: {
  id: string;
  accessToken: string;
  graphVersion: string;
}): Promise<{ verified: boolean; reason?: string }> => {
  try {
    await axios.get(`https://graph.facebook.com/${graphVersion}/${id}/subscribed_apps`, {
      headers: authHeader(accessToken),
      timeout: 12000,
    });
    return { verified: true };
  } catch (error: any) {
    const apiError = error?.response?.data?.error || {};
    const message = String(apiError.message || error.message || '');

    // The node exists and is not a WABA. This is the one case worth refusing
    // outright: it is never a transient failure and never becomes correct.
    if (/nonexisting field \(subscribed_apps\)/i.test(message) || Number(apiError.code) === 100) {
      throw new AppError(
        `${id} is not a WhatsApp Business Account. It is most likely the Meta App ID or the business ` +
          'portfolio id — both sit next to the WABA ID in the App Dashboard and look the same. ' +
          'Find the WhatsApp Business Account ID under WhatsApp → API Setup.',
        400
      );
    }

    // Anything else — a permission gap, a rate limit, a network blip — leaves
    // the question open. Refusing a connection over it would be worse than
    // proceeding: the id may well be right, and the caller records that it
    // went unverified rather than claiming it passed.
    return { verified: false, reason: message };
  }
};

/**
 * Which WABAs does this token actually carry, according to Meta.
 *
 * Typed input is the least trustworthy source available, and `debug_token`
 * gives the authoritative one: the granular scope for
 * `whatsapp_business_messaging` lists exactly the WABAs the token is scoped
 * to. Needs an app access token, so it degrades to an empty list when the app
 * credentials are not configured rather than failing the connection.
 */
export const resolveWabaIdsFromToken = async ({
  accessToken,
  graphVersion,
  appId = process.env.META_APP_ID,
  appSecret = process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET,
}: {
  accessToken: string;
  graphVersion: string;
  appId?: string;
  appSecret?: string;
}): Promise<string[]> => {
  if (!appId || !appSecret) return [];

  try {
    const response = await axios.get(`https://graph.facebook.com/${graphVersion}/debug_token`, {
      params: { input_token: accessToken, access_token: `${appId}|${appSecret}` },
      timeout: 12000,
    });

    const scopes: any[] = response?.data?.data?.granular_scopes || [];
    const messaging = scopes.find((scope: any) => String(scope?.scope || '') === 'whatsapp_business_messaging');
    return (messaging?.target_ids || []).map((value: any) => String(value)).filter(Boolean);
  } catch (_error) {
    return [];
  }
};

export const validateManualWhatsAppCredentials = async ({
  accessToken,
  phoneNumberId,
  businessAccountId,
  wabaId,
}: {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId?: string;
  wabaId?: string;
}) => {
  const GRAPH_VERSION = getGraphApiVersion();
  const normalizedToken = String(accessToken || '').trim();
  const normalizedPhoneNumberId = String(phoneNumberId || '').trim();
  const normalizedBusinessAccountId = String(businessAccountId || '').trim();
  const normalizedWabaId = String(wabaId || '').trim();

  if (!normalizedToken || !normalizedPhoneNumberId || (!normalizedBusinessAccountId && !normalizedWabaId)) {
    throw new AppError('accessToken, phoneNumberId and businessAccountId or wabaId are required', 400);
  }

  try {
    const [tokenResponse, phoneResponse] = await Promise.all([
      axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/me`, {
        headers: authHeader(normalizedToken),
        params: { fields: 'id,name' },
        timeout: 10000,
      }),
      axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${normalizedPhoneNumberId}`, {
        headers: authHeader(normalizedToken),
        params: { fields: 'id,display_phone_number,verified_name,quality_rating,status' },
        timeout: 12000,
      }),
    ]);

    const phoneData = phoneResponse?.data || {};
    const accountData = {
      tokenType: 'Bearer',
      appScopedMetaUserId: String(tokenResponse?.data?.id || ''),
      phoneNumberId: String(phoneData.id || normalizedPhoneNumberId),
      displayPhoneNumber: String(phoneData.display_phone_number || ''),
      verifiedName: String(phoneData.verified_name || ''),
    };

    const ownerBusinessAccountId = '';
    const phoneWabaId = '';
    const effectiveBusinessAccountId = normalizedBusinessAccountId;

    let resolvedWabaId = normalizedWabaId || '';
    let wabaMembershipValidated = false;

    // Ask Meta which WABAs this token is actually for. Used both to fill in a
    // missing id and to catch a supplied one that belongs to something else.
    const tokenWabaIds = await resolveWabaIdsFromToken({ accessToken: normalizedToken, graphVersion: GRAPH_VERSION });

    if (effectiveBusinessAccountId) {
      try {
        const wabaResponse = await axios.get(
          `https://graph.facebook.com/${GRAPH_VERSION}/${effectiveBusinessAccountId}/owned_whatsapp_business_accounts`,
          { headers: authHeader(normalizedToken), params: { fields: 'id,name' }, timeout: 12000 }
        );

        const wabas: any[] = Array.isArray(wabaResponse?.data?.data) ? wabaResponse.data.data : [];
        const allWabaIds = new Set(wabas.map((waba) => String(waba.id || '')).filter(Boolean));
        const firstWabaId = String(wabas[0]?.id || '');

        if (normalizedWabaId && allWabaIds.size > 0 && !allWabaIds.has(normalizedWabaId)) {
          throw new AppError('wabaId does not belong to the provided businessAccountId', 400);
        }

        resolvedWabaId = normalizedWabaId || firstWabaId || '';
        wabaMembershipValidated = true;
      } catch (error) {
        if (error instanceof AppError) throw error;
      }
    }

    // Nothing usable was typed, or what was typed is not among the token's
    // WABAs — take Meta's answer over the form's in both cases.
    if (!resolvedWabaId && tokenWabaIds.length) {
      resolvedWabaId = tokenWabaIds[0];
    } else if (resolvedWabaId && tokenWabaIds.length && !tokenWabaIds.includes(resolvedWabaId)) {
      throw new AppError(
        `${resolvedWabaId} is not one of the WhatsApp Business Accounts this access token is scoped to ` +
          `(${tokenWabaIds.join(', ')}). Use one of those.`,
        400
      );
    }

    if (!resolvedWabaId) {
      throw new AppError(
        'Could not determine the WhatsApp Business Account ID. Supply the WABA ID from WhatsApp → API Setup.',
        400
      );
    }

    // Last gate, and the one that would have caught an App ID pasted into the
    // WABA field even with no business account id and no token scopes to
    // cross-check against.
    const wabaCheck = await assertIsWhatsAppBusinessAccount({
      id: resolvedWabaId,
      accessToken: normalizedToken,
      graphVersion: GRAPH_VERSION,
    });

    return {
      ...accountData,
      businessAccountId: effectiveBusinessAccountId,
      wabaId: resolvedWabaId,
      metadata: {
        verifiedAt: new Date().toISOString(),
        validationSource: 'meta_graph',
        phoneWabaId,
        ownerBusinessAccountId,
        wabaMembershipValidated,
        wabaIdVerified: wabaCheck.verified,
        wabaIdVerificationNote: wabaCheck.reason || '',
        tokenWabaIds,
      },
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    const apiMessage = error?.response?.data?.error?.message;
    throw new AppError(apiMessage || 'Manual WhatsApp credentials are invalid', 400);
  }
};
