import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import Campaign from '@/lib/models/Campaign';

const ownershipFilter = (authed: any, id: string) => ({
  _id: id,
  ...(authed.isAdmin ? {} : { userId: authed.id }),
});

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;

    const campaign = await Campaign.findOne(ownershipFilter(authed, id)).lean();
    if (!campaign) throw new AppError('Not found', 404);
    return NextResponse.json(campaign);
  } catch (error) {
    return errorResponse(error, 'Failed to load campaign');
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // Same allow-list as create: status and the sent/failed counters belong to
    // the send pipeline, not to the client.
    const payload = Object.fromEntries(
      CAMPAIGN_CLIENT_FIELDS.filter((k) => k in body).map((k) => [k, body[k]])
    );

    const campaign = await Campaign.findOneAndUpdate(ownershipFilter(authed, id), payload, { new: true });
    if (!campaign) throw new AppError('Not found', 404);
    return NextResponse.json(campaign);
  } catch (error) {
    return errorResponse(error, 'Failed to update campaign');
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { id } = await params;

    const deleted = await Campaign.findOneAndDelete(ownershipFilter(authed, id));
    // The Express version answered 200 regardless, so deleting someone else's
    // id (or a non-existent one) looked like success.
    if (!deleted) throw new AppError('Not found', 404);
    return NextResponse.json({ message: 'Deleted' });
  } catch (error) {
    return errorResponse(error, 'Failed to delete campaign');
  }
}
