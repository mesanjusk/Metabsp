'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import NextLink from 'next/link';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';

function tokenText(text, student) {
  return String(text || '').replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => student?.[key] ?? '');
}

function Card({ design, student }) {
  return <Box className="print-card" sx={{position:'relative',width:design.width,height:design.height,background:design.canvas?.background||'#fff',border:'1px solid #ddd',overflow:'hidden',breakInside:'avoid'}}>
    {(design.canvas?.elements||[]).map((el)=>el.type==='text'?<Box key={el.id} sx={{position:'absolute',left:el.x,top:el.y,width:el.width||180,fontSize:el.fontSize||16,fontWeight:el.fontWeight||400,textAlign:el.align||'left'}}>{tokenText(el.text,{...student,student_name:student.display_name||student.student_name})}</Box>:<Box key={el.id} sx={{position:'absolute',left:el.x,top:el.y,width:el.width||90,height:el.height||110,borderRadius:`${el.radius||0}px`,overflow:'hidden'}}>{student.active_photo_url?<Box component="img" src={student.active_photo_url} sx={{width:'100%',height:'100%',objectFit:'cover'}}/>:null}</Box>)}
  </Box>;
}

export default function IDCardPrintPage() {
  const sp=useSearchParams(); const projectId=sp.get('project');
  const [project,setProject]=useState(null); const [students,setStudents]=useState([]); const [design,setDesign]=useState(null); const [error,setError]=useState('');
  useEffect(()=>{(async()=>{if(!projectId)return;try{const pr=await apiClient.get(`/api/institute/idcards/projects/${projectId}`);const p=pr.data.data;setProject(p);const sr=await apiClient.get(`/api/institute/idcards/projects/${projectId}/students`);setStudents(sr.data?.data||[]);if(p.design_id){const dr=await apiClient.get(`/api/institute/designs/${p.design_id}`);setDesign(dr.data.data);}}catch(e){setError(e?.response?.data?.message||'Could not load print data.');}})();},[projectId]);
  const printable=students.filter((s)=>s.card_status!=='not_available');
  return <PageBody title="ID Card Print" description="Print-ready cards using the template assigned to the selected project.">
    <style jsx global>{`@media print { header, nav, aside, .no-print { display:none !important; } body { background:#fff !important; } .print-grid { display:grid !important; grid-template-columns:repeat(2,max-content) !important; gap:12px !important; } .print-card { box-shadow:none !important; } }`}</style>
    <Stack spacing={2}>
      <Stack className="no-print" direction="row" spacing={1}><Button component={NextLink} href="/services/institute/id-card">ID Card Manager</Button><Button variant="contained" startIcon={<PrintRoundedIcon/>} onClick={()=>window.print()} disabled={!design||!printable.length}>Print</Button></Stack>
      {error&&<Alert severity="error">{error}</Alert>}
      {!projectId&&<Alert severity="info">Open this screen from an ID-card project.</Alert>}
      {project&&!design&&<Alert severity="warning">Assign an ID-card template to {project.title} before printing.</Alert>}
      {design&&<><Paper className="no-print" variant="outlined" sx={{p:2,borderRadius:3}}><Typography fontWeight={800}>{project?.title}</Typography><Typography variant="body2" color="text.secondary">{printable.length} printable cards · template {design.name}</Typography></Paper><Box className="print-grid" sx={{display:'grid',gridTemplateColumns:{xs:'1fr',md:'repeat(2,max-content)'},gap:2,alignItems:'start'}}>{printable.map((s)=><Card key={s.idcard_uuid} design={design} student={s}/>)}</Box></>}
    </Stack>
  </PageBody>;
}
