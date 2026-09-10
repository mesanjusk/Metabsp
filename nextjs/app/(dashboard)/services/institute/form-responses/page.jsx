'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import NextLink from 'next/link';
import { Alert, Box, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';

export default function FormResponsesPage(){
 const sp=useSearchParams(); const initial=sp.get('form')||''; const[forms,setForms]=useState([]),[formId,setFormId]=useState(initial),[rows,setRows]=useState([]),[error,setError]=useState('');
 useEffect(()=>{(async()=>{try{const r=await apiClient.get('/api/institute/forms');const f=r.data?.data||[];setForms(f);if(!formId&&f[0])setFormId(f[0]._id)}catch(e){setError(e?.response?.data?.message||'Could not load forms.')}})()},[]);
 useEffect(()=>{if(!formId)return;(async()=>{try{const r=await apiClient.get(`/api/institute/forms/${formId}/responses`);setRows(r.data?.data||[])}catch(e){setError(e?.response?.data?.message||'Could not load responses.')}})()},[formId]);
 const keys=[...new Set(rows.flatMap(r=>Object.keys(r.data||{})))];
 const exportCsv=()=>{const esc=v=>`"${String(v??'').replaceAll('"','""')}"`;const csv=[['Submitted',...keys].map(esc).join(','),...rows.map(r=>[new Date(r.createdAt).toLocaleString(),...keys.map(k=>Array.isArray(r.data?.[k])?r.data[k].join('; '):r.data?.[k])].map(esc).join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='form-responses.csv';a.click();URL.revokeObjectURL(a.href)};
 return <PageBody title="Form Responses" description="Review and export public enquiry/admission form submissions."><Stack spacing={2}>{error&&<Alert severity="error">{error}</Alert>}<Stack direction={{xs:'column',sm:'row'}} spacing={1}><Button component={NextLink} href="/services/institute/forms">Forms</Button><TextField select size="small" label="Form" value={formId} onChange={e=>setFormId(e.target.value)} sx={{minWidth:260}}>{forms.map(f=><MenuItem key={f._id} value={f._id}>{f.title}</MenuItem>)}</TextField><Button onClick={exportCsv} disabled={!rows.length}>Export CSV</Button></Stack><Paper variant="outlined" sx={{borderRadius:3,overflow:'auto'}}>{!rows.length?<Typography sx={{p:3}} color="text.secondary">No responses yet.</Typography>:<Box component="table" sx={{width:'100%',borderCollapse:'collapse','th,td':{p:1.2,borderBottom:'1px solid',borderColor:'divider',textAlign:'left',whiteSpace:'nowrap'}}}><thead><tr><th>Submitted</th>{keys.map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r._id}><td>{new Date(r.createdAt).toLocaleString()}</td>{keys.map(k=><td key={k}>{Array.isArray(r.data?.[k])?r.data[k].join(', '):String(r.data?.[k]??'')}</td>)}</tr>)}</tbody></Box>}</Paper></Stack></PageBody>;
}
