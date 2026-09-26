import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import ProspectLead from '@/lib/models/ProspectLead';
import { getLocalProspectLeads, listLocalLeadSearchJobs } from '@/lib/leadFinder/localStore';

const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function mode() {
  const configured = String(process.env.LEAD_FINDER_MODE || '').trim().toLowerCase();
  if (configured) return configured;
  return String(process.env.LEAD_SCRAPER_URL || '').trim() ? 'remote' : 'local_agent';
}

export async function GET(req: NextRequest) {
  try {
    const a = await requireAuth(req);
    const jobId = String(req.nextUrl.searchParams.get('jobId') || '').trim();
    let leads: any[] = [];

    if (mode() === 'local_agent') {
      const jobs = await listLocalLeadSearchJobs(String(a.id), 20);
      if (jobId) {
        if (jobs.some((job) => job._id === jobId)) leads = await getLocalProspectLeads(jobId);
      } else {
        for (const job of jobs) leads.push(...await getLocalProspectLeads(job._id));
        leads = leads.slice(0, 500);
      }
    } else {
      await connectDB();
      const q: any = { userId: a.id };
      if (jobId) q.searchJobId = jobId;
      leads = await ProspectLead.find(q).sort({ createdAt: -1 }).limit(500).lean();
    }

    const fields = ['name','phone','email','website','category','address','rating','reviewCount','instagram','facebook','linkedin','status'];
    const csv = [fields.join(','), ...leads.map((lead) => fields.map((field) => esc(lead[field])).join(','))].join('\n');
    return new Response(csv, { headers: { 'Content-Type':'text/csv; charset=utf-8', 'Content-Disposition':'attachment; filename="metabsp-leads.csv"' } });
  } catch (e) {
    return errorResponse(e, 'Failed to export leads');
  }
}
