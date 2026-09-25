import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import ProspectLead from '@/lib/models/ProspectLead';
import Contact from '@/lib/models/Contact';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const jobId = String(req.nextUrl.searchParams.get('jobId') || '').trim();
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

    const leads: any[] = await ProspectLead.find({ _id: { $in: leadIds }, userId: authed.id });
    let converted = 0;
    let skipped = 0;

    for (const lead of leads) {
      const phone = String(lead.phone || '').replace(/\D/g, '');
      if (!phone) {
        skipped += 1;
        continue;
      }

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

      lead.status = 'converted';
      lead.contactId = contact._id;
      await lead.save();
      converted += 1;
    }

    return NextResponse.json({ success: true, data: { converted, skipped } });
  } catch (error) {
    return errorResponse(error, 'Failed to add leads to contacts');
  }
}
