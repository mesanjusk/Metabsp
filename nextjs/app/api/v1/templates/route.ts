import { NextResponse } from 'next/server';
import { withApiKeyAccount, externalApiError } from '@/lib/http/externalApi';
import { listTemplates } from '@/lib/whatsapp/templates';

/**
 * GET /api/v1/templates — the approved templates this key may send.
 *
 * Without it an integrator has to leave the API and read template names out of
 * the dashboard by hand, which is exactly the kind of gap that makes an API
 * feel unfinished. Read-only on purpose: creating a template is a reviewed,
 * consequential action that belongs behind a signed-in session, not an
 * automation key.
 */
export const GET = withApiKeyAccount('templates', async ({ accountContext }) => {
  try {
    const templates = await listTemplates(accountContext);
    return NextResponse.json({ success: true, data: templates });
  } catch (error) {
    return externalApiError(error, 'templates');
  }
});
