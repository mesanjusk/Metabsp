import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import ProspectLead from '@/lib/models/ProspectLead';
import Contact from '@/lib/models/Contact';

export async function GET(req: NextRequest) {
  try { await connectDB(); const a = await requireAuth(req); const jobId = String(req.nextUrl.searchParams.get('jobId') || '').trim(); const q: any = { userId: a.id }; if (jobId) q.searchJobId = jobId; const leads = await ProspectLead.find(q).sort({ createdAt: -1 }).limit(500).lean(); return NextResponse.json({ success: true, data: leads }); }
  catch (e) { return errorResponse(e, 'Failed to load leads'); }
}
export async function POST(req: NextRequest) {
  try {
    await connectDB(); const a = await requireAuth(req); const body = await req.json(); const ids = Array.isArray(body?.leadIds) ? body.leadIds.map(String).slice(0,100) : [];
    if (!ids.length) throw new AppError('Select at least one lead', 400);
    const leads: any[] = await ProspectLead.find({ _id: { $in: ids }, userId: a.id }); let converted = 0, skipped = 0;
    for (const lead of leads) {
      const phone = String(lead.phone || '').replace(/\D/g, ''); if (!phone) { skipped += 1; continue; }
      const contact: any = await Contact.findOneAndUpdate({ userId: a.id, phone }, { $set: { name: lead.name, email: lead.email || '', company: lead.name, category: lead.category || 'lead', customFields: { source:'google_maps', website:lead.website || '', address:lead.address || '', rating:lead.rating, reviewCount:lead.reviewCount, prospectLeadId:String(lead._id) } }, $addToSet: { tags: { $each: ['lead-finder','google-maps'] } } }, { upsert:true, new:true, setDefaultsOnInsert:true });
      lead.status='converted'; lead.contactId=contact._id; await lead.save(); converted += 1;
    }
    return NextResponse.json({ success:true, data:{ converted, skipped } });
  } catch (e) { return errorResponse(e, 'Failed to add leads to contacts'); }
}
