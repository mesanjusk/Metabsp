'use client';

import { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Stack, TextField, Typography } from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import apiClient from '@/lib/api/client';
import { SMB_KINDS } from '@/lib/smb/workspaceRegistry';

const money = (paise) => `₹${Math.round(Number(paise || 0) / 100).toLocaleString('en-IN')}`;

/** Ask the workspace a question in words. Extracted verbatim from the old combined workspace. */
export default function BusinessCopilot() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ask = async (preset) => {
    const text = String(preset || question).trim();
    if (!text) return;
    setBusy(true);
    setError('');
    try {
      const response = await apiClient.post('/api/smb/assistant', { question: text });
      setResult(response?.data?.data || null);
      setQuestion('');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Could not read business data.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }} alignItems="center">
          <AutoAwesomeRoundedIcon fontSize="small" />
          <Typography variant="h6" fontWeight={800}>Business Copilot</Typography>
          <Chip size="small" label="Live workspace data" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ my: 1.5 }}>
          Ask about leads, follow-ups, outstanding payments, sales, expenses, orders or overdue tasks.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            fullWidth
            size="small"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Who needs follow-up today?"
            onKeyDown={(e) => { if (e.key === 'Enter') ask(); }}
          />
          <Button variant="contained" onClick={() => ask()} disabled={busy || !question.trim()}>
            {busy ? 'Checking…' : 'Ask'}
          </Button>
        </Stack>
        <Stack direction="row" sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
          {['Follow-ups due', 'Outstanding payments', 'Overdue tasks', 'Sales this month'].map((preset) => (
            <Button key={preset} size="small" onClick={() => ask(preset)} disabled={busy}>{preset}</Button>
          ))}
        </Stack>
        {error ? <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert> : null}
        {result ? (
          <Box sx={{ mt: 1.5 }}>
            <Alert severity="info">{result.answer}</Alert>
            {result.items?.slice(0, 6).map((item) => (
              <Stack key={item._id} direction="row" justifyContent="space-between" sx={{ py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" noWrap>
                  {item.title} · {item.contactId?.name || item.contactId?.phone || item.assignedTo || SMB_KINDS[item.kind]?.label || item.kind}
                </Typography>
                {item.balanceInPaise ? <Typography variant="body2" fontWeight={800}>{money(item.balanceInPaise)}</Typography> : null}
              </Stack>
            ))}
          </Box>
        ) : null}
      </CardContent>
    </Card>
  );
}
