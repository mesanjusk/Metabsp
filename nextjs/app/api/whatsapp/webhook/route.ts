import { NextRequest } from 'next/server';
import { handleVerifyWebhook, handleReceiveWebhook } from '@/lib/whatsapp/webhookHandler';

// Mounted at /api/whatsapp/webhook — mirrors backend/src/routes/webhook.js,
// which the Express app mounts at both '/webhook' and '/api/whatsapp/webhook'
// (see app/webhook/route.ts for the other mount point). Meta's App Dashboard
// webhook URL config should point here once cutover happens (see
// docs/NEXTJS_MIGRATION_AUDIT_AND_PLAN.md — manual steps section).
//
// maxDuration budgets for the now-synchronous processing this handler does
// (media download + Cloudinary re-upload + destination fan-out with
// retries) — see lib/whatsapp/webhookHandler.ts's doc comment. Requires a
// Vercel plan that supports a raised function duration; adjust down if
// deploying on a plan where 60s isn't available.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return handleVerifyWebhook(req);
}

export async function POST(req: NextRequest) {
  return handleReceiveWebhook(req);
}
