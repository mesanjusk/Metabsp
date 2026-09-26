import crypto from 'node:crypto';
import {
  completeLocalLeadSearch,
  failLocalLeadSearch,
  getLocalLeadSearchJob,
  type LocalProspectLead,
} from '@/lib/leadFinder/localStore';

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { value += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else value += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(value); value = ''; }
    else if (ch === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; }
    else value += ch;
  }
  if (value || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row); }
  const headers = rows.shift() || [];
  return rows
    .filter((r) => r.some(Boolean))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] || ''])));
}

function firstEmail(value: unknown) {
  return String(value || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
}

async function findSocials(website: string) {
  const blank = { instagram: '', facebook: '', linkedin: '' };
  if (!website) return blank;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(/^https?:\/\//i.test(website) ? website : `https://${website}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 MetaBSP Lead Finder' },
    });
    if (!res.ok) return blank;
    const html = (await res.text()).slice(0, 400000);
    return {
      instagram: html.match(/https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.-]+/i)?.[0] || '',
      facebook: html.match(/https?:\/\/(?:www\.|m\.)?facebook\.com\/[A-Za-z0-9_.-]+/i)?.[0] || '',
      linkedin: html.match(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in|school)\/[A-Za-z0-9_.%\/-]+/i)?.[0] || '',
    };
  } catch {
    return blank;
  } finally {
    clearTimeout(timer);
  }
}

export async function processLocalLeadFinderCsv(searchJobId: string, csvText: string) {
  const search = await getLocalLeadSearchJob(searchJobId);
  if (!search) throw new Error('Lead search job not found');

  const rows = parseCsv(csvText).slice(0, search.requestedLimit || 50);
  const now = new Date().toISOString();
  const seen = new Set<string>();
  const leads: LocalProspectLead[] = [];

  for (const raw of rows) {
    const name = String(raw.title || raw.name || '').trim();
    if (!name) continue;
    const phone = String(raw.phone || '').replace(/[^+\d]/g, '');
    const website = String(raw.website || '').trim();
    const placeId = String(raw.place_id || raw.data_id || raw.cid || '').trim();
    const sourceKey = placeId || phone || website.toLowerCase() || `${name.toLowerCase()}|${String(raw.address || '').toLowerCase()}`;
    if (seen.has(sourceKey)) continue;
    seen.add(sourceKey);
    const socials = search.socialEnabled ? await findSocials(website) : { instagram: '', facebook: '', linkedin: '' };
    leads.push({
      _id: crypto.randomBytes(12).toString('hex'),
      userId: search.userId,
      tenantId: search.tenantId,
      searchJobId: search._id,
      sourceKey,
      googlePlaceId: placeId,
      name,
      phone,
      email: firstEmail(raw.emails || raw.email),
      website,
      address: String(raw.address || ''),
      category: String(raw.category || ''),
      rating: Number(raw.review_rating || raw.rating) || null,
      reviewCount: Number(raw.review_count || 0) || 0,
      latitude: Number(raw.latitude || raw.lat) || null,
      longitude: Number(raw.longitude || raw.lon || raw.lng) || null,
      ...socials,
      source: 'google_maps',
      status: 'new',
      createdAt: now,
      updatedAt: now,
    });
  }

  await completeLocalLeadSearch(searchJobId, leads);
  return { totalFound: leads.length };
}

export async function failLocalLeadFinderCsvSearch(searchJobId: string, error: unknown) {
  await failLocalLeadSearch(searchJobId, error);
}
