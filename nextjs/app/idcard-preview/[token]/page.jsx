'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import axios from 'axios';

function renderText(text, student) { return String(text||'').replace(/{{\s*([\w.]+)\s*}}/g,(_,k)=>student?.[k]??''); }

export default function IDCardPreviewPage() {
  const params=useParams(); const token=Array.isArray(params?.token)?params.token[0]:params?.token;
  const [data,setData]=useState(null); const [name,setName]=useState(''); const [photoUrl,setPhotoUrl]=useState(''); const [message,setMessage]=useState(''); const [error,setError]=useState('');
  const load=async()=>{try{const r=await axios.get(`/api/public/idcards/${token}`);setData(r.data.data);setName(r.data.data.student?.display_name||'');setPhotoUrl(r.data.data.student?.active_photo_url||'');}catch(e){setError(e?.response?.data?.message||'This link is invalid or expired.');}};
  useEffect(()=>{if(token)load();},[token]);
  const submit=async()=>{try{await axios.post(`/api/public/idcards/${token}`,{student_name_override:name,photo_url:photoUrl});setMessage('Submitted successfully. Your institute can now review and approve your card.');await load();}catch(e){setError(e?.response?.data?.message||'Could not submit changes.');}};
  const student=data?.student; const design=data?.design;
  return <Box sx={{minHeight:'100vh',bgcolor:'#f5f6f8',p:{xs:2,md:4}}}><Paper sx={{maxWidth:900,mx:'auto',p:{xs:2,md:4},borderRadius:4}}><Stack spacing={2.5}>
    <Box><Typography variant="h5" fontWeight={850}>ID Card Verification</Typography><Typography color="text.secondary">{data?.project?.title||'Institute ID Card'} {data?.project?.academic_year?`· ${data.project.academic_year}`:''}</Typography></Box>
    {error&&<Alert severity="error">{error}</Alert>}{message&&<Alert severity="success">{message}</Alert>}
    {student&&<Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',md:'1fr 1fr'},gap:3}}>
      <Stack spacing={1.5}><TextField label="Student name" value={name} onChange={(e)=>setName(e.target.value)}/><TextField label="Photo URL" helperText="Paste a public HTTPS image URL. Direct file upload will be added through the common media uploader." value={photoUrl} onChange={(e)=>setPhotoUrl(e.target.value)}/><TextField label="Class" value={student.class_name||''} disabled/><TextField label="Roll number" value={student.roll_number||''} disabled/><Button variant="contained" onClick={submit}>Submit for approval</Button><ChipLike status={student.card_status}/></Stack>
      <Box>{design?<Box sx={{mx:'auto',position:'relative',width:design.width,height:design.height,background:design.canvas?.background||'#fff',border:'1px solid #ddd',boxShadow:2,overflow:'hidden'}}>{(design.canvas?.elements||[]).map((el)=>el.type==='text'?<Box key={el.id} sx={{position:'absolute',left:el.x,top:el.y,width:el.width||180,fontSize:el.fontSize||16,fontWeight:el.fontWeight||400,textAlign:el.align||'left'}}>{renderText(el.text,{...student,student_name:name||student.student_name})}</Box>:<Box key={el.id} sx={{position:'absolute',left:el.x,top:el.y,width:el.width||90,height:el.height||110,borderRadius:`${el.radius||0}px`,overflow:'hidden',border:'1px solid #ddd'}}>{photoUrl?<Box component="img" src={photoUrl} sx={{width:'100%',height:'100%',objectFit:'cover'}}/>:null}</Box>)}</Box>:<Alert severity="info">No design template is assigned yet. You can still verify your name and photo.</Alert>}</Box>
    </Box>}
  </Stack></Paper></Box>;
}
function ChipLike({status}){return <Typography variant="body2" color="text.secondary">Status: <strong>{status||'pending'}</strong></Typography>}
