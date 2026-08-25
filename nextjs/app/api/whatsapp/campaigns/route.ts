import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import Campaign from '@/lib/models/Campaign';

// Campaign records. Sending is NOT here — see [id]/send, which explains why.
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const filter = authed.isAdmin ? {} : { userId: authed.id };
    const campaigns = await Campaign.find(filter).sort({ createdAt: -1 }).lean();
    return NextResponse.json(campaigns);
  } catch (error) {
    return errorResponse(error, 'Failed to load campaigns');
  }
}

// Allow-listed rather than spreading the body: Campaign carries sentCount,
// failedCount and status, which are set by the send pipeline and must not be
// writable by the client.
const CAMPAIGN_CLIENT_FIELDS = [
  'title',
  'imageUrl',
  'message',
  'fontStyle',
  'includeRsvp',
  'rsvpYesLabel',
  'rsvpNoLabel',
  'recipients',
  'scheduledAt',
  'type',
];

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const payload = Object.fromEntries(
      CAMPAIGN_CLIENT_FIELDS.filter((k) => k in body).map((k) => [k, body[k]])
    );

    const campaign = await Campaign.create({ ...payload, userId: authed.id });
    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to create campaign');
  }
}
