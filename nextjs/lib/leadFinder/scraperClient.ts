import LeadSearchJob from '@/lib/models/LeadSearchJob';
import ProspectLead from '@/lib/models/ProspectLead';

function baseUrl() {
  const raw = String(process.env.LEAD_SCRAPER_URL || '').trim();
  if (!raw) throw new Error('LEAD_SCRAPER_URL is not configured');
  const clean = raw.replace(/\/$/, '');
  return /^https?:\/\//i.test(clean) ? clean : `http://${clean}`;
}

async function scraperRequest(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${baseUrl()}${path}`, { ...init, signal: controller.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`Scraper ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res;
  } finally { clearTimeout(timer); }
}

async function geocode(place: string) {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(place)}`, {
    headers: { 'User-Agent': 'MetaBSP-LeadFinder/1.0' }, cache: 'no-store'
  });
  if (!res.ok) throw new Error(`Could not geocode ${place}`);
  const rows: any[] = await res.json();
  if (!rows[0]?.lat || !rows[0]?.lon) throw new Error(`Could not find coordinates for ${place}`);
  return { lat: String(rows[0].lat), lon: String(rows[0].lon) };
}

function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let value = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { value += '"'; i += 1; }
      else if (ch === '"') quoted = false; else value += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(value); value = ''; }
    else if (ch === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; }
    else value += ch;
  }
  if (value || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row); }
  const headers = rows.shift() || [];
  return rows.filter((r) => r.some(Boolean)).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] || ''])));
}

function firstEmail(value: unknown) {
  return String(value || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
}

async function findSocials(website: string) {
  const blank = { instagram: '', facebook: '', linkedin: '' };
  if (!website) return blank;
  try {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(/^https?:\/\//i.test(website) ? website : `https://${website}`, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 MetaBSP Lead Finder' } });
    clearTimeout(timer); if (!res.ok) return blank;
    const html = (await res.text()).slice(0, 400000);
    return {
      instagram: html.match(/https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.-]+/i)?.[0] || '',
      facebook: html.match(/https?:\/\/(?:www\.|m\.)?facebook\.com\/[A-Za-z0-9_.-]+/i)?.[0] || '',
      linkedin: html.match(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in|school)\/[A-Za-z0-9_.%\/-]+/i)?.[0] || '',
    };
  } catch { return blank; }
}

export async function runLeadFinderSearch(searchJobId: string) {
  const search: any = await LeadSearchJob.findById(searchJobId);
  if (!search) throw new Error('Lead search job not found');
  try {
    search.status = 'running'; search.startedAt = new Date(); search.error = ''; await search.save();
    let lat = search.latitude, lon = search.longitude;
    if (!lat || !lon) { const c = await geocode(search.location); lat = c.lat; lon = c.lon; search.latitude = lat; search.longitude = lon; await search.save(); }
    const create = await scraperRequest('/api/v1/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      name: `metabsp-${search._id}`, keywords: [search.query], lang: 'en', zoom: 15, lat, lon, fast_mode: false, radius: 10000,
      depth: search.depth, email: search.emailEnabled, max_time: 600
    }) });
    const created: any = await create.json(); if (!created?.id) throw new Error('Scraper did not return a job id');
    search.scraperJobId = created.id; await search.save();
    let status = '';
    for (let i = 0; i < 90; i += 1) {
      const poll: any = await (await scraperRequest(`/api/v1/jobs/${created.id}`)).json();
      status = String(poll?.Status || poll?.status || '').toLowerCase();
      if (status === 'ok') break; if (status === 'failed') throw new Error('Google Maps scraper job failed');
      await new Promise((resolve) => setTimeout(resolve, 8000));
    }
    if (status !== 'ok') throw new Error('Google Maps scraper timed out');
    const rows = parseCsv(await (await scraperRequest(`/api/v1/jobs/${created.id}/download`)).text()).slice(0, search.requestedLimit || 50);
    for (const raw of rows) {
      const name = String(raw.title || raw.name || '').trim(); if (!name) continue;
      const phone = String(raw.phone || '').replace(/[^+\d]/g, ''); const website = String(raw.website || '').trim();
      const placeId = String(raw.place_id || raw.data_id || raw.cid || '').trim();
      const sourceKey = placeId || phone || website.toLowerCase() || `${name.toLowerCase()}|${String(raw.address || '').toLowerCase()}`;
      const socials = search.socialEnabled ? await findSocials(website) : { instagram: '', facebook: '', linkedin: '' };
      await ProspectLead.findOneAndUpdate({ userId: search.userId, sourceKey }, { $set: {
        tenantId: search.tenantId || null, searchJobId: search._id, googlePlaceId: placeId, name, phone, email: firstEmail(raw.emails || raw.email),
        website, address: String(raw.address || ''), category: String(raw.category || ''), rating: Number(raw.review_rating || raw.rating) || null,
        reviewCount: Number(raw.review_count || 0) || 0, latitude: Number(raw.latitude || raw.lat) || null, longitude: Number(raw.longitude || raw.lon || raw.lng) || null,
        ...socials, source: 'google_maps'
      }, $setOnInsert: { status: 'new' } }, { upsert: true, setDefaultsOnInsert: true });
    }
    search.status = 'completed'; search.totalFound = rows.length; search.completedAt = new Date(); await search.save();
    return { totalFound: rows.length };
  } catch (error: any) {
    search.status = 'failed'; search.error = String(error?.message || error).slice(0, 1000); search.completedAt = new Date(); await search.save(); throw error;
  }
}
