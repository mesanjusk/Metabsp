import { NextRequest, NextResponse } from 'next/server';
import { POST as sendText } from '../send-text/route';
import { POST as sendTemplate } from '../send-template/route';
import { POST as sendMedia } from '../send-media/route';

// Ported from backend/src/controllers/whatsappController.js's sendMessage —
// dispatches by body.type to the same handlers the dedicated endpoints use.
// Reads the body once here (Request bodies can only be consumed once) and
// reconstructs a fresh Request for the delegate handler.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const type = String(body?.type || '').toLowerCase();

  const forward = () =>
    new NextRequest(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(body) });

  if (type === 'text') return sendText(forward());
  if (type === 'template') return sendTemplate(forward());
  if (['image', 'video', 'audio', 'document'].includes(type)) return sendMedia(forward());

  return NextResponse.json({ success: false, message: 'Unsupported type. Use text, template, image, video, audio, document' }, { status: 400 });
}
