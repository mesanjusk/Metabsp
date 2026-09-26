import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import { requireLeadFinderAgent } from '@/lib/leadFinder/agentAuth';
import { setLeadFinderAgentHeartbeat } from '@/lib/leadFinder/agentState';
import { updateLocalLeadSearchProgress } from '@/lib/leadFinder/localStore';

export async function POST(req: NextRequest) {
  try {
    await requireLeadFinderAgent(req);
    const mode = String(process.env.LEAD_FINDER_MODE || 'local_agent').trim().toLowerCase();
    if (mode !== 'local_agent') throw new AppError('Lead Finder local agent mode is disabled', 409);

    const body = await req.json().catch(() => ({}));
    await setLeadFinderAgentHeartbeat(
      String(body?.hostname || '').slice(0, 200),
      String(body?.version || '').slice(0, 50)
    );

    const jobId = String(body?.jobId || '').trim();
    if (!jobId) return NextResponse.json({ success: true, data: null });

    const job = await updateLocalLeadSearchProgress(
      jobId,
      Number(body?.progress || 10),
      String(body?.stage || 'Searching Google Maps')
    );
    if (!job) throw new AppError('Lead search job not found', 404);

    return NextResponse.json({ success: true, data: {
      id: job._id,
      progressPercent: job.progressPercent,
      progressStage: job.progressStage,
    } });
  } catch (error) {
    return errorResponse(error, 'Failed to update lead search progress');
  }
}
