import { useEffect, useMemo, useState } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { whatsappCloudService } from '../../services/whatsappCloudService';
import EmptyState from './EmptyState';
import LoadingSkeleton from './LoadingSkeleton';

const formatNumber = (value) => new Intl.NumberFormat('en-IN').format(Number(value || 0));
const getTs = (item) => new Date(item?.timestamp || item?.createdAt || item?.time || 0);
const getTextType = (item) => String(item?.status || '').toLowerCase();

function SummaryCard({ title, value }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
      <Typography variant="body2" color="text.secondary">{title}</Typography>
      <Typography variant="h4" fontWeight={700} sx={{ mt: 1 }}>{formatNumber(value)}</Typography>
    </Paper>
  );
}

export default function AnalyticsDashboard() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await whatsappCloudService.getMessages();
        const list = response?.data?.data?.messages || response?.data?.messages || response?.data?.data || response?.data || [];
        setMessages(Array.isArray(list) ? list : []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const metrics = useMemo(() => {
    const sent = messages.filter((item) => item?.fromMe || String(item?.direction || '').toLowerCase().includes('out')).length;
    const delivered = messages.filter((item) => ['delivered', 'sent', 'read', 'seen'].includes(getTextType(item))).length;
    const read = messages.filter((item) => ['read', 'seen'].includes(getTextType(item))).length;
    const replies = messages.filter((item) => !item?.fromMe && !String(item?.direction || '').toLowerCase().includes('out')).length;
    return { sent, delivered, read, replies };
  }, [messages]);

  const chartData = useMemo(() => {
    const days = new Map();
    messages.forEach((item) => {
      const date = getTs(item);
      if (Number.isNaN(date.getTime())) return;
      const key = date.toISOString().slice(0, 10);
      if (!days.has(key)) days.set(key, { day: key.slice(5), sent: 0, delivered: 0, read: 0, replies: 0 });
      const row = days.get(key);
      const outgoing = item?.fromMe || String(item?.direction || '').toLowerCase().includes('out');
      if (outgoing) row.sent += 1;
      if (['delivered', 'sent', 'read', 'seen'].includes(getTextType(item))) row.delivered += 1;
      if (['read', 'seen'].includes(getTextType(item))) row.read += 1;
      if (!outgoing) row.replies += 1;
    });
    return [...days.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-14);
  }, [messages]);

  if (loading) return <Paper variant="outlined" sx={{ borderRadius: 3 }}><LoadingSkeleton lines={6} /></Paper>;
  if (!messages.length) return <Paper variant="outlined" sx={{ borderRadius: 3 }}><EmptyState title="No Data Available" description="Analytics will appear once WhatsApp message data is available." /></Paper>;

  return (
    <Stack spacing={2} sx={{ p: { xs: 1, md: 2 }, height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.5 }}>
        <SummaryCard title="Sent" value={metrics.sent} />
        <SummaryCard title="Delivered" value={metrics.delivered} />
        <SummaryCard title="Read" value={metrics.read} />
        <SummaryCard title="Replies" value={metrics.replies} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 2 }}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Message Trend</Typography>
          <Box sx={{ height: 290 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="day" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="sent" stroke="#075e54" strokeWidth={2} /><Line type="monotone" dataKey="delivered" stroke="#25d366" strokeWidth={2} /></LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Read & Replies</Typography>
          <Box sx={{ height: 290 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="day" /><YAxis /><Tooltip /><Legend /><Bar dataKey="read" fill="#22c55e" name="Read" /><Bar dataKey="replies" fill="#f59e0b" name="Replies" /></BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Box>
    </Stack>
  );
}
