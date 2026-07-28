import { NextRequest } from 'next/server';
import { handleVerifyWebhook, handleReceiveWebhook } from '@/lib/whatsapp/webhookHandler';

// Mounted at /webhook — the second of the two paths the Express app served
// this same handler from (see app/api/whatsapp/webhook/route.ts). Kept as a
// second route rather than a redirect since Meta's webhook POST must reach
// a real 200 response directly, and some Meta App configs may already be
// pointed at the bare /webhook path.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return handleVerifyWebhook(req);
}

export async function POST(req: NextRequest) {
  return handleReceiveWebhook(req);
}
