'use client';

import { useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import { useParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';
import { getInstituteFeature } from '@/lib/institute/featureRegistry';
import { fieldsForResource } from '@/lib/institute/fieldRegistry';

function payloadOf(item) { return item?.payload || {}; }
function displayName(item) {
  const p = payloadOf(item);
  return p.name || [p.firstName,p.middleName,p.lastName].filter(Boolean).join(' ') || p.studentName || p.exam || p.education || p.category || p.course || item?.legacyId || 'Record';
}
function secondary(item) {
  const p = payloadOf(item);
  return p.mobileSelf || p.mobileParent || p.mobile || p.phone || p.email || p.course || p.description || p.Status || p.status || '';
}

function toCsv(items) {
  const payloads = items.map(payloadOf);
  const keys = [...new Set(payloads.flatMap((p) => Object.keys(p).filter((k) => !k.startsWith('__'))))];
  const esc = (v) => `"${String(v ?? '').replaceAll('"','""')}"`;
  return [keys.map(esc).join(','), ...payloads.map((p) => keys.map((k) => esc(typeof p[k] === 'object' ? JSON.stringify(p[k]) : p[k])).join(','))].join('\n');
}

export default function InstituteFeaturePage() {
  const params = useParams();
  const slug = Array.isArray(params?.feature) ? params.feature[0] : params?.feature;
  const feature = getInstituteFeature(slug);
  const resource = feature?.resource;
  const fields = useMemo(() => fieldsForResource(resource), [resource]);
  const [items,setItems] = useState([]);
  const [query,setQuery] = useState('');
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [open,setOpen] = useState(false);
  const [editing,setEditing] = useState(null);
  const [form,setForm] = useState({});

  const load = async () => {
    if (!resource) return;
    setLoading(true); setError('');
    try {
      const response = await apiClient.get(`/api/institute/${resource}`, { params: query ? { q: query, limit: 200 } : { limit: 200 } });
      setItems(response?.data?.data || []);
    } catch (e) { setError(e?.response?.data?.message || 'Could not load records.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [resource]);

  if (!feature) return <PageBody title="Institute tool not found"><Button component={NextLink} href="/services/institute">Back to Institute</Button></PageBody>;
  if (feature.href) return <PageBody title={feature.label}><Alert severity="info">This tool is shared with the main platform.</Alert><Button component={NextLink} href={feature.href} sx={{mt:2}}>Open {feature.label}</Button></PageBody>;

  const startCreate = () => { setEditing(null); setForm({}); setOpen(true); };
  const startEdit = (item) => { setEditing(item); setForm({ ...payloadOf(item) }); setOpen(true); };
  const save = async () => {
    try {
      if (editing?._id) await apiClient.patch(`/api/institute/${resource}/${editing._id}`, form);
      else await apiClient.post(`/api/institute/${resource}`, form);
      setOpen(false); await load();
    } catch (e) { setError(e?.response?.data?.message || 'Could not save record.'); }
  };
  const remove = async (item) => {
    if (!window.confirm(`Delete ${displayName(item)}?`)) return;
    try { await apiClient.delete(`/api/institute/${resource}/${item._id}`); await load(); }
    catch (e) { setError(e?.response?.data?.message || 'Could not delete record.'); }
  };
  const exportCsv = () => {
    const blob = new Blob([toCsv(items)], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`${resource}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const reportOnly = ['report','balance','funnel','trial-balance','profit-loss'].includes(feature.kind);

  return (
    <PageBody title={feature.label} description={feature.description}>
      <Stack spacing={2.25}>
        <Stack direction={{xs:'column',sm:'row'}} spacing={1} justifyContent="space-between">
          <Button component={NextLink} href="/services/institute" startIcon={<ArrowBackRoundedIcon />} sx={{alignSelf:'flex-start'}}>Institute</Button>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={exportCsv} disabled={!items.length}>Export CSV</Button>
            {!reportOnly && <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={startCreate}>Add</Button>}
          </Stack>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

        <TextField size="small" placeholder={`Search ${feature.label.toLowerCase()}…`} value={query} onChange={(e)=>setQuery(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') load(); }} InputProps={{startAdornment:<SearchRoundedIcon sx={{mr:1,color:'text.secondary'}} />}} />

        {reportOnly && (
          <Paper variant="outlined" sx={{p:2,borderRadius:3}}>
            <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
              <Box><Typography variant="caption" color="text.secondary">Records</Typography><Typography variant="h5" fontWeight={800}>{items.length}</Typography></Box>
              {feature.kind === 'balance' && <Box><Typography variant="caption" color="text.secondary">Outstanding</Typography><Typography variant="h5" fontWeight={800}>₹{items.reduce((s,i)=>s+Number(payloadOf(i).balance||0),0).toLocaleString('en-IN')}</Typography></Box>}
              {feature.kind === 'funnel' && ['hot','warm','cold'].map((v)=><Box key={v}><Typography variant="caption" color="text.secondary">{v.toUpperCase()}</Typography><Typography variant="h5" fontWeight={800}>{items.filter(i=>payloadOf(i).score===v).length}</Typography></Box>)}
              {feature.kind === 'profit-loss' && <Box><Typography variant="caption" color="text.secondary">Net</Typography><Typography variant="h5" fontWeight={800}>₹{items.reduce((s,i)=>{const p=payloadOf(i); const a=Number(p.amount||0); return s + (p.type==='income'||p.type==='receipt'?a:-a);},0).toLocaleString('en-IN')}</Typography></Box>}
            </Stack>
          </Paper>
        )}

        <Paper variant="outlined" sx={{borderRadius:3,overflow:'hidden'}}>
          {loading ? <Typography color="text.secondary" sx={{p:3}}>Loading…</Typography> : !items.length ? <Typography color="text.secondary" sx={{p:3}}>No records yet.</Typography> : items.map((item,index)=>(
            <Stack key={item._id} direction="row" alignItems="center" spacing={1.5} sx={{p:1.7,borderBottom:index===items.length-1?0:'1px solid',borderColor:'divider'}}>
              <Box sx={{flex:1,minWidth:0}}><Typography variant="body2" fontWeight={750} noWrap>{displayName(item)}</Typography><Typography variant="caption" color="text.secondary" noWrap sx={{display:'block'}}>{secondary(item) || new Date(item.updatedAt).toLocaleDateString()}</Typography></Box>
              <Chip size="small" variant="outlined" label={item.source || 'metabsp'} />
              {!reportOnly && <><IconButton size="small" onClick={()=>startEdit(item)}><EditRoundedIcon fontSize="small" /></IconButton><IconButton size="small" onClick={()=>remove(item)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></>}
            </Stack>
          ))}
        </Paper>
      </Stack>

      <Dialog open={open} onClose={()=>setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? `Edit ${feature.label}` : `Add ${feature.label}`}</DialogTitle>
        <DialogContent><Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',sm:'repeat(2,1fr)'},gap:1.5,pt:1}}>
          {fields.map(([key,label,type,required,options]) => type === 'select' ? (
            <TextField key={key} select label={label} required={Boolean(required)} value={form[key] ?? ''} onChange={(e)=>setForm((f)=>({...f,[key]:e.target.value}))} fullWidth>{(options||[]).map((o)=><MenuItem key={o||'blank'} value={o}>{o || 'Not set'}</MenuItem>)}</TextField>
          ) : (
            <TextField key={key} label={label} type={type==='textarea'?'text':type} required={Boolean(required)} multiline={type==='textarea'} minRows={type==='textarea'?3:undefined} value={form[key] ?? ''} onChange={(e)=>setForm((f)=>({...f,[key]:type==='number' ? Number(e.target.value) : e.target.value}))} fullWidth sx={type==='textarea'?{gridColumn:{sm:'1 / -1'}}:undefined} InputLabelProps={type==='date'?{shrink:true}:undefined} />
          ))}
        </Box></DialogContent>
        <DialogActions><Button onClick={()=>setOpen(false)}>Cancel</Button><Button variant="contained" onClick={save}>Save</Button></DialogActions>
      </Dialog>
    </PageBody>
  );
}
