'use client';

import { useEffect, useState } from 'react';
import NextLink from 'next/link';
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, TextField, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CurrencyRupeeRoundedIcon from '@mui/icons-material/CurrencyRupeeRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';

const pOf = (item) => item?.payload || {};
const money = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function InstituteFeesPage() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ billed: 0, paid: 0, outstanding: 0 });
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [receipt, setReceipt] = useState({ amount: '', paymentMode: '', reference: '', note: '', paidAt: new Date().toISOString().slice(0,10) });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await apiClient.get('/api/institute/fees', { params: { limit: 200, ...(query ? { q: query } : {}) } });
      setItems(res?.data?.data || []); setSummary(res?.data?.summary || { billed:0, paid:0, outstanding:0 });
    } catch (e) { setError(e?.response?.data?.message || 'Could not load fee records.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const openReceipt = (item) => { setSelected(item); setReceipt({ amount:'', paymentMode:pOf(item).paidBy||'', reference:'', note:'', paidAt:new Date().toISOString().slice(0,10) }); };
  const collect = async () => {
    if (!selected) return;
    setSaving(true); setError('');
    try {
      await apiClient.post(`/api/institute/fees/${selected._id}/receipt`, receipt);
      setSelected(null); await load();
    } catch (e) { setError(e?.response?.data?.message || e?.response?.data?.error || 'Could not record receipt.'); }
    finally { setSaving(false); }
  };

  return <PageBody title="Fees & Collections" description="Native fee plans, installments, receipts and outstanding balances.">
    <Stack spacing={2.25}>
      <Stack direction={{xs:'column',sm:'row'}} justifyContent="space-between" spacing={1}>
        <Button component={NextLink} href="/services/institute" startIcon={<ArrowBackRoundedIcon />} sx={{alignSelf:'flex-start'}}>Institute</Button>
        <Button component={NextLink} href="/services/institute/add-admission" variant="contained">New Admission</Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',sm:'repeat(3,1fr)'},gap:1.5}}>
        {[['Total billed',summary.billed],['Collected',summary.paid],['Outstanding',summary.outstanding]].map(([label,value])=><Card key={label} variant="outlined" sx={{borderRadius:3}}><CardContent><Typography variant="caption" color="text.secondary">{label.toUpperCase()}</Typography><Typography variant="h5" fontWeight={800}>₹{money(value)}</Typography></CardContent></Card>)}
      </Box>
      <TextField size="small" placeholder="Search student, admission or course…" value={query} onChange={(e)=>setQuery(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter')load();}} />
      <Card variant="outlined" sx={{borderRadius:3}}><CardContent sx={{p:0,'&:last-child':{pb:0}}}>
        {loading ? <Typography sx={{p:3}} color="text.secondary">Loading…</Typography> : !items.length ? <Typography sx={{p:3}} color="text.secondary">No fee plans yet.</Typography> : items.map((item,index)=>{const p=pOf(item); const settled=Number(p.balance||0)<=0; return <Stack key={item._id} direction={{xs:'column',sm:'row'}} alignItems={{sm:'center'}} spacing={1.5} sx={{p:2,borderBottom:index===items.length-1?0:'1px solid',borderColor:'divider'}}>
          <Box sx={{flex:1,minWidth:0}}><Typography fontWeight={800}>{p.studentName||'Student'}</Typography><Typography variant="body2" color="text.secondary">{p.course||'Course'} · Admission {p.admission_uuid||'—'}</Typography></Box>
          <Stack direction="row" spacing={2} alignItems="center"><Box><Typography variant="caption" color="text.secondary">Paid</Typography><Typography fontWeight={700}>₹{money(p.feePaid)}</Typography></Box><Box><Typography variant="caption" color="text.secondary">Balance</Typography><Typography fontWeight={700}>₹{money(p.balance)}</Typography></Box><Chip size="small" color={settled?'success':'warning'} label={settled?'Paid':'Due'} /></Stack>
          <Button variant="outlined" startIcon={<ReceiptLongRoundedIcon />} disabled={settled} onClick={()=>openReceipt(item)}>Collect</Button>
        </Stack>;})}
      </CardContent></Card>
    </Stack>

    <Dialog open={Boolean(selected)} onClose={()=>setSelected(null)} fullWidth maxWidth="sm">
      <DialogTitle>Collect fee</DialogTitle><DialogContent><Stack spacing={1.5} sx={{pt:1}}>
        {selected && <Alert severity="info"><strong>{pOf(selected).studentName}</strong> · Outstanding ₹{money(pOf(selected).balance)}</Alert>}
        <TextField label="Amount" type="number" required value={receipt.amount} onChange={(e)=>setReceipt(r=>({...r,amount:e.target.value}))} />
        <TextField label="Payment mode" value={receipt.paymentMode} onChange={(e)=>setReceipt(r=>({...r,paymentMode:e.target.value}))} placeholder="Cash / UPI / Bank" />
        <TextField label="Payment date" type="date" value={receipt.paidAt} onChange={(e)=>setReceipt(r=>({...r,paidAt:e.target.value}))} InputLabelProps={{shrink:true}} />
        <TextField label="Reference" value={receipt.reference} onChange={(e)=>setReceipt(r=>({...r,reference:e.target.value}))} /><TextField label="Note" multiline minRows={2} value={receipt.note} onChange={(e)=>setReceipt(r=>({...r,note:e.target.value}))} />
        <Divider />{selected && <Typography variant="body2" color="text.secondary">After this receipt, balance will be approximately ₹{money(Math.max(0,Number(pOf(selected).balance||0)-Number(receipt.amount||0)))}</Typography>}
      </Stack></DialogContent><DialogActions><Button onClick={()=>setSelected(null)}>Cancel</Button><Button variant="contained" startIcon={<CurrencyRupeeRoundedIcon />} onClick={collect} disabled={saving}>{saving?'Saving…':'Save Receipt'}</Button></DialogActions>
    </Dialog>
  </PageBody>;
}
