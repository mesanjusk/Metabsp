import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import ProspectLead from '@/lib/models/ProspectLead';
import Contact from '@/lib/models/Contact';
import {
  getLocalProspectLeads,
  listLocalLeadSearchJobs,
  saveLocalProspectLeads,
  type LocalProspectLead,
} from '@/lib/leadFinder/localStore';

function mode() {
  const configured = String(process.env.LEAD_FINDER_MODE || '').trim().toLowerCase();
  if (configured) return configured;
  return String(process.env.LEAD_SCRAPER_URL || '').trim() ? 'remote' : 'local_agent';
}

async function loadLocalLeadsForUser(userId: string, jobId?: string) {
  if (jobId) {
    const jobs = await listLocalLeadSearchJobs(userId, 50);
    if (!jobs.some((job) => job._id === jobId)) return [] as LocalProspectLead[];
    return getLocalProspectLeads(jobId);
  }
  const jobs = await listLocalLeadSearchJobs(userId, 20);
  const merged: LocalProspectLead[] = [];
  for (const job of jobs) merged.push(...await getLocalProspectLeads(job._id));
  return merged.slice(0, 500);
}

async function upsertContactFromLead(authed: any, lead: any) {
  const phone = String(lead.phone || '').replace(/\D/g, '');
  if (!phone) return { converted: false, skipped: true };

  let contact: any = await Contact.findOne({ userId: authed.id, phone });
  if (!contact) {
    contact = new Contact({
      userId: authed.id,
      phone,
      name: lead.name,
      email: lead.email || '',
      company: lead.name,
      category: lead.category || 'lead',
      tags: ['lead-finder', 'google-maps'],
      customFields: {},
    });
  } else {
    if (!contact.name && lead.name) contact.name = lead.name;
    if (!contact.email && lead.email) contact.email = lead.email;
    if (!contact.company && lead.name) contact.company = lead.name;
    if (!contact.category && lead.category) contact.category = lead.category;
    contact.tags = [...new Set([...(contact.tags || []), 'lead-finder', 'google-maps'])];
  }

  const existingCustom = contact.customFields && typeof contact.customFields === 'object' && !Array.isArray(contact.customFields)
    ? contact.customFields
    : {};
  contact.customFields = {
    ...existingCustom,
    leadFinder: {
      source: 'google_maps',
      website: lead.website || '',
      address: lead.address || '',
      rating: lead.rating,
      reviewCount: lead.reviewCount,
      prospectLeadId: String(lead._id),
    },
  };
  await contact.save();
  return { converted: true, skipped: false, contact };
}

export async function GET(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    const jobId = String(req.nextUrl.searchParams.get('jobId') || '').trim();

    if (mode() === 'local_agent') {
      const leads = await loadLocalLeadsForUser(String(authed.id), jobId || undefined);
      return NextResponse.json({ success: true, data: leads });
    }

    await connectDB();
    const query: any = { userId: authed.id };
    if (jobId) query.searchJobId = jobId;
    const leads = await ProspectLead.find(query).sort({ createdAt: -1 }).limit(500).lean();
    return NextResponse.json({ success: true, data: leads });
  } catch (error) {
    return errorResponse(error, 'Failed to load leads');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const body = await req.json();
    const leadIds = Array.isArray(body?.leadIds) ? body.leadIds.map(String).slice(0, 100) : [];
    if (!leadIds.length) throw new AppError('Select at least one lead', 400);

    if (mode() === 'local_agent') {
      const jobs = await listLocalLeadSearchJobs(String(authed.id), 20);
      let converted = 0;
      let skipped = 0;
      const pending = new Set(leadIds);

      for (const job of jobs) {
        if (!pending.size) break;
        const leads = await getLocalProspectLeads(job._id);
        let changed = false;
        for (const lead of leads) {
          if (!pending.has(lead._id) || lead.status === 'converted') continue;
          pending.delete(lead._id);
          const result = await upsertContactFromLead(authed, lead);
          if (result.skipped) {
            skipped += 1;
            continue;
          }
          lead.status = 'converted';
          lead.contactId = String(result.contact?._id || '');
          lead.updatedAt = new Date().toISOString();
          converted += 1;
          changed = true;
        }
        if (changed) await saveLocalProspectLeads(job._id, leads);
      }

      skipped += pending.size;
      return NextResponse.json({ success: true, data: { converted, skipped } });
    }

    const leads: any[] = await ProspectLead.find({ _id: { $in: leadIds }, userId: authed.id });
    let converted = 0;
    let skipped = 0;

    for (const lead of leads) {
      const result = await upsertContactFromLead(authed, lead);
      if (result.skipped) {
        skipped += 1;
        continue;
      }
      lead.status = 'converted';
      lead.contactId = result.contact._id;
      await lead.save();
      converted += 1;
    }

    return NextResponse.json({ success: true, data: { converted, skipped } });
  } catch (error) {
    return errorResponse(error, 'Failed to add leads to contacts');
  }
}
