import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { requireServiceAccess } from '@/lib/services/serviceAccess';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import { checkWhatsApp24hWindow } from '@/lib/whatsapp/twentyFourHourGuard';
import { dispatchTextMessage, normalizePhone } from '@/lib/whatsapp/dispatch';
import { getGoogleBusinessAccess } from '@/lib/googleBusiness/google';

/**
 * Ask a customer for a Google review over the WhatsApp number this workspace
 * already owns.
 *
 * This is the one thing a standalone local-marketing vendor cannot do for this
 * user: the reviews live on Google, the customer relationship lives in the
 * shared inbox, and both are already here. It sends a plain text message, so it
 * is bound by the same 24-hour customer-care window as every other free-form
 * send — outside it, WhatsApp requires an approved template, and the route says
 * so rather than failing with Meta's error code.
 */
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    await requireServiceAccess(authed, 'whatsapp');

    const body = await req.json();
    const to = normalizePhone(body?.to);
    if (!to) throw new AppError('A customer phone number is required', 400);

    const { account } = await getGoogleBusinessAccess(authed.id);
    const reviewLink = String(account.newReviewUri || account.mapsUri || '').trim();
    if (!reviewLink) {
      throw new AppError(
        'Google has not published a review link for this location yet. Select a verified location first.',
        409
      );
    }

    const template = String(body?.message || '').trim();
    if (!template) throw new AppError('A message is required', 400);
    // The drafts carry {{link}} so the owner can move the link inside the text;
    // a message that never mentions it still gets the link appended.
    const message = template.includes('{{link}}')
      ? template.replaceAll('{{link}}', reviewLink)
      : `${template}\n\n${reviewLink}`;

    // `any` for the same reason every other sender uses it: the resolver can
    // return the legacy environment config, which carries no account document.
    const accountContext: any = await resolveCurrentWhatsAppAccountForUser(authed.id);
    const windowCheck = await checkWhatsApp24hWindow({
      messageType: 'text',
      to,
      whatsappAccountId: accountContext?.account?._id,
      userId: authed.id,
    });
    if (!windowCheck.allowed) {
      throw new AppError(
        'This customer has not messaged in the last 24 hours, so WhatsApp only allows an approved template here. Send the review request from Broadcasts using a template instead.',
        403
      );
    }

    await dispatchTextMessage({ accountContext, userId: authed.id, to, body: message });

    return NextResponse.json({ success: true, data: { to, reviewLink, message } });
  } catch (error) {
    return errorResponse(error, 'Failed to send the review request');
  }
}
