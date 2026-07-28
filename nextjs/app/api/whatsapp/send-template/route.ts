import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { checkUserRateLimit } from '@/lib/http/rateLimit';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import { dispatchTemplateMessage } from '@/lib/whatsapp/dispatch';
import AppError from '@/lib/utils/AppError';

// Ported from backend/src/controllers/whatsappController.js's sendTemplate.
// No 24h-window guard — templates are exempt, same as the original.
export async function POST(req: NextRequest) {
  await connectDB();
  try {
    const authed = await requireAuth(req);

    const allowed = await checkUserRateLimit(authed.id, { windowMs: 60 * 1000, maxRequests: 30 });
    if (!allowed) {
      return NextResponse.json({ success: false, message: 'Rate limit exceeded. Please retry later.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { to, templateName, template_name, language = 'en_US', components = [], Components = [] } = body || {};
    const resolvedTemplate = String(templateName || template_name || '').trim();
    if (!to || !resolvedTemplate) throw new AppError('to and templateName are required', 400);

    const normalizedComponents = Array.isArray(components) ? components : Array.isArray(Components) ? Components : [];

    const accountContext = await resolveCurrentWhatsAppAccountForUser(authed.id);
    const data = await dispatchTemplateMessage({
      accountContext,
      userId: authed.id,
      to,
      templateName: resolvedTemplate,
      language,
      components: normalizedComponents,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error, 'Failed to send template message');
  }
}
