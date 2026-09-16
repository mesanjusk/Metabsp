import { NextRequest, NextResponse } from 'next/server';
import { sendFromBusy } from '@/lib/integrations/busy';
import { externalApiError } from '@/lib/http/externalApi';

export const dynamic = 'force-dynamic';

function privateResponse(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Referrer-Policy', 'no-referrer');
  if (response.status === 429) response.headers.set('Retry-After', '60');
  return response;
}

// BUSY's legacy URL screen cannot attach a header or JSON body. This is the
// only query-token send endpoint; normal mbsp_ keys are never accepted here.
export async function GET(req: NextRequest) {
  try { return privateResponse(NextResponse.json(await sendFromBusy(req))); }
  catch (error) { return privateResponse(externalApiError(error, 'busy-send')); }
}

// Next otherwise implements HEAD by executing GET, which would send a message.
export async function HEAD() {
  return privateResponse(new NextResponse(null, { status: 405, headers: { Allow: 'GET' } }));
}
