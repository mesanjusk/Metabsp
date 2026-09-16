import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { recordAuditEvent } from '@/lib/services/auditLogService';
import { loadWhatsAppAccountForUserById } from '@/lib/services/whatsappAccountService';
import { listTemplates } from '@/lib/whatsapp/templates';
import { BUSY_SOURCES, busyTemplateBindings, type BusyConfig } from '@/lib/integrations/busyConfig';
import ApiKey from '@/lib/models/ApiKey';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';
import AppError from '@/lib/utils/AppError';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const accountId = req.nextUrl.searchParams.get('accountId');
    if (accountId) {
      const context = await loadWhatsAppAccountForUserById(authed.id, accountId);
      return NextResponse.json({ success: true, templates: await listTemplates(context) });
    }
    const [keys, accounts]: any[] = await Promise.all([
      ApiKey.find({ userId: authed.id, scope: 'busy' }).sort({ createdAt: -1 }).lean(),
      WhatsAppAccount.find({ status: { $ne: 'disconnected' }, $or: [{ userId: authed.id }, { teamMemberIds: authed.id }] })
        .select('_id displayPhoneNumber verifiedName phoneNumberId isActive').lean(),
    ]);
    return NextResponse.json({ success: true, accounts, integrations: keys.map((key: any) => ({
      id: key._id, name: key.name, prefix: key.keyPrefix, isActive: key.isActive,
      config: key.busyConfig, createdAt: key.createdAt, lastUsedAt: key.lastUsedAt,
    })) });
  } catch (error) { return errorResponse(error, 'Could not load BUSY integrations.'); }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    if (!['text', 'template'].includes(body.mode)) throw new AppError('Choose text or template mode.', 400);
    const account = await loadWhatsAppAccountForUserById(authed.id, String(body.accountId || ''));
    const config: BusyConfig = {
      accountId: String(account.account._id), phoneNumberId: account.phoneNumberId,
      sender: account.displayPhoneNumber || account.phoneNumberId,
      mode: body.mode, addIndiaCode: body.addIndiaCode === true, bindings: [],
    };
    if (body.mode === 'template') {
      const templates = await listTemplates(account);
      const template = templates.find((t: any) => t.name === body.template && t.language === body.language);
      let bindings;
      try { bindings = busyTemplateBindings(template); }
      catch (error) { throw new AppError((error as Error).message, 400); }
      // Derive the shape from Meta, never trust user-supplied component types.
      for (const binding of bindings) {
        const source = body.sources?.[`${binding.component}:${binding.variable}`];
        if (!BUSY_SOURCES.includes(source)) throw new AppError('Map every template variable to a BUSY field.', 400);
        if (binding.type === 'document' && source !== 'invoice_url')
          throw new AppError('Map the PDF document to Invoice URL.', 400);
        binding.source = source;
      }
      config.template = template.name;
      config.language = template.language;
      config.bindings = bindings;
    }
    const name = String(body.name || 'BUSY Accounting').trim().slice(0, 100) || 'BUSY Accounting';
    const { doc, rawKey } = await (ApiKey as any).generateBusy(authed.id, name, config);
    recordAuditEvent({ req: req as any, userId: authed.id, action: 'busy.create', resource: 'api_key', resourceId: doc._id,
      metadata: { name, accountId: config.accountId, mode: config.mode } });
    return NextResponse.json({ success: true, token: rawKey, id: doc._id, config }, { status: 201 });
  } catch (error) { return errorResponse(error, 'Could not create BUSY integration.'); }
}
