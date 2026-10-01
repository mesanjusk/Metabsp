import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import RcsAgent from '@/lib/models/RcsAgent';
import RcsMessage from '@/lib/models/RcsMessage';
import RcsConsent from '@/lib/models/RcsConsent';

function verifyPayload(encoded: string, signature: string, token: string) {
  const decoded = Buffer.from(encoded, 'base64');
  const expected = crypto.createHmac('sha512', token).update(decoded).digest();
  const supplied = Buffer.from(signature || '', 'base64');

  if (!supplied.length || supplied.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(supplied, expected)) return null;
  return decoded;
}

export async function POST(req: NextRequest) {
  const clientToken = String(process.env.RCS_WEBHOOK_CLIENT_TOKEN || '').trim();
  if (!clientToken) {
    return NextResponse.json({ success: false, message: 'RCS webhook token is not configured' }, { status: 503 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch (_error) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const encoded = String(body?.message?.data || '');
  const signature = String(req.headers.get('x-goog-signature') || '');
  const decoded = encoded ? verifyPayload(encoded, signature, clientToken) : null;
  if (!decoded) return NextResponse.json({ success: false }, { status: 401 });

  let event: any;
  try {
    event = JSON.parse(decoded.toString('utf8'));
  } catch (_error) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  await connectDB();

  const agentId = String(event?.agentId || '');
  if (!agentId) return NextResponse.json({ success: true });

  const agent: any = await RcsAgent.findOne({ agentId, isActive: true }).lean();
  if (!agent) return NextResponse.json({ success: true });

  const phone = String(event?.senderPhoneNumber || event?.phoneNumber || '');
  const eventType = String(event?.eventType || '');
  const eventId = String(event?.eventId || '');
  const messageId = String(event?.messageId || '');
  const sendTime = event?.sendTime ? new Date(event.sendTime) : new Date();

  if (eventId) {
    const duplicate = await RcsMessage.findOne({ eventId }).select('_id').lean();
    if (duplicate) return NextResponse.json({ success: true });
  }

  if (eventType === 'UNSUBSCRIBE' || eventType === 'SUBSCRIBE') {
    await RcsConsent.findOneAndUpdate(
      { userId: agent.userId, agentId, phone },
      {
        $set: {
          tenantId: agent.tenantId || null,
          optedOut: eventType === 'UNSUBSCRIBE',
          source: 'webhook',
          lastEventAt: sendTime,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  if ((eventType === 'DELIVERED' || eventType === 'READ') && messageId) {
    await RcsMessage.updateMany(
      { userId: agent.userId, agentId, messageId, direction: 'outgoing', channel: 'rcs' },
      { $set: { status: eventType.toLowerCase() } }
    );
  }

  const isIncomingMessage = Boolean(
    event?.text || event?.suggestionResponse || event?.location || event?.userFile
  );

  if (isIncomingMessage && messageId) {
    const duplicateMessage = await RcsMessage.findOne({
      userId: agent.userId,
      agentId,
      messageId,
      direction: 'incoming',
    })
      .select('_id')
      .lean();

    if (!duplicateMessage) {
      await RcsMessage.create({
        userId: agent.userId,
        tenantId: agent.tenantId || null,
        agentId,
        phone,
        direction: 'incoming',
        channel: 'rcs',
        kind: 'message',
        messageId,
        text: String(event?.text || event?.suggestionResponse?.text || ''),
        status: 'received',
        raw: event,
        createdAt: sendTime,
        updatedAt: sendTime,
      });
    }
  } else {
    await RcsMessage.create({
      userId: agent.userId,
      tenantId: agent.tenantId || null,
      agentId,
      phone,
      direction: 'event',
      channel: 'rcs',
      kind: 'event',
      messageId,
      ...(eventId ? { eventId } : {}),
      eventType,
      status: eventType ? eventType.toLowerCase() : 'received',
      raw: event,
      createdAt: sendTime,
      updatedAt: sendTime,
    });
  }

  return NextResponse.json({ success: true });
}
