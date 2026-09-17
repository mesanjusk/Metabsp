'use client';
import {useState} from 'react';
import {Alert,Box,Button,Chip,Divider,Paper,Stack,TextField,Typography} from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import apiClient from '@/lib/api/client';

const copy=(value)=>navigator.clipboard?.writeText(value);
function CopyRow({label,value}){return <Box><Typography variant="caption" color="text.secondary">{label}</Typography><Stack direction="row" spacing={1} alignItems="center"><Typography variant="body2" fontFamily="monospace" sx={{wordBreak:'break-all',flex:1}}>{value}</Typography><Button size="small" onClick={()=>copy(value)} startIcon={<ContentCopyRoundedIcon/>}>Copy</Button></Stack></Box>}

export default function StoreDomainSettings({profile,setProfile,setError,setNotice}){
 const[checking,setChecking]=useState(false);const active=profile?.domainStatus==='active';
 const verify=async()=>{setChecking(true);setError('');try{const r=await apiClient.post('/api/store/domain/verify');setProfile(x=>({...x,...r.data.data}));setNotice(r.data.message||'Domain checked.')}catch(e){const data=e?.response?.data;if(data?.data)setProfile(x=>({...x,...data.data}));setError(data?.message||'Could not verify the domain.')}finally{setChecking(false)}};
 return <Paper variant="outlined" sx={{p:{xs:2,md:2.5},borderRadius:3,bgcolor:'background.default'}}><Stack spacing={2}>
  <Box><Typography variant="h6" fontWeight={800}>Customer storefront links</Typography><Typography variant="body2" color="text.secondary">Share the public link now, use your MetaBSP subdomain, or connect a domain owned by your business.</Typography></Box>
  <CopyRow label="Public profile" value={profile?.publicUrl||`https://meta.sanjusk.in/shop/${profile?.slug||''}`}/>
  <CopyRow label="Automatic account subdomain" value={profile?.subdomainUrl||''}/>
  <Divider/>
  <Stack direction="row" spacing={1} alignItems="center"><Typography fontWeight={750}>Custom domain</Typography><Chip size="small" color={active?'success':profile?.domainStatus==='error'?'error':'default'} label={active?'Active':profile?.domainStatus==='dns_verified'?'HTTPS pending':profile?.customDomain?'Verification pending':'Not connected'}/></Stack>
  <TextField label="Domain" placeholder="shop.yourbusiness.com" value={profile?.customDomain||''} onChange={e=>setProfile(x=>({...x,customDomain:e.target.value}))} helperText="Use a subdomain such as shop.example.com. Save settings before verifying."/>
  {profile?.customDomain&&profile?.domainVerificationToken&&<Alert severity={active?'success':'info'}>{active?'Your custom domain is live.':<Stack spacing={1.25}><Typography variant="body2">Add these records in GoDaddy DNS, wait for propagation, then verify:</Typography><CopyRow label="CNAME — name/host: your store subdomain" value={`${profile.customDomain} → ${profile.domainCnameTarget}`}/><CopyRow label="TXT — name/host" value={`_metabsp-verification.${profile.customDomain}`}/><CopyRow label="TXT — value" value={profile.domainVerificationToken}/></Stack>}</Alert>}
  {profile?.domainError&&<Alert severity="warning">{profile.domainError}</Alert>}
  <Stack direction={{xs:'column',sm:'row'}} spacing={1}>{profile?.customDomain&&!active&&<Button variant="outlined" onClick={verify} disabled={checking||!profile?.domainVerificationToken} startIcon={<VerifiedRoundedIcon/>}>{checking?'Checking DNS…':'Verify domain'}</Button>}{active&&<Button component="a" href={`https://${profile.customDomain}`} target="_blank" variant="outlined" endIcon={<OpenInNewRoundedIcon/>}>Open custom domain</Button>}</Stack>
 </Stack></Paper>;
}
