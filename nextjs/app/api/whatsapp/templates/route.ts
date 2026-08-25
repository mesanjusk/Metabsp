import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import { listTemplates, createTemplate } from '@/lib/whatsapp/templates';
import { recordAuditEvent } from '@/lib/services/auditLogService';

// Ported from backend/src/controllers/whatsappController.js's getTemplates /
// createTemplate. The account is resolved from the authenticated user, never
// from a client-supplied id, so a caller can only ever read or create
// templates on the WABA they actually connected.

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const accountContext = await resolveCurrentWhatsAppAccountForUser(authed.id);
    const templates = await listTemplates(accountContext);
    return NextResponse.json({ success: true, templates });
  } catch (error) {
    return errorResponse(error, 'Failed to load WhatsApp templates');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const accountContext = await resolveCurrentWhatsAppAccountForUser(authed.id);

    const { data, name, category } = await createTemplate(accountContext, body);

    recordAuditEvent({
      req: req as any,
      userId: authed.id,
      action: 'whatsapp_template.create',
      resource: 'whatsapp_template',
      metadata: { name, category },
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to create WhatsApp template');
  }
}
