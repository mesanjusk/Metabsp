'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, CardHeader, Checkbox, Chip, FormControlLabel,
  MenuItem, Stack, Table, TableBody, TableCell, TableRow, TextField, Typography } from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import apiClient from '@/lib/api/client';
import { parseApiError } from '@/lib/api/parseApiError';
import { toast } from '@/lib/ui/components/Toast';
import { BUSY_SOURCES, busySetupUrl, busyTemplateBindings } from '@/lib/integrations/busyConfig';

const SOURCE_LABELS = { message: 'BUSY message', invoice_url: 'Invoice PDF link', param1: 'Other parameter 1', param2: 'Other parameter 2', param3: 'Other parameter 3' };

export default function BusyIntegrationPanel() {
  const [integrations, setIntegrations] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [mode, setMode] = useState('template');
  const [name, setName] = useState('BUSY Accounting');
  const [addIndiaCode, setAddIndiaCode] = useState(true);
  const [sources, setSources] = useState({});
  const [issued, setIssued] = useState(null);
  const [origin, setOrigin] = useState('');
  const [error, setError] = useState('');
  const [templateError, setTemplateError] = useState('');
  const [loading, setLoading] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revokingId, setRevokingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/api/whatsapp/busy');
      setIntegrations(data.integrations || []);
      setAccounts(data.accounts || []);
      setAccountId(current => current || String(data.accounts?.find(a => a.isActive)?._id || data.accounts?.[0]?._id || ''));
    } catch (err) { setError(parseApiError(err, 'Could not load BUSY setup.')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { setOrigin(window.location.origin); load(); }, [load]);
  useEffect(() => {
    let active = true;
    setTemplates([]); setTemplateId(''); setSources({}); setTemplateError('');
    if (!accountId || mode !== 'template') { setTemplatesLoading(false); return; }
    setTemplatesLoading(true);
    apiClient.get('/api/whatsapp/busy', { params: { accountId } })
      .then(({ data }) => { if (active) setTemplates((data.templates || []).filter(t => t.status === 'APPROVED')); })
      .catch(err => { if (active) setTemplateError(parseApiError(err, 'Could not load templates.')); })
      .finally(() => { if (active) setTemplatesLoading(false); });
    return () => { active = false; };
  }, [accountId, mode]);

  const template = templates.find(t => `${t.name}|${t.language}` === templateId);
  const templateInfo = useMemo(() => {
    if (!template) return { bindings: [], error: '' };
    try { return { bindings: busyTemplateBindings(template), error: '' }; }
    catch (err) { return { bindings: [], error: err.message }; }
  }, [template]);

  const create = async () => {
    setSaving(true); setError('');
    try {
      const { data } = await apiClient.post('/api/whatsapp/busy', { name, accountId, mode, addIndiaCode,
        template: template?.name, language: template?.language,
        sources: Object.fromEntries(templateInfo.bindings.map(b => {
          const key = `${b.component}:${b.variable}`;
          return [key, sources[key] || b.source];
        })),
      });
      setIssued(data);
      await load();
    } catch (err) { setError(parseApiError(err, 'Could not create BUSY integration.')); }
    finally { setSaving(false); }
  };
  const copy = async value => {
    try { await navigator.clipboard.writeText(value); toast.success('Copied.'); }
    catch { toast.error('Copy failed. Select the value and copy it manually.'); }
  };
  const revoke = async integration => {
    if (!window.confirm(`Revoke "${integration.name}"? Its BUSY configuration will stop sending.`)) return;
    setRevokingId(integration.id);
    try {
      await apiClient.delete(`/api/whatsapp/api-keys/${integration.id}`);
      if (issued?.id === integration.id) setIssued(null);
      await load();
    } catch (err) { setError(parseApiError(err, 'Could not revoke BUSY token.')); }
    finally { setRevokingId(''); }
  };
  const extraFields = [...new Set((issued?.config?.bindings || []).map(b => b.source))].filter(s => /^param[123]$/.test(s));
  const needsInvoice = (issued?.config?.bindings || []).some(b => b.source === 'invoice_url');

  return (
    <Stack spacing={3}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Card>
        <CardHeader title="Connect BUSY Accounting" subheader="Send invoices and messages from BUSY using your connected WhatsApp number." />
        <CardContent>
          <Stack spacing={2.5}>
            <Alert severity="info">Create a separate token for each BUSY company. Each token can send only through its selected number and message setup.</Alert>
            {loading ? <Typography>Loading connected numbers…</Typography> : null}
            {!loading && !accounts.length ? <Alert severity="warning">Connect a WhatsApp number first, then refresh this page.</Alert> : null}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              <TextField label="Integration name" value={name} onChange={e => setName(e.target.value)} inputProps={{ maxLength: 100 }} fullWidth />
              <TextField select label="Send from" value={accountId} onChange={e => setAccountId(e.target.value)} disabled={!accounts.length} fullWidth>
                {accounts.map(a => <MenuItem key={a._id} value={String(a._id)}>{a.displayPhoneNumber || a.phoneNumberId}{a.verifiedName ? ` · ${a.verifiedName}` : ''}</MenuItem>)}
              </TextField>
            </Box>
            <TextField select label="Message type" value={mode} onChange={e => setMode(e.target.value)} fullWidth>
              <MenuItem value="template">Approved template — invoices and notifications</MenuItem>
              <MenuItem value="text">Text — replies within 24 hours only</MenuItem>
            </TextField>
            {mode === 'template' ? (
              <Stack spacing={2}>
                {templateError ? <Alert severity="warning">{templateError}</Alert> : null}
                <TextField select label={templatesLoading ? 'Loading templates…' : 'Approved template'} value={templateId}
                  disabled={templatesLoading || !templates.length} onChange={e => { setTemplateId(e.target.value); setSources({}); }} fullWidth
                  helperText="Create and get a template approved in WhatsApp Templates first. Its wording must match the invoice or notification you send.">
                  {templates.map(t => <MenuItem key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>{t.name} ({t.language})</MenuItem>)}
                </TextField>
                {accountId && !templatesLoading && !templates.length && !templateError ? <Alert severity="info">No approved templates found for this number.</Alert> : null}
                {templateInfo.error ? <Alert severity="warning">{templateInfo.error}</Alert> : null}
                {template ? <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{template.components?.find(c => c.type === 'BODY')?.text}</Typography> : null}
                {templateInfo.bindings.map(b => {
                  const key = `${b.component}:${b.variable}`;
                  return <TextField key={key} select fullWidth label={b.type === 'document' ? 'PDF document' : `${b.component} variable {{${b.variable}}}`}
                    value={sources[key] || b.source} onChange={e => setSources(current => ({ ...current, [key]: e.target.value }))}>
                    {(b.type === 'document' ? ['invoice_url'] : BUSY_SOURCES).map(source => <MenuItem key={source} value={source}>{SOURCE_LABELS[source]}</MenuItem>)}
                  </TextField>;
                })}
              </Stack>
            ) : <Alert severity="warning">Text can be sent only within 24 hours of the customer's last message. Use an approved template for invoices sent outside that window.</Alert>}
            <FormControlLabel control={<Checkbox checked={addIndiaCode} onChange={e => setAddIndiaCode(e.target.checked)} />} label="Add India country code 91 to 10-digit mobile numbers" />
            <Box><Button variant="contained" disabled={saving || loading || !accountId || (mode === 'template' && (!template || templatesLoading || Boolean(templateInfo.error)))} onClick={create}>
              {saving ? 'Creating…' : 'Create BUSY token'}
            </Button></Box>
          </Stack>
        </CardContent>
      </Card>

      {issued ? (
        <Card>
          <CardHeader title="Copy these settings into BUSY" subheader={`Sending from ${issued.config.sender}. Copy the token now; it is shown only once.`} />
          <CardContent>
            <Stack spacing={2}>
              <TextField label="WhatsApp/SMS API URL" value={busySetupUrl(origin, issued.config.bindings)} InputProps={{ readOnly: true }} multiline fullWidth />
              <Box><Button startIcon={<ContentCopyRoundedIcon />} onClick={() => copy(busySetupUrl(origin, issued.config.bindings))}>Copy API URL</Button></Box>
              <TextField label="Token — paste in User Name's Parameter Value" value={issued.token} InputProps={{ readOnly: true }} multiline fullWidth />
              <Box><Button startIcon={<ContentCopyRoundedIcon />} onClick={() => copy(issued.token)}>Copy token</Button></Box>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" aria-label="BUSY parameter mapping">
                  <TableBody>
                    <TableRow><TableCell>BUSY field</TableCell><TableCell>Parameter Name</TableCell><TableCell>Parameter Value</TableCell></TableRow>
                    <TableRow><TableCell>User Name</TableCell><TableCell>BUSY_TOKEN</TableCell><TableCell>Paste the token above</TableCell></TableRow>
                    <TableRow><TableCell>Password</TableCell><TableCell>Not used</TableCell><TableCell>Leave blank</TableCell></TableRow>
                    <TableRow><TableCell>Senders ID</TableCell><TableCell>Not used</TableCell><TableCell>Leave blank; sender is fixed above</TableCell></TableRow>
                    <TableRow><TableCell>Mobile</TableCell><TableCell>BUSY_MOBILE</TableCell><TableCell>Picked by BUSY when sending</TableCell></TableRow>
                    <TableRow><TableCell>Message</TableCell><TableCell>BUSY_MESSAGE</TableCell><TableCell>Picked by BUSY when sending</TableCell></TableRow>
                    <TableRow><TableCell>No. of Other Parameters</TableCell><TableCell>—</TableCell><TableCell>{extraFields.length}</TableCell></TableRow>
                    {extraFields.map((field, i) => <TableRow key={field}><TableCell>Other Parameter {i + 1}</TableCell><TableCell>BUSY_{field.toUpperCase()}</TableCell><TableCell>Value for {SOURCE_LABELS[field].toLowerCase()}; enable Change at Run Time for values that vary</TableCell></TableRow>)}
                  </TableBody>
                </Table>
              </Box>
              <Typography variant="body2">Keep parameter names exactly as shown. Enable “Separate Internal Call for Each Number During Bulk SMS” and leave “Treatment of Mobile Number” as “Leave as it is”. BUSY must URL-encode message and parameter values, including &amp;, + and Hindi text.</Typography>
              {issued.config.mode === 'text' ? <Typography variant="body2">For invoice PDF links in text messages, enable “Send PDF link for Invoice” in BUSY.</Typography> : null}
              {needsInvoice ? <Alert severity="info">Enable “Send PDF link for Invoice”. The connector uses the first HTTPS link in the BUSY message as the invoice URL. It must open without login. A DOCUMENT template sends it as a PDF attachment; a text variable sends it as a link. Keep that invoice link as the first HTTPS link.</Alert> : null}
              <Alert severity="warning">Keep this token and the completed sending URL private. Do not open the sending URL in a browser: it sends a message. Revoke the token below if it is exposed.</Alert>
              <Typography variant="body2">Save the format in BUSY and send one test invoice to your own WhatsApp number. Check the dashboard inbox for delivery. Identical sends are suppressed for two minutes to avoid duplicates during retries.</Typography>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Your BUSY integrations" action={<Button onClick={load} disabled={loading}>Refresh</Button>} />
        <CardContent>
          <Stack spacing={2}>
            {!integrations.length && !loading ? <Typography color="text.secondary">No BUSY integrations yet.</Typography> : null}
            {integrations.map(integration => <Stack key={integration.id} direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: 'center' }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{integration.name}</Typography>
                <Typography variant="body2" color="text.secondary">{integration.config?.sender} · {integration.config?.mode === 'text' ? 'Text replies' : integration.config?.template}</Typography>
                <Typography variant="caption" color="text.secondary">{integration.prefix}… · {integration.lastUsedAt ? `Last used ${new Date(integration.lastUsedAt).toLocaleString()}` : 'Not used yet'}</Typography>
              </Box>
              {integration.isActive ? <Button color="error" onClick={() => revoke(integration)} disabled={Boolean(revokingId)}>Revoke</Button> : <Chip label="Revoked" size="small" />}
            </Stack>)}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
