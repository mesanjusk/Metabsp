import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import LeadSearchJob from '@/lib/models/LeadSearchJob';
import { enqueueLeadSearch } from '@/lib/queues/leadFinderQueue';

export async function GET(req: NextRequest) {
  try { await connectDB(); const a = await requireAuth(req); const jobs = await LeadSearchJob.find({ userId: a.id }).sort({ createdAt: -1 }).limit(20).lean(); return NextResponse.json({ success: true, data: jobs }); }
  catch (e) { return errorResponse(e, 'Failed to load lead searches'); }
}
export async function POST(req: NextRequest) {
  try {
    await connectDB(); const a = await requireAuth(req); const b = await req.json();
    const businessType = String(b?.businessType || '').trim(), location = String(b?.location || '').trim();
    if (!businessType || !location) throw new AppError('Business type and location are required', 400);
    if (await LeadSearchJob.countDocuments({ userId: a.id, status: { $in: ['queued','running'] } })) throw new AppError('One lead search is already running.', 429);
    const day = new Date(); day.setHours(0,0,0,0); if (!a.isAdmin && await LeadSearchJob.countDocuments({ userId: a.id, createdAt: { $gte: day } }) >= 5) throw new AppError('Daily lead-search limit reached (5).', 429);
    const requestedLimit = Math.min(Math.max(Number(b?.limit || 50), 1), 100);
    const job: any = await LeadSearchJob.create({ userId: a.id, tenantId: a.tenantId || null, businessType, location, query: `${businessType} in ${location}`, requestedLimit, depth: Math.min(10, Math.max(3, Math.ceil(requestedLimit / 20))), emailEnabled: b?.emailEnabled !== false, socialEnabled: Boolean(b?.socialEnabled), status: 'queued' });
    try { await enqueueLeadSearch(String(job._id)); } catch (e) { job.status='failed'; job.error='Could not queue search'; await job.save(); throw e; }
    return NextResponse.json({ success: true, data: job }, { status: 202 });
  } catch (e) { return errorResponse(e, 'Failed to start lead search'); }
}
