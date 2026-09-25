'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, FormControlLabel, Grid, Stack, TextField, Typography } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import {
  fetchLeadSearches,
  fetchLeadFinderStatus,
  fetchProspectLeads,
  startLeadSearch,
  convertProspectLeads,
  leadExportUrl,
} from '@/lib/client/services/leadFinderService';
import { getStoredToken } from '@/lib/api/authStorage';

export default function LeadFinderPage() {
  const [businessType, setBusinessType] = useState('');
  const [location, setLocation] = useState('');
  const [limit, setLimit] = useState(50);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [socialEnabled, setSocialEnabled] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [leads, setLeads] = useState([]);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [scraperStatus, setScraperStatus] = useState({ configured: false, online: false, message: 'Checking office PC…', mode: 'local_agent' });

  const activeJob = jobs.find((j) => ['queued', 'running'].includes(j.status));
  const latestJob = jobs[0];

  const load = async () => {
    const jr = await fetchLeadSearches();
    const js = jr.data?.data || [];
    setJobs(js);
    const lr = await fetchProspectLeads(js[0]?._id);
    setLeads(lr.data?.data || []);
  };

  const loadStatus = async () => {
    try {
      const sr = await fetchLeadFinderStatus();
      setScraperStatus(sr.data?.data || { configured: false, online: false, message: 'Lead Finder status unavailable' });
    } catch {
      setScraperStatus({ configured: false, online: false, message: 'Lead Finder status unavailable', mode: 'local_agent' });
    }
  };

  useEffect(() => { load().catch(() => {}); loadStatus(); }, []);
  useEffect(() => {
    const t = setInterval(loadStatus, 15000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!activeJob) return undefined;
    const t = setInterval(() => load().catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [activeJob?._id, activeJob?.status]);

  const stats = useMemo(() => ({
    total: leads.length,
    phone: leads.filter((x) => x.phone).length,
    email: leads.filter((x) => x.email).length,
    converted: leads.filter((x) => x.status === 'converted').length,
  }), [leads]);

  const run = async () => {
    setBusy(true); setMessage('');
    try {
      await startLeadSearch({ businessType, location, limit, emailEnabled, socialEnabled });
      setMessage(scraperStatus.mode === 'local_agent'
        ? 'Search queued. Your office PC will pick it up automatically.'
        : 'Search queued. Results will appear automatically.');
      await load();
    } catch (e) {
      setMessage(e?.response?.data?.message || e?.response?.data?.error || e.message || 'Search failed');
    } finally { setBusy(false); }
  };

  const convert = async () => {
    if (!selected.length) return;
    setBusy(true);
    try {
      const r = await convertProspectLeads(selected);
      setMessage(`${r.data?.data?.converted || 0} lead(s) added to Contacts.`);
      setSelected([]);
      await load();
    } finally { setBusy(false); }
  };

  const download = async () => {
    const token = getStoredToken();
    const r = await fetch(leadExportUrl(latestJob?._id), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'metabsp-leads.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
    <Stack spacing={.75} sx={{ mb: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
        <Typography variant="h4" fontWeight={800}>Business Lead Finder</Typography>
        <Chip
          size="small"
          color={scraperStatus.online ? 'success' : scraperStatus.configured ? 'warning' : 'default'}
          label={scraperStatus.online ? 'Office PC Online' : scraperStatus.configured ? 'Office PC Offline' : 'Local Agent Not Configured'}
        />
      </Stack>
      <Typography color="text.secondary">Find local businesses from Google Maps, review them, then add selected prospects to Contacts.</Typography>
      <Typography variant="body2" color={scraperStatus.online ? 'success.main' : 'text.secondary'}>{scraperStatus.message}</Typography>
    </Stack>

    <Card sx={{ mb: 3 }}><CardContent><Grid container spacing={2}>
      <Grid item xs={12} md={4}><TextField fullWidth label="Business type" placeholder="e.g. Schools" value={businessType} onChange={(e) => setBusinessType(e.target.value)} /></Grid>
      <Grid item xs={12} md={4}><TextField fullWidth label="Location" placeholder="e.g. Gondia, Maharashtra" value={location} onChange={(e) => setLocation(e.target.value)} /></Grid>
      <Grid item xs={12} md={2}><TextField fullWidth type="number" label="Max results" inputProps={{ min: 1, max: 100 }} value={limit} onChange={(e) => setLimit(Number(e.target.value))} /></Grid>
      <Grid item xs={12} md={2}><Button fullWidth variant="contained" startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <SearchRoundedIcon />} disabled={busy || Boolean(activeJob) || !businessType.trim() || !location.trim() || !scraperStatus.online} onClick={run} sx={{ height: 56 }}>Find leads</Button></Grid>
      <Grid item xs={12}><FormControlLabel control={<Checkbox checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} />} label="Find emails" /><FormControlLabel control={<Checkbox checked={socialEnabled} onChange={(e) => setSocialEnabled(e.target.checked)} />} label="Find social profiles (slower)" /></Grid>
    </Grid>{message ? <Typography sx={{ mt: 1.5 }} color="text.secondary">{message}</Typography> : null}</CardContent></Card>

    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }} alignItems={{ md: 'center' }}>
      <Chip label={`Found ${stats.total}`} /><Chip label={`Phone ${stats.phone}`} /><Chip label={`Email ${stats.email}`} /><Chip label={`Converted ${stats.converted}`} />
      {latestJob ? <Chip label={`Latest: ${latestJob.status}`} color={latestJob.status === 'failed' ? 'error' : latestJob.status === 'completed' ? 'success' : 'warning'} /> : null}
      <Box sx={{ flex: 1 }} />
      <Button startIcon={<PersonAddAltRoundedIcon />} disabled={!selected.length || busy} onClick={convert}>Add selected to Contacts</Button>
      <Button startIcon={<DownloadRoundedIcon />} disabled={!leads.length} onClick={download}>Export CSV</Button>
    </Stack>

    <Stack spacing={1.25}>{leads.map((lead) => <Card key={lead._id} variant="outlined"><CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <Checkbox checked={selected.includes(lead._id)} disabled={lead.status === 'converted'} onChange={(e) => setSelected((old) => e.target.checked ? [...old, lead._id] : old.filter((id) => id !== lead._id))} />
      <Box sx={{ minWidth: 0, flex: 1 }}><Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center"><Typography fontWeight={800}>{lead.name}</Typography>{lead.category ? <Chip size="small" label={lead.category} /> : null}{lead.status === 'converted' ? <Chip size="small" color="success" label="In Contacts" /> : null}</Stack><Typography variant="body2" color="text.secondary">{lead.address || 'No address'}</Typography><Typography variant="body2" sx={{ mt: .5 }}>{lead.phone || 'No phone'}{lead.email ? ` • ${lead.email}` : ''}</Typography><Typography variant="body2" color="text.secondary">{lead.rating ? `★ ${lead.rating} · ${lead.reviewCount || 0} reviews` : 'No rating'}{lead.website ? ` • ${lead.website}` : ''}</Typography></Box>
    </CardContent></Card>)}</Stack>
    {!leads.length && !activeJob ? <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>{scraperStatus.online ? 'No leads yet. Start your first search above.' : 'Turn on the office PC and Lead Finder agent to start searching.'}</Typography> : null}
  </Box>;
}
