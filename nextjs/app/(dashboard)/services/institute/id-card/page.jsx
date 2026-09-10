'use client';

import { useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DesignServicesRoundedIcon from '@mui/icons-material/DesignServicesRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';

function parseCsv(text) {
  const rows = String(text || '').trim().split(/\r?\n/).filter(Boolean).map((line) => line.split(',').map((x) => x.trim().replace(/^"|"$/g, '')));
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] || ''])));
}

export default function InstituteIDCardManager() {
  const [projects, setProjects] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({ title: '', academic_year: '' });
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState('student_name,roll_number,class_name,section\n');
  const [filter, setFilter] = useState('');

  const loadProjects = async () => {
    try { const r = await apiClient.get('/api/institute/idcards/projects'); const rows=r.data?.data || []; setProjects(rows); setSelected((current)=>current ? rows.find((p)=>p.project_uuid===current.project_uuid)||current : current); }
    catch (e) { setError(e?.response?.data?.message || 'Could not load ID card projects.'); }
  };
  const loadDesigns = async () => {
    try { const r=await apiClient.get('/api/institute/designs',{params:{docType:'id_card'}}); setDesigns(r.data?.data||[]); }
    catch (e) { setError(e?.response?.data?.message || 'Could not load design templates.'); }
  };
  const loadStudents = async (project) => {
    if (!project) return;
    try { const r = await apiClient.get(`/api/institute/idcards/projects/${project.project_uuid}/students`); setStudents(r.data?.data || []); }
    catch (e) { setError(e?.response?.data?.message || 'Could not load students.'); }
  };
  useEffect(() => { loadProjects(); loadDesigns(); }, []);
  useEffect(() => { if (selected) loadStudents(selected); }, [selected?.project_uuid]);

  const visibleStudents = useMemo(() => students.filter((s) => !filter || [s.student_name,s.roll_number,s.class_name,s.section,s.card_status].join(' ').toLowerCase().includes(filter.toLowerCase())), [students, filter]);

  const createProject = async () => {
    try {
      const r = await apiClient.post('/api/institute/idcards/projects', projectForm);
      setProjectOpen(false); setProjectForm({ title:'', academic_year:'' }); await loadProjects(); setSelected(r.data?.data || null);
    } catch (e) { setError(e?.response?.data?.message || 'Could not create project.'); }
  };
  const assignDesign = async (designId) => {
    if (!selected) return;
    try { const r=await apiClient.patch(`/api/institute/idcards/projects/${selected.project_uuid}`,{design_id:designId||null}); setSelected(r.data.data); await loadProjects(); }
    catch(e){setError(e?.response?.data?.message||'Could not assign template.');}
  };
  const importStudents = async () => {
    const rows = parseCsv(csv);
    if (!rows.length) return setError('Add a CSV header and at least one student row.');
    try { await apiClient.post(`/api/institute/idcards/projects/${selected.project_uuid}/students`, { students: rows }); setImportOpen(false); await loadStudents(selected); }
    catch (e) { setError(e?.response?.data?.message || 'Could not import students.'); }
  };
  const action = async (student, body) => {
    try {
      const r = await apiClient.patch(`/api/institute/idcards/students/${student.idcard_uuid}`, body);
      if (r.data?.link) { await navigator.clipboard?.writeText(r.data.link); window.alert(`Magic link copied:\n${r.data.link}`); }
      await loadStudents(selected);
    } catch (e) { setError(e?.response?.data?.message || 'Could not update student.'); }
  };

  return (
    <PageBody title="ID Card Manager" description="Create projects, import students, collect photos, approve cards and print from one workflow.">
      <Stack spacing={2}>
        {error && <Alert severity="error" onClose={()=>setError('')}>{error}</Alert>}
        <Stack direction={{xs:'column',sm:'row'}} spacing={1} justifyContent="space-between">
          <Stack direction="row" spacing={1}><Button component={NextLink} href="/services/institute">Institute</Button><Button component={NextLink} href="/services/institute/canvas" startIcon={<DesignServicesRoundedIcon />}>Canvas editor</Button></Stack>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={()=>setProjectOpen(true)}>New ID project</Button>
        </Stack>

        <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',md:'280px 1fr'},gap:2}}>
          <Paper variant="outlined" sx={{p:1.5,borderRadius:3}}>
            <Typography fontWeight={800} sx={{mb:1}}>Projects</Typography>
            <Stack spacing={1}>
              {!projects.length && <Typography variant="body2" color="text.secondary">No projects yet.</Typography>}
              {projects.map((p)=><Button key={p.project_uuid} variant={selected?.project_uuid===p.project_uuid?'contained':'outlined'} onClick={()=>setSelected(p)} sx={{justifyContent:'space-between'}}><span>{p.title}</span><Chip size="small" label={p.student_count || 0} /></Button>)}
            </Stack>
          </Paper>

          <Stack spacing={1.5}>
            {!selected ? <Paper variant="outlined" sx={{p:4,borderRadius:3,textAlign:'center'}}><Typography color="text.secondary">Select or create an ID-card project.</Typography></Paper> : <>
              <Paper variant="outlined" sx={{p:2,borderRadius:3}}>
                <Stack spacing={1.5}>
                  <Stack direction={{xs:'column',sm:'row'}} spacing={1} justifyContent="space-between">
                    <Box><Typography variant="h6" fontWeight={850}>{selected.title}</Typography><Typography variant="body2" color="text.secondary">Academic year {selected.academic_year || '—'} · {students.length} students</Typography></Box>
                    <Stack direction="row" spacing={1}><Button variant="outlined" onClick={()=>setImportOpen(true)}>Import CSV</Button><Button component={NextLink} href="/services/institute/canvas">Design card</Button><Button component={NextLink} href={`/services/institute/id-card-print?project=${selected.project_uuid}`} startIcon={<PrintRoundedIcon/>} disabled={!selected.design_id}>Print</Button></Stack>
                  </Stack>
                  <TextField select size="small" label="Assigned ID-card template" value={selected.design_id||''} onChange={(e)=>assignDesign(e.target.value)} helperText={!designs.length?'Create a template in Canvas editor first.':'This template is used for preview, student verification and printing.'}>
                    <MenuItem value="">No template</MenuItem>{designs.map((d)=><MenuItem key={d._id} value={d._id}>{d.name}</MenuItem>)}
                  </TextField>
                </Stack>
              </Paper>
              <TextField size="small" placeholder="Search student, class, roll or status" value={filter} onChange={(e)=>setFilter(e.target.value)} />
              <Paper variant="outlined" sx={{borderRadius:3,overflow:'hidden'}}>
                {!visibleStudents.length ? <Typography sx={{p:3}} color="text.secondary">No students in this project.</Typography> : visibleStudents.map((s,i)=><Stack key={s.idcard_uuid} direction={{xs:'column',md:'row'}} spacing={1} alignItems={{md:'center'}} sx={{p:1.5,borderBottom:i===visibleStudents.length-1?0:'1px solid',borderColor:'divider'}}>
                  <Box sx={{flex:1}}><Typography fontWeight={750}>{s.display_name || s.student_name}</Typography><Typography variant="caption" color="text.secondary">{s.class_name || 'No class'} {s.section ? `· ${s.section}`:''} {s.roll_number ? `· Roll ${s.roll_number}`:''}</Typography></Box>
                  <Chip size="small" label={s.card_status} />
                  <Button size="small" onClick={()=>action(s,{ action:'magic-link' })} startIcon={<ContentCopyRoundedIcon />}>Student link</Button>
                  {s.card_status==='student_submitted' ? <><Button size="small" variant="contained" onClick={()=>action(s,{action:'approve'})}>Approve</Button><Button size="small" onClick={()=>action(s,{action:'reject'})}>Reject</Button></> : <Button size="small" onClick={()=>action(s,{card_status:s.card_status==='not_available'?'pending':'not_available'})}>{s.card_status==='not_available'?'Mark pending':'No photo'}</Button>}
                </Stack>)}
              </Paper>
            </>}
          </Stack>
        </Box>
      </Stack>

      <Dialog open={projectOpen} onClose={()=>setProjectOpen(false)} fullWidth maxWidth="sm"><DialogTitle>New ID-card project</DialogTitle><DialogContent><Stack spacing={2} sx={{pt:1}}><TextField label="Project title" required value={projectForm.title} onChange={(e)=>setProjectForm(f=>({...f,title:e.target.value}))}/><TextField label="Academic year" placeholder="2026-27" value={projectForm.academic_year} onChange={(e)=>setProjectForm(f=>({...f,academic_year:e.target.value}))}/></Stack></DialogContent><DialogActions><Button onClick={()=>setProjectOpen(false)}>Cancel</Button><Button variant="contained" onClick={createProject}>Create</Button></DialogActions></Dialog>
      <Dialog open={importOpen} onClose={()=>setImportOpen(false)} fullWidth maxWidth="md"><DialogTitle>Import students from CSV</DialogTitle><DialogContent><Alert severity="info" sx={{mb:1.5}}>Supported columns include student_name/name, roll_number/roll, class_name/class and section. Extra columns are preserved.</Alert><TextField fullWidth multiline minRows={12} value={csv} onChange={(e)=>setCsv(e.target.value)} /></DialogContent><DialogActions><Button onClick={()=>setImportOpen(false)}>Cancel</Button><Button variant="contained" onClick={importStudents}>Import</Button></DialogActions></Dialog>
    </PageBody>
  );
}
