import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { errorResponse } from '@/lib/http/errorResponse';
import { requireLeadFinderAgent } from '@/lib/leadFinder/agentAuth';
import LeadFinderAgent from '@/lib/models/LeadFinderAgent';
import LeadSearchJob from '@/lib/models/LeadSearchJob';

export async function POST(req: NextRequest) {
  try {
    requireLeadFinderAgent(req);
    await connectDB();
    const body = await req.json().catch(() => ({}));
    await LeadFinderAgent.findOneAndUpdate(
      { agentId: 'default' },
      { $set: { hostname: String(body?.hostname || '').slice(0, 200), version: String(body?.version || '').slice(0, 50), lastSeenAt: new Date() } },
      { upsert: true, setDefaultsOnInsert: true }
    );

    const staleBefore = new Date(Date.now() - 20 * 60 * 1000);
    await LeadSearchJob.updateMany(
      { status: 'running', startedAt: { $lt: staleBefore } },
      { $set: { status: 'queued', startedAt: null, error: 'Previous local agent run stopped before completion; queued again.' } }
    );

    const job: any = await LeadSearchJob.findOneAndUpdate(
      { status: 'queued' },
      { $set: { status: 'running', startedAt: new Date(), completedAt: null, error: '' } },
      { sort: { createdAt: 1 }, new: true }
    ).lean();

    if (!job) return NextResponse.json({ success: true, data: null });
    return NextResponse.json({ success: true, data: {
      id: String(job._id),
      query: job.query,
      location: job.location,
      depth: job.depth,
      emailEnabled: job.emailEnabled,
      requestedLimit: job.requestedLimit,
    } });
  } catch (error) {
    return errorResponse(error, 'Failed to claim lead search');
  }
}
