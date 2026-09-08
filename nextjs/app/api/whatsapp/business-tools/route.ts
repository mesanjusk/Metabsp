import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { resolveCurrentWhatsAppAccountForUser } from '@/lib/whatsapp/currentAccount';
import { recordAuditEvent } from '@/lib/services/auditLogService';
import {
  businessToolCapabilities,
  createFlow,
  createQrCode,
  deleteQrCode,
  flowAction,
  getBusinessProfile,
  getCommerceSettings,
  listFlows,
  listQrCodes,
  updateBusinessProfile,
  updateCommerceSettings,
} from '@/lib/whatsapp/businessTools';

async function section<T>(load: () => Promise<T>) {
  try {
    return { data: await load(), error: null };
  } catch (error: any) {
    return { data: null, error: String(error?.message || 'Unavailable') };
  }
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const account: any = await resolveCurrentWhatsAppAccountForUser(authed.id);

    const [profile, commerce, qrCodes, flows] = await Promise.all([
      section(() => getBusinessProfile(account)),
      section(() => getCommerceSettings(account)),
      section(() => listQrCodes(account)),
      section(() => listFlows(account)),
    ]);

    return NextResponse.json({
      success: true,
      account: {
        phoneNumberId: account.phoneNumberId,
        displayPhoneNumber: account.displayPhoneNumber,
        verifiedName: account.verifiedName,
        wabaId: account.wabaId,
      },
      capabilities: businessToolCapabilities,
      profile,
      commerce,
      qrCodes,
      flows,
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load WhatsApp business tools');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body: any = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim();
    const account: any = await resolveCurrentWhatsAppAccountForUser(authed.id);

    let data: any;
    let auditAction = `whatsapp_business_tools.${action || 'unknown'}`;

    switch (action) {
      case 'update_profile':
        data = await updateBusinessProfile(account, body.profile || {});
        break;
      case 'update_commerce':
        data = await updateCommerceSettings(account, body);
        break;
      case 'create_qr':
        data = await createQrCode(account, body.prefilledMessage);
        break;
      case 'delete_qr':
        data = await deleteQrCode(account, body.code);
        break;
      case 'create_flow':
        data = await createFlow(account, body);
        break;
      case 'publish_flow':
        data = await flowAction(account, body.flowId, 'publish');
        break;
      case 'deprecate_flow':
        data = await flowAction(account, body.flowId, 'deprecate');
        break;
      case 'delete_flow':
        data = await flowAction(account, body.flowId, 'delete');
        break;
      default:
        return NextResponse.json({ success: false, message: 'Unknown business-tools action' }, { status: 400 });
    }

    recordAuditEvent({
      req: req as any,
      userId: authed.id,
      action: auditAction,
      resource: 'whatsapp_business_tools',
      metadata: {
        phoneNumberId: account.phoneNumberId,
        flowId: body.flowId || undefined,
        qrCode: body.code || undefined,
      },
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error, 'Failed to update WhatsApp business tools');
  }
}
