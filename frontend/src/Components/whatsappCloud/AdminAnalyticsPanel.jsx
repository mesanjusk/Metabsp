import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Grid, Paper, Stack, Typography } from '@mui/material';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { parseApiError } from '../../utils/parseApiError';
import apiClient from '../../apiClient';

const formatRupees = (paise) => `₹${((paise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const StatTile = ({ label, value }) => (
  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, height: '100%' }}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="h5" fontWeight={700}>{value}</Typography>
  </Paper>
);

// Cross-tenant usage/revenue view for admins — see
// backend/src/services/adminAnalyticsService.js. A single metric (message
// count) per tenant needs no legend or multi-hue palette; the WhatsApp-brand
// teal here matches the existing AnalyticsDashboard.jsx convention.
export default function AdminAnalyticsPanel() {
  const [overview, setOverview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/api/billing/admin/overview');
      setOverview(res?.data?.data || null);
    } catch (err) {
      setError(parseApiError(err, 'Could not load admin analytics.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 2 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">Loading analytics...</Typography>
      </Stack>
    );
  }

  if (error) return <Alert severity="warning">{error}</Alert>;
  if (!overview) return null;

  const chartData = overview.topTenantsByUsage.map((t) => ({ name: t.tenantName, messages: t.messageCount }));

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Admin analytics (this billing period)</Typography>

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6} md={3}>
          <StatTile label="Tenants" value={overview.tenantCount} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatTile label="Active subscriptions" value={overview.activeSubscriptionCount} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatTile label="Revenue" value={formatRupees(overview.revenueInPaiseThisPeriod)} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatTile label="Messages sent" value={overview.totalMessagesThisPeriod.toLocaleString('en-IN')} />
        </Grid>
      </Grid>

      {chartData.length > 0 ? (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Top tenants by messages sent</Typography>
          <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 36)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={140} />
              <Tooltip />
              <Bar dataKey="messages" fill="#075e54" radius={[0, 4, 4, 0]} name="Messages" />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      ) : (
        <Typography variant="body2" color="text.secondary">No tenant usage yet.</Typography>
      )}
    </Box>
  );
}
