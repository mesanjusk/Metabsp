'use client';

import { useEffect, useState } from 'react';
import { Alert, Box, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import apiClient from '@/lib/api/client';

const statusColor = {
  pending: 'warning',
  completed: 'success',
  no_account_found: 'info',
  failed: 'error',
};

export default function AdminPrivacyRequestsPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiClient.get('/api/admin/privacy/deletion-requests')
      .then((response) => {
        if (active) setRows(response?.data?.data || []);
      })
      .catch((err) => {
        if (active) setError(err?.response?.data?.message || 'Could not load privacy requests.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  if (loading) {
    return <Stack alignItems="center" py={5}><CircularProgress size={24} /></Stack>;
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" fontWeight={800}>Privacy & deletion requests</Typography>
        <Typography variant="body2" color="text.secondary">
          Manual requests stay pending until identity is verified and processing is completed. Meta callback requests appear here as an audit trail too.
        </Typography>
      </Box>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {!rows.length ? (
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
          <Typography color="text.secondary">No deletion requests have been recorded.</Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {rows.map((row) => (
            <Paper key={row._id || row.confirmationCode} variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 3, minWidth: 0 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ md: 'flex-start' }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                    <Typography fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>
                      {row.requesterEmail || row.provider || 'Provider request'}
                    </Typography>
                    <Chip size="small" label={row.status || 'unknown'} color={statusColor[row.status] || 'default'} />
                    <Chip size="small" variant="outlined" label={row.requestType === 'manual' ? 'Manual request' : 'Provider callback'} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, overflowWrap: 'anywhere' }}>
                    Confirmation: {row.confirmationCode}
                  </Typography>
                  {row.accountId ? <Typography variant="body2" color="text.secondary">Account ID supplied: {row.accountId}</Typography> : null}
                  {row.reason ? <Typography variant="body2" sx={{ mt: 0.75 }}>Reason: {row.reason}</Typography> : null}
                  {row.notes ? <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{row.notes}</Typography> : null}
                </Box>
                <Box sx={{ flexShrink: 0 }}>
                  <Typography variant="caption" color="text.secondary">
                    {row.createdAt ? new Date(row.createdAt).toLocaleString() : 'Date unavailable'}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
