import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import ProspectLead from '@/lib/models/ProspectLead';
const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
export async function GET(req: NextRequest) {
  try {
    await connectDB(); const a = await requireAuth(req); const jobId = String(req.nextUrl.searchParams.get('jobId') || '').trim(); const q: any = { userId:a.id }; if (jobId) q.searchJobId=jobId;
    const leads: any[] = await ProspectLead.find(q).sort({ createdAt:-1 }).limit(500).lean(); const fields = ['name','phone','email','website','category','address','rating','reviewCount','instagram','facebook','linkedin','status'];
    const csv = [fields.join(','), ...leads.map((lead) => fields.map((field) => esc(lead[field])).join(','))].join('\n');
    return new Response(csv, { headers: { 'Content-Type':'text/csv; charset=utf-8', 'Content-Disposition':'attachment; filename="metabsp-leads.csv"' } });
  } catch (e) { return errorResponse(e, 'Failed to export leads'); }
}
