import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import LeadSearchJob from '@/lib/models/LeadSearchJob';
import { enqueueLeadSearch } from '@/lib/queues/leadFinderQueue';
import { getRemoteLeadScraperStatus } from '@/lib/leadFinder/scraperClient';
import { getLeadFinderAgentAuthHash } from '@/lib/leadFinder/agentState';
import {
  countLocalLeadSearchesToday,
  createLocalLeadSearchJob,
  hasActiveLocalLeadSearch,
  listLocalLeadSearchJobs,
} from '@/lib/leadFinder/localStore';

function leadFinderMode() {
  const configured = String(process.env.LEAD_FINDER_MODE || '').trim().toLowerCase();
  if (configured) return configured;
  return String(process.env.LEAD_SCRAPER_URL || '').trim() ? 'remote' : 'local_agent';
}

async function localAgentConfigured() {
  if (String(process.env.LEAD_FINDER_AGENT_TOKEN || '').trim()) return true;
  return Boolean(await getLeadFinderAgentAuthHash());
}

export async function GET(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    const mode = leadFinderMode();
    if (mode === 'local_agent') {
      const jobs = await listLocalLeadSearchJobs(String(authed.id), 20);
      return NextResponse.json({ success: true, data: jobs, scraperConfigured: await localAgentConfigured(), mode });
    }

    await connectDB();
    const jobs = await LeadSearchJob.find({ userId: authed.id }).sort({ createdAt: -1 }).limit(20).lean();
    return NextResponse.json({
      success: true,
      data: jobs,
      scraperConfigured: Boolean(String(process.env.LEAD_SCRAPER_URL || '').trim()),
      mode,
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load lead searches');
  }
}

export async function POST(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    const mode = leadFinderMode();
    if (mode === 'local_agent') {
      if (!(await localAgentConfigured())) throw new AppError('Local Lead Finder agent is not configured yet', 503);
    } else {
      const status = await getRemoteLeadScraperStatus();
      if (!status.configured) throw new AppError('Lead scraper service is not configured yet', 503);
      if (!status.online) throw new AppError('Lead scraper is offline or unreachable', 503);
    }

    const body = await req.json();
    const businessType = String(body?.businessType || '').trim();
    const location = String(body?.location || '').trim();
    if (!businessType || !location) throw new AppError('Business type and location are required', 400);

    const requestedLimit = Math.min(Math.max(Number(body?.limit || 50), 1), 100);

    if (mode === 'local_agent') {
      const userId = String(authed.id);
      if (await hasActiveLocalLeadSearch(userId)) {
        throw new AppError('One lead search is already running. Wait for it to finish.', 429);
      }
      if (!authed.isAdmin && (await countLocalLeadSearchesToday(userId)) >= 5) {
        throw new AppError('Daily lead-search limit reached (5).', 429);
      }
      const job = await createLocalLeadSearchJob({
        userId,
        tenantId: authed.tenantId ? String(authed.tenantId) : null,
        businessType,
        location,
        query: `${businessType} in ${location}`,
        requestedLimit,
        depth: Math.min(10, Math.max(3, Math.ceil(requestedLimit / 20))),
        emailEnabled: body?.emailEnabled !== false,
        socialEnabled: Boolean(body?.socialEnabled),
      });
      return NextResponse.json({ success: true, data: job, mode }, { status: 202 });
    }

    await connectDB();
    const active = await LeadSearchJob.countDocuments({ userId: authed.id, status: { $in: ['queued', 'running'] } });
    if (active >= 1) throw new AppError('One lead search is already running. Wait for it to finish.', 429);

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const today = await LeadSearchJob.countDocuments({ userId: authed.id, createdAt: { $gte: dayStart } });
    if (!authed.isAdmin && today >= 5) throw new AppError('Daily lead-search limit reached (5).', 429);

    const job: any = await LeadSearchJob.create({
      userId: authed.id,
      tenantId: authed.tenantId || null,
      businessType,
      location,
      query: `${businessType} in ${location}`,
      requestedLimit,
      depth: Math.min(10, Math.max(3, Math.ceil(requestedLimit / 20))),
      emailEnabled: body?.emailEnabled !== false,
      socialEnabled: Boolean(body?.socialEnabled),
      status: 'queued',
    });

    try {
      await enqueueLeadSearch(String(job._id));
    } catch (error) {
      job.status = 'failed';
      job.error = 'Could not queue search';
      await job.save();
      throw error;
    }
    return NextResponse.json({ success: true, data: job, mode }, { status: 202 });
  } catch (error) {
    return errorResponse(error, 'Failed to start lead search');
  }
}
