'use client';

import { useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import { Alert, Box, Button, Divider, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';

const sample = { student_name:'Aarav Sharma', class_name:'10-A', roll_number:'24', section:'A', active_photo_url:'' };
function tokenText(text, data=sample) { return String(text || '').replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => data[key] ?? ''); }

export default function InstituteCanvasEditor() {
  const [designs, setDesigns] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [design, setDesign] = useState(null);
  const [selectedElementId, setSelectedElementId] = useState('');
  const [error, setError] = useState('');
  const elements = design?.canvas?.elements || [];
  const selectedElement = useMemo(()=>elements.find((e)=>e.id===selectedElementId) || null,[elements,selectedElementId]);

  const load = async () => {
    try { const r = await apiClient.get('/api/institute/designs',{params:{docType:'id_card'}}); const rows=r.data?.data||[]; setDesigns(rows); if(!selectedId&&rows[0]) setSelectedId(rows[0]._id); }
    catch(e){setError(e?.response?.data?.message||'Could not load designs.');}
  };
  useEffect(()=>{load();},[]);
  useEffect(()=>{ const row=designs.find((d)=>d._id===selectedId); if(row){setDesign(structuredClone(row)); setSelectedElementId(row.canvas?.elements?.[0]?.id||'');}},[selectedId,designs]);

  const createDesign = async () => {
    try { const r=await apiClient.post('/api/institute/designs',{name:`ID Card ${designs.length+1}`,docType:'id_card'}); await load(); setSelectedId(r.data.data._id); }
    catch(e){setError(e?.response?.data?.message||'Could not create design.');}
  };
  const updateElement = (patch) => setDesign((d)=>({...d,canvas:{...d.canvas,elements:d.canvas.elements.map((e)=>e.id===selectedElementId?{...e,...patch}:e)}}));
  const addText = () => { const id=`text-${Date.now()}`; setDesign((d)=>({...d,canvas:{...d.canvas,elements:[...(d.canvas.elements||[]),{id,type:'text',x:20,y:20,width:200,text:'New text',fontSize:16,fontWeight:500,align:'left'}]}})); setSelectedElementId(id); };
  const addPhoto = () => { const id=`photo-${Date.now()}`; setDesign((d)=>({...d,canvas:{...d.canvas,elements:[...(d.canvas.elements||[]),{id,type:'photo',x:30,y:30,width:90,height:110,radius:6,field:'active_photo_url'}]}})); setSelectedElementId(id); };
  const remove = () => { setDesign((d)=>({...d,canvas:{...d.canvas,elements:d.canvas.elements.filter((e)=>e.id!==selectedElementId)}})); setSelectedElementId(''); };
  const save = async () => {
    try { const r=await apiClient.patch(`/api/institute/designs/${design._id}`,{name:design.name,width:design.width,height:design.height,canvas:design.canvas}); setDesign(r.data.data); setDesigns((all)=>all.map((x)=>x._id===r.data.data._id?r.data.data:x)); }
    catch(e){setError(e?.response?.data?.message||'Could not save design.');}
  };

  return <PageBody title="Canvas / ID Card Designer" description="Build reusable ID-card templates with live student placeholders and save them for ID-card projects.">
    <Stack spacing={2}>
      {error&&<Alert severity="error" onClose={()=>setError('')}>{error}</Alert>}
      <Stack direction={{xs:'column',md:'row'}} spacing={1} justifyContent="space-between">
        <Stack direction="row" spacing={1}><Button component={NextLink} href="/services/institute/id-card">ID Card Manager</Button><Button onClick={addText} startIcon={<AddRoundedIcon/>} disabled={!design}>Text</Button><Button onClick={addPhoto} startIcon={<AddRoundedIcon/>} disabled={!design}>Photo</Button></Stack>
        <Stack direction="row" spacing={1}><Button onClick={createDesign}>New template</Button><Button variant="contained" startIcon={<SaveRoundedIcon/>} onClick={save} disabled={!design}>Save</Button></Stack>
      </Stack>
      <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',lg:'240px minmax(420px,1fr) 300px'},gap:2}}>
        <Paper variant="outlined" sx={{p:1.5,borderRadius:3}}>
          <Typography fontWeight={800} sx={{mb:1}}>Templates</Typography>
          <Stack spacing={1}>{designs.map((d)=><Button key={d._id} variant={selectedId===d._id?'contained':'outlined'} onClick={()=>setSelectedId(d._id)}>{d.name}</Button>)}</Stack>
        </Paper>
        <Paper variant="outlined" sx={{p:2,borderRadius:3,overflow:'auto',minHeight:520}}>
          {!design?<Typography color="text.secondary">Create a template to start.</Typography>:<>
            <Stack direction="row" spacing={1} sx={{mb:2}}><TextField size="small" label="Template name" value={design.name} onChange={(e)=>setDesign(d=>({...d,name:e.target.value}))}/><TextField size="small" type="number" label="Width" value={design.width} onChange={(e)=>setDesign(d=>({...d,width:Number(e.target.value)}))}/><TextField size="small" type="number" label="Height" value={design.height} onChange={(e)=>setDesign(d=>({...d,height:Number(e.target.value)}))}/></Stack>
            <Box sx={{mx:'auto',position:'relative',width:design.width,height:design.height,background:design.canvas?.background||'#fff',border:'1px solid',borderColor:'divider',boxShadow:2,overflow:'hidden'}}>
              {elements.map((el)=>el.type==='text'?<Box key={el.id} onClick={()=>setSelectedElementId(el.id)} sx={{position:'absolute',left:el.x,top:el.y,width:el.width||180,fontSize:el.fontSize||16,fontWeight:el.fontWeight||400,textAlign:el.align||'left',cursor:'pointer',outline:selectedElementId===el.id?'2px solid currentColor':'none'}}>{tokenText(el.text)}</Box>:<Box key={el.id} onClick={()=>setSelectedElementId(el.id)} sx={{position:'absolute',left:el.x,top:el.y,width:el.width||90,height:el.height||110,borderRadius:`${el.radius||0}px`,border:'1px dashed',borderColor:'text.secondary',display:'grid',placeItems:'center',overflow:'hidden',cursor:'pointer',outline:selectedElementId===el.id?'2px solid currentColor':'none'}}>{sample.active_photo_url?<Box component="img" src={sample.active_photo_url} sx={{width:'100%',height:'100%',objectFit:'cover'}}/>:<Typography variant="caption" color="text.secondary">PHOTO</Typography>}</Box>)}
            </Box>
          </>}
        </Paper>
        <Paper variant="outlined" sx={{p:1.5,borderRadius:3}}>
          <Typography fontWeight={800}>Element properties</Typography><Divider sx={{my:1.5}}/>
          {!selectedElement?<Typography variant="body2" color="text.secondary">Select an element on the card.</Typography>:<Stack spacing={1.2}>
            <TextField size="small" label="X" type="number" value={selectedElement.x||0} onChange={(e)=>updateElement({x:Number(e.target.value)})}/><TextField size="small" label="Y" type="number" value={selectedElement.y||0} onChange={(e)=>updateElement({y:Number(e.target.value)})}/><TextField size="small" label="Width" type="number" value={selectedElement.width||0} onChange={(e)=>updateElement({width:Number(e.target.value)})}/>
            {selectedElement.type==='text'?<><TextField size="small" label="Text / placeholder" multiline minRows={3} value={selectedElement.text||''} onChange={(e)=>updateElement({text:e.target.value})}/><TextField size="small" label="Font size" type="number" value={selectedElement.fontSize||16} onChange={(e)=>updateElement({fontSize:Number(e.target.value)})}/><TextField size="small" select label="Align" value={selectedElement.align||'left'} onChange={(e)=>updateElement({align:e.target.value})}>{['left','center','right'].map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField><Alert severity="info">Placeholders: {'{{student_name}}'}, {'{{class_name}}'}, {'{{roll_number}}'}, {'{{section}}'}</Alert></>:<><TextField size="small" label="Height" type="number" value={selectedElement.height||0} onChange={(e)=>updateElement({height:Number(e.target.value)})}/><TextField size="small" label="Corner radius" type="number" value={selectedElement.radius||0} onChange={(e)=>updateElement({radius:Number(e.target.value)})}/></>}
            <Button color="error" startIcon={<DeleteOutlineRoundedIcon/>} onClick={remove}>Delete element</Button>
          </Stack>}
        </Paper>
      </Box>
    </Stack>
  </PageBody>;
}
