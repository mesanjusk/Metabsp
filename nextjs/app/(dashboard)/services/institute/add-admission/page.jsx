'use client';

import { useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import {
  Alert, Box, Button, Card, CardContent, Divider, MenuItem, Stack, Step, StepLabel, Stepper, TextField, Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';

const payloadOf = (item) => item?.payload || {};
const fullName = (p) => p.name || [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ') || 'Student';
const isoToday = () => new Date().toISOString().slice(0, 10);
const nextMonth = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); };

const initialForm = {
  existingStudentId: '', firstName: '', middleName: '', lastName: '', dob: '', gender: '', mobileSelf: '', mobileParent: '', address: '', education: '',
  admissionDate: isoToday(), course: '', batchTime: '', examEvent: '',
  fees: '', discount: 0, feePaid: 0, paidBy: '', installment: 0, emiDate: nextMonth(),
};

export default function AddAdmissionPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [exams, setExams] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    Promise.all([
      apiClient.get('/api/institute/students', { params: { limit: 200 } }),
      apiClient.get('/api/institute/courses', { params: { limit: 200 } }),
      apiClient.get('/api/institute/batches', { params: { limit: 200 } }),
      apiClient.get('/api/institute/exams', { params: { limit: 200 } }),
      apiClient.get('/api/institute/payment-modes', { params: { limit: 200 } }),
    ]).then(([s,c,b,e,p]) => {
      setStudents(s?.data?.data || []); setCourses(c?.data?.data || []); setBatches(b?.data?.data || []); setExams(e?.data?.data || []); setPaymentModes(p?.data?.data || []);
    }).catch(() => setError('Some dropdown data could not be loaded. You can still enter values manually where available.'));
  }, []);

  const selectedStudent = useMemo(() => students.find((s) => s._id === form.existingStudentId), [students, form.existingStudentId]);
  const fees = Number(form.fees || 0); const discount = Number(form.discount || 0); const paid = Number(form.feePaid || 0);
  const total = Math.max(0, fees - discount); const balance = Math.max(0, total - paid); const installments = Math.max(0, Number(form.installment || 0));
  const emi = installments > 0 ? balance / installments : 0;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const validateStep = () => {
    if (step === 0 && !form.existingStudentId && !form.firstName.trim()) return 'Select an existing student or enter student first name.';
    if (step === 1 && !form.course.trim()) return 'Course is required.';
    if (step === 2) {
      if (discount > fees) return 'Discount cannot exceed course fees.';
      if (paid > total) return 'Amount paid cannot exceed total fees.';
    }
    return '';
  };
  const next = () => { const m = validateStep(); if (m) return setError(m); setError(''); setStep((v) => Math.min(2, v + 1)); };
  const back = () => { setError(''); setStep((v) => Math.max(0, v - 1)); };

  const submit = async () => {
    const m = validateStep(); if (m) return setError(m);
    setLoading(true); setError('');
    try {
      const body = {
        ...(form.existingStudentId ? { studentRecordId: form.existingStudentId } : {
          firstName: form.firstName, middleName: form.middleName, lastName: form.lastName, dob: form.dob, gender: form.gender,
          mobileSelf: form.mobileSelf, mobileParent: form.mobileParent, address: form.address, education: form.education,
        }),
        admissionDate: form.admissionDate, course: form.course, batchTime: form.batchTime, examEvent: form.examEvent,
        fees, discount, feePaid: paid, paidBy: form.paidBy, installment: installments, emiDate: form.emiDate,
      };
      const res = await apiClient.post('/api/institute/admissions/workflow', body);
      setSaved(res?.data?.data || {});
    } catch (e) {
      setError(e?.response?.data?.message || e?.response?.data?.error || 'Could not create admission.');
    } finally { setLoading(false); }
  };

  if (saved) {
    const p = saved.payload || {};
    return <PageBody title="Admission completed" description="Student admission and fee plan were created together.">
      <Card variant="outlined" sx={{ maxWidth: 650, borderRadius: 3 }}><CardContent>
        <Stack spacing={2} alignItems="flex-start">
          <CheckCircleRoundedIcon color="success" sx={{ fontSize: 46 }} />
          <Box><Typography variant="h6" fontWeight={800}>{p.studentName || 'Student admitted'}</Typography><Typography color="text.secondary">{p.course} · Admission {p.uuid}</Typography></Box>
          <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
            <Box><Typography variant="caption" color="text.secondary">Total</Typography><Typography fontWeight={800}>₹{Number(p.total || 0).toLocaleString('en-IN')}</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">Paid</Typography><Typography fontWeight={800}>₹{Number(p.feePaid || 0).toLocaleString('en-IN')}</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">Balance</Typography><Typography fontWeight={800}>₹{Number(p.balance || 0).toLocaleString('en-IN')}</Typography></Box>
          </Stack>
          <Stack direction="row" spacing={1}><Button component={NextLink} href="/services/institute/admissions" variant="contained">View admissions</Button><Button onClick={() => { setSaved(null); setForm(initialForm); setStep(0); }} variant="outlined">Add another</Button></Stack>
        </Stack>
      </CardContent></Card>
    </PageBody>;
  }

  return <PageBody title="New Admission" description="Instify-style student → course → fee workflow, now native to MetaBSP.">
    <Stack spacing={2.5} maxWidth={900}>
      <Button component={NextLink} href="/services/institute" startIcon={<ArrowBackRoundedIcon />} sx={{ alignSelf: 'flex-start' }}>Institute</Button>
      <Stepper activeStep={step} alternativeLabel>{['Student','Course & Batch','Fees & Payment'].map((x)=><Step key={x}><StepLabel>{x}</StepLabel></Step>)}</Stepper>
      {error && <Alert severity="error">{error}</Alert>}

      <Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent sx={{ p: { xs: 2, md: 3 } }}>
        {step === 0 && <Stack spacing={2}>
          <Typography variant="h6" fontWeight={800}>Student details</Typography>
          <TextField select label="Use existing student" value={form.existingStudentId} onChange={set('existingStudentId')} helperText="Optional — leave blank to create a new student">
            <MenuItem value="">Create new student</MenuItem>{students.map((s)=>{const p=payloadOf(s); return <MenuItem key={s._id} value={s._id}>{fullName(p)} {p.mobileSelf ? `· ${p.mobileSelf}` : ''}</MenuItem>;})}
          </TextField>
          {!selectedStudent && <Box sx={{ display:'grid', gridTemplateColumns:{xs:'1fr',sm:'repeat(2,1fr)'}, gap:1.5 }}>
            <TextField label="First name" required value={form.firstName} onChange={set('firstName')} /><TextField label="Middle name" value={form.middleName} onChange={set('middleName')} />
            <TextField label="Last name" value={form.lastName} onChange={set('lastName')} /><TextField label="Date of birth" type="date" value={form.dob} onChange={set('dob')} InputLabelProps={{shrink:true}} />
            <TextField select label="Gender" value={form.gender} onChange={set('gender')}><MenuItem value="">Not set</MenuItem>{['Male','Female','Other'].map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField>
            <TextField label="Student mobile" value={form.mobileSelf} onChange={set('mobileSelf')} inputMode="numeric" /><TextField label="Parent mobile" value={form.mobileParent} onChange={set('mobileParent')} inputMode="numeric" />
            <TextField label="Education / class" value={form.education} onChange={set('education')} /><TextField label="Address" value={form.address} onChange={set('address')} multiline minRows={2} sx={{gridColumn:{sm:'1 / -1'}}} />
          </Box>}
          {selectedStudent && <Alert severity="info">Using existing student: <strong>{fullName(payloadOf(selectedStudent))}</strong></Alert>}
        </Stack>}

        {step === 1 && <Stack spacing={2}>
          <Typography variant="h6" fontWeight={800}>Course & admission</Typography>
          <Box sx={{ display:'grid', gridTemplateColumns:{xs:'1fr',sm:'repeat(2,1fr)'}, gap:1.5 }}>
            <TextField label="Admission date" type="date" value={form.admissionDate} onChange={set('admissionDate')} InputLabelProps={{shrink:true}} />
            <TextField select={courses.length>0} label="Course" required value={form.course} onChange={set('course')}>{courses.map((x)=>{const p=payloadOf(x); return <MenuItem key={x._id} value={p.name || p.course}>{p.name || p.course}</MenuItem>;})}</TextField>
            <TextField select={batches.length>0} label="Batch" value={form.batchTime} onChange={set('batchTime')}>{batches.map((x)=>{const p=payloadOf(x); return <MenuItem key={x._id} value={p.timing || p.name}>{p.name || p.timing}</MenuItem>;})}</TextField>
            <TextField select={exams.length>0} label="Exam event" value={form.examEvent} onChange={set('examEvent')}>{exams.map((x)=>{const p=payloadOf(x); return <MenuItem key={x._id} value={p.exam}>{p.exam}</MenuItem>;})}</TextField>
          </Box>
        </Stack>}

        {step === 2 && <Stack spacing={2}>
          <Typography variant="h6" fontWeight={800}>Fees & payment</Typography>
          <Box sx={{ display:'grid', gridTemplateColumns:{xs:'1fr',sm:'repeat(2,1fr)'}, gap:1.5 }}>
            <TextField label="Course fees" type="number" value={form.fees} onChange={set('fees')} /><TextField label="Discount" type="number" value={form.discount} onChange={set('discount')} />
            <TextField label="Paid now" type="number" value={form.feePaid} onChange={set('feePaid')} /><TextField select={paymentModes.length>0} label="Payment mode" value={form.paidBy} onChange={set('paidBy')}>{paymentModes.map((x)=>{const p=payloadOf(x); const v=p.name||p.Account_name||p.mode; return <MenuItem key={x._id} value={v}>{v}</MenuItem>;})}</TextField>
            <TextField label="Installments" type="number" value={form.installment} onChange={set('installment')} /><TextField label="First EMI date" type="date" value={form.emiDate} onChange={set('emiDate')} InputLabelProps={{shrink:true}} />
          </Box>
          <Divider />
          <Stack direction={{xs:'column',sm:'row'}} spacing={4}>
            <Box><Typography variant="caption" color="text.secondary">TOTAL</Typography><Typography variant="h6" fontWeight={800}>₹{total.toLocaleString('en-IN')}</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">PAID</Typography><Typography variant="h6" fontWeight={800}>₹{paid.toLocaleString('en-IN')}</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">BALANCE</Typography><Typography variant="h6" fontWeight={800}>₹{balance.toLocaleString('en-IN')}</Typography></Box>
            {installments>0 && <Box><Typography variant="caption" color="text.secondary">APPROX. EMI</Typography><Typography variant="h6" fontWeight={800}>₹{emi.toLocaleString('en-IN',{maximumFractionDigits:2})}</Typography></Box>}
          </Stack>
        </Stack>}
      </CardContent></Card>

      <Stack direction="row" justifyContent="space-between">
        <Button onClick={back} disabled={step===0 || loading}>Back</Button>
        {step<2 ? <Button variant="contained" onClick={next}>Continue</Button> : <Button variant="contained" onClick={submit} disabled={loading}>{loading ? 'Creating…' : 'Complete Admission'}</Button>}
      </Stack>
    </Stack>
  </PageBody>;
}
