import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import { requireLeadFinderAgent } from '@/lib/leadFinder/agentAuth';
import { failLeadFinderSearch, processLeadFinderCsv } from '@/lib/leadFinder/scraperClient';
import LeadSearchJob from '@/lib/models/LeadSearchJob';

export async function POST(req: NextRequest) {
  try {
    requireLeadFinderAgent(req);
    const mode = String(process.env.LEAD_FINDER_MODE || 'local_agent').trim().toLowerCase();
    if (mode !== 'local_agent') throw new AppError('Lead Finder local agent mode is disabled', 409);
    await connectDB();
    const body = await req.json();
    const jobId = String(body?.jobId || '').trim();
    if (!jobId) throw new AppError('jobId is required', 400);
    const job: any = await LeadSearchJob.findById(jobId);
    if (!job) throw new AppError('Lead search job not found', 404);

    if (body?.success === false) {
      await failLeadFinderSearch(jobId, String(body?.error || 'Local scraper failed'));
      return NextResponse.json({ success: true, data: { status: 'failed' } });
    }

    const csv = String(body?.csv || '');
    if (!csv.trim()) throw new AppError('CSV results are required', 400);
    if (Buffer.byteLength(csv, 'utf8') > 5 * 1024 * 1024) throw new AppError('Lead result payload is too large', 413);
    const result = await processLeadFinderCsv(jobId, csv);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(error, 'Failed to complete lead search');
  }
}
