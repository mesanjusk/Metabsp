import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import { requireLeadFinderAgent } from '@/lib/leadFinder/agentAuth';
import { setLeadFinderAgentHeartbeat } from '@/lib/leadFinder/agentState';
import LeadSearchJob from '@/lib/models/LeadSearchJob';

export async function POST(req: NextRequest) {
  try {
    await requireLeadFinderAgent(req);
    const mode = String(process.env.LEAD_FINDER_MODE || 'local_agent').trim().toLowerCase();
    if (mode !== 'local_agent') throw new AppError('Lead Finder local agent mode is disabled', 409);
    await connectDB();
    const body = await req.json().catch(() => ({}));
    await setLeadFinderAgentHeartbeat(
      String(body?.hostname || '').slice(0, 200),
      String(body?.version || '').slice(0, 50)
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
