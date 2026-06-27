import { useState } from 'react';
import {
  Box, Card, CardContent, Chip, Grid, IconButton, LinearProgress,
  Paper, Stack, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tabs, Tooltip, Typography,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Phone as PhoneIcon,
  Message as MessageIcon,
  Webhook as WebhookIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Visibility as VisibilityIcon,
  LinkOff as LinkOffIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  Speed as SpeedIcon,
  CloudDone as CloudDoneIcon,
  Timer as TimerIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const connectedAccounts = [
  { id: 1, businessName: 'Acme Corp', bmId: '1234567890', phone: '+1 415 555 0100', status: 'Active', quality: 'HIGH', templates: 14, connectedDate: '2025-11-02' },
  { id: 2, businessName: 'Globex Inc', bmId: '2345678901', phone: '+44 20 7946 0101', status: 'Active', quality: 'MEDIUM', templates: 7, connectedDate: '2025-12-15' },
  { id: 3, businessName: 'Initech LLC', bmId: '3456789012', phone: '+91 98765 43210', status: 'Inactive', quality: 'LOW', templates: 3, connectedDate: '2026-01-08' },
  { id: 4, businessName: 'Umbrella Ltd', bmId: '4567890123', phone: '+49 30 12345678', status: 'Active', quality: 'HIGH', templates: 22, connectedDate: '2026-02-20' },
  { id: 5, businessName: 'Soylent GmbH', bmId: '5678901234', phone: '+33 1 70 20 30 40', status: 'Active', quality: 'HIGH', templates: 11, connectedDate: '2026-03-05' },
];

const phoneNumbers = [
  { id: 1, number: '+1 415 555 0100', displayName: 'Acme Support', accountId: '1234567890', quality: 'HIGH', limit: '100K/day', status: 'Connected' },
  { id: 2, number: '+44 20 7946 0101', displayName: 'Globex Sales', accountId: '2345678901', quality: 'MEDIUM', limit: '10K/day', status: 'Connected' },
  { id: 3, number: '+91 98765 43210', displayName: 'Initech Help', accountId: '3456789012', quality: 'LOW', limit: '1K/day', status: 'Flagged' },
  { id: 4, number: '+49 30 12345678', displayName: 'Umbrella DE', accountId: '4567890123', quality: 'HIGH', limit: '100K/day', status: 'Connected' },
  { id: 5, number: '+33 1 70 20 30 40', displayName: 'Soylent FR', accountId: '5678901234', quality: 'HIGH', limit: '50K/day', status: 'Connected' },
];

const templates = [
  { id: 1, name: 'order_confirmation', category: 'UTILITY', language: 'en_US', status: 'APPROVED', created: '2025-11-10' },
  { id: 2, name: 'summer_promo_2026', category: 'MARKETING', language: 'en_US', status: 'APPROVED', created: '2026-01-15' },
  { id: 3, name: 'otp_login', category: 'AUTHENTICATION', language: 'en_US', status: 'APPROVED', created: '2025-12-01' },
  { id: 4, name: 'shipping_update', category: 'UTILITY', language: 'en_GB', status: 'PENDING', created: '2026-06-20' },
  { id: 5, name: 'reengagement_q2', category: 'MARKETING', language: 'de_DE', status: 'REJECTED', created: '2026-04-03' },
  { id: 6, name: 'appointment_reminder', category: 'UTILITY', language: 'fr_FR', status: 'APPROVED', created: '2026-02-28' },
];

const messageAnalytics = [
  { day: 'Mon', sent: 12400, delivered: 11900, read: 8700 },
  { day: 'Tue', sent: 15200, delivered: 14800, read: 10500 },
  { day: 'Wed', sent: 9800, delivered: 9300, read: 7100 },
  { day: 'Thu', sent: 18700, delivered: 18200, read: 13400 },
  { day: 'Fri', sent: 21000, delivered: 20500, read: 16200 },
  { day: 'Sat', sent: 13600, delivered: 13200, read: 9800 },
  { day: 'Sun', sent: 8900, delivered: 8600, read: 6400 },
];

const templateUsage = [
  { name: 'order_confirmation', uses: 4200 },
  { name: 'otp_login', uses: 3800 },
  { name: 'summer_promo', uses: 2900 },
  { name: 'shipping_update', uses: 1700 },
  { name: 'appointment', uses: 1100 },
];

const webhookStatus = [
  { url: 'https://hooks.acmecorp.com/meta', events: 'messages, status', lastReceived: '2026-06-27 14:32:01', successRate: 99.8 },
  { url: 'https://api.globex.io/webhooks/wa', events: 'messages', lastReceived: '2026-06-27 14:31:47', successRate: 98.2 },
  { url: 'https://initech.net/hooks', events: 'messages, status, templates', lastReceived: '2026-06-27 12:10:05', successRate: 87.4 },
  { url: 'https://umbrella-de.com/wa/hook', events: 'messages, status', lastReceived: '2026-06-27 14:30:59', successRate: 99.9 },
];

const rateLimits = [
  { number: '+1 415 555 0100', daily: { used: 67400, limit: 100000 }, monthly: { used: 1820000, limit: 3000000 } },
  { number: '+44 20 7946 0101', daily: { used: 8200, limit: 10000 }, monthly: { used: 241000, limit: 300000 } },
  { number: '+49 30 12345678', daily: { used: 41000, limit: 100000 }, monthly: { used: 980000, limit: 3000000 } },
  { number: '+33 1 70 20 30 40', daily: { used: 28000, limit: 50000 }, monthly: { used: 710000, limit: 1500000 } },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const qualityColor = (q) => ({ HIGH: 'success', MEDIUM: 'warning', LOW: 'error' }[q] || 'default');
const statusColor = (s) => ({ APPROVED: 'success', PENDING: 'warning', REJECTED: 'error', Active: 'success', Inactive: 'default', Connected: 'success', Flagged: 'error' }[s] || 'default');

function SectionFade({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22 }}
    >
      {children}
    </motion.div>
  );
}

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function ConnectedAccounts() {
  return (
    <SectionFade>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              {['Business Name', 'BM ID', 'Phone', 'Status', 'Quality', 'Templates', 'Connected', 'Actions'].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {connectedAccounts.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{row.businessName}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.bmId}</TableCell>
                <TableCell>{row.phone}</TableCell>
                <TableCell><Chip label={row.status} color={statusColor(row.status)} size="small" /></TableCell>
                <TableCell><Chip label={row.quality} color={qualityColor(row.quality)} size="small" variant="outlined" /></TableCell>
                <TableCell>{row.templates}</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{row.connectedDate}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="View"><IconButton size="small"><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Disconnect"><IconButton size="small" color="error"><LinkOffIcon fontSize="small" /></IconButton></Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </SectionFade>
  );
}

function PhoneNumbers() {
  return (
    <SectionFade>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              {['Number', 'Display Name', 'Account ID', 'Quality', 'Msg Limit', 'Status', 'Actions'].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {phoneNumbers.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell sx={{ fontFamily: 'monospace' }}>{row.number}</TableCell>
                <TableCell>{row.displayName}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.accountId}</TableCell>
                <TableCell><Chip label={row.quality} color={qualityColor(row.quality)} size="small" /></TableCell>
                <TableCell sx={{ fontSize: '0.8rem' }}>{row.limit}</TableCell>
                <TableCell><Chip label={row.status} color={statusColor(row.status)} size="small" /></TableCell>
                <TableCell>
                  <Tooltip title="View"><IconButton size="small"><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </SectionFade>
  );
}

function Templates() {
  return (
    <SectionFade>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              {['Template Name', 'Category', 'Language', 'Status', 'Created', 'Actions'].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.name}</TableCell>
                <TableCell><Chip label={row.category} size="small" variant="outlined" color={{ MARKETING: 'primary', UTILITY: 'info', AUTHENTICATION: 'secondary' }[row.category] || 'default'} /></TableCell>
                <TableCell sx={{ fontSize: '0.8rem' }}>{row.language}</TableCell>
                <TableCell><Chip label={row.status} color={statusColor(row.status)} size="small" /></TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{row.created}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Preview"><IconButton size="small"><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Delete"><IconButton size="small" color="error"><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </SectionFade>
  );
}

function MessageAnalytics() {
  return (
    <SectionFade>
      <Grid container spacing={3}>
        <Grid item xs={12} lg={7}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Messages — Last 7 Days</Typography>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={messageAnalytics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <RechartsTooltip formatter={(v) => v.toLocaleString()} />
                  <Legend />
                  <Line type="monotone" dataKey="sent" stroke="#1877F2" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="delivered" stroke="#25D366" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="read" stroke="#9C27B0" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={5}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Template Usage</Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={templateUsage} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                  <RechartsTooltip formatter={(v) => v.toLocaleString()} />
                  <Bar dataKey="uses" fill="#1877F2" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </SectionFade>
  );
}

function WebhookStatusSection() {
  return (
    <SectionFade>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              {['Webhook URL', 'Events Subscribed', 'Last Received', 'Success Rate', 'Health'].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', color: 'text.secondary' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {webhookStatus.map((row, i) => (
              <TableRow key={i} hover>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.url}</TableCell>
                <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{row.events}</TableCell>
                <TableCell sx={{ fontSize: '0.8rem' }}>{row.lastReceived}</TableCell>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <LinearProgress variant="determinate" value={row.successRate} sx={{ width: 60, borderRadius: 1, height: 6 }} color={row.successRate > 98 ? 'success' : row.successRate > 90 ? 'warning' : 'error'} />
                    <Typography variant="caption" fontWeight={600}>{row.successRate}%</Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  {row.successRate > 98
                    ? <CheckCircleIcon color="success" fontSize="small" />
                    : row.successRate > 90
                    ? <WarningIcon color="warning" fontSize="small" />
                    : <ErrorIcon color="error" fontSize="small" />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </SectionFade>
  );
}

function ApiHealth() {
  const cards = [
    { label: 'Meta Graph API', status: 'Operational', icon: <CloudDoneIcon />, color: 'success.main', responseTime: '142ms' },
    { label: 'WhatsApp Cloud API', status: 'Operational', icon: <CloudDoneIcon />, color: 'success.main', responseTime: '98ms' },
    { label: 'Business Manager API', status: 'Degraded', icon: <WarningIcon />, color: 'warning.main', responseTime: '891ms' },
    { label: 'Rate Limit Remaining', status: '87%', icon: <SpeedIcon />, color: 'info.main', responseTime: null },
    { label: 'Token Expiry', status: '23 days', icon: <TimerIcon />, color: 'text.primary', responseTime: null },
  ];

  return (
    <SectionFade>
      <Grid container spacing={2}>
        {cards.map((c) => (
          <Grid item xs={12} sm={6} md={4} key={c.label}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Box sx={{ color: c.color }}>{c.icon}</Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>{c.label}</Typography>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ color: c.color }}>{c.status}</Typography>
                    {c.responseTime && (
                      <Typography variant="caption" color="text.secondary">Avg response: {c.responseTime}</Typography>
                    )}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </SectionFade>
  );
}

function RateLimitsSection() {
  return (
    <SectionFade>
      <Stack spacing={3}>
        {rateLimits.map((r) => {
          const dailyPct = Math.round((r.daily.used / r.daily.limit) * 100);
          const monthlyPct = Math.round((r.monthly.used / r.monthly.limit) * 100);
          return (
            <Card key={r.number} variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, fontFamily: 'monospace' }}>{r.number}</Typography>
                <Stack spacing={1.5}>
                  <Box>
                    <Stack direction="row" justifyContent="space-between" mb={0.5}>
                      <Typography variant="caption" color="text.secondary">Daily</Typography>
                      <Typography variant="caption" fontWeight={600}>{r.daily.used.toLocaleString()} / {r.daily.limit.toLocaleString()} ({dailyPct}%)</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={dailyPct} color={dailyPct > 80 ? 'error' : dailyPct > 60 ? 'warning' : 'success'} sx={{ height: 8, borderRadius: 1 }} />
                  </Box>
                  <Box>
                    <Stack direction="row" justifyContent="space-between" mb={0.5}>
                      <Typography variant="caption" color="text.secondary">Monthly</Typography>
                      <Typography variant="caption" fontWeight={600}>{r.monthly.used.toLocaleString()} / {r.monthly.limit.toLocaleString()} ({monthlyPct}%)</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={monthlyPct} color={monthlyPct > 80 ? 'error' : monthlyPct > 60 ? 'warning' : 'success'} sx={{ height: 8, borderRadius: 1 }} />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </SectionFade>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS = [
  'Connected Accounts',
  'Phone Numbers',
  'Templates',
  'Message Analytics',
  'Webhook Status',
  'API Health',
  'Rate Limits',
];

const STAT_CARDS = [
  { title: 'Connected Businesses', value: '5', subtitle: '+2 this month', icon: <BusinessIcon sx={{ color: '#1877F2' }} />, gradient: 'linear-gradient(135deg, #e3f0ff 0%, #f0f7ff 100%)' },
  { title: 'Active WA Numbers', value: '4', subtitle: '1 flagged', icon: <PhoneIcon sx={{ color: '#25D366' }} />, gradient: 'linear-gradient(135deg, #e8fdf0 0%, #f0fdf4 100%)' },
  { title: 'Messages Sent Today', value: '99,600', subtitle: 'Across all accounts', icon: <MessageIcon sx={{ color: '#9C27B0' }} />, gradient: 'linear-gradient(135deg, #f3e8ff 0%, #faf0ff 100%)' },
  { title: 'Webhook Success Rate', value: '96.3%', subtitle: 'Last 24 hours', icon: <WebhookIcon sx={{ color: '#FF6900' }} />, gradient: 'linear-gradient(135deg, #fff3e8 0%, #fff8f0 100%)' },
];

export default function TechProviderDashboard() {
  const [tab, setTab] = useState(0);

  const sections = [
    <ConnectedAccounts />,
    <PhoneNumbers />,
    <Templates />,
    <MessageAnalytics />,
    <WebhookStatusSection />,
    <ApiHealth />,
    <RateLimitsSection />,
  ];

  return (
    <Box sx={{ pb: 6 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2 }}>Tech Provider</Typography>
        <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1.2 }}>Provider Dashboard</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Manage all connected WhatsApp Business accounts, phone numbers, templates, and platform health.
        </Typography>
      </Box>

      {/* Stats Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {STAT_CARDS.map((c) => (
          <Grid item xs={12} sm={6} md={3} key={c.title}>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <Card sx={{ background: c.gradient, height: '100%' }} variant="outlined">
                <CardContent>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', mb: 0.5 }}>{c.title}</Typography>
                      <Typography variant="h5" fontWeight={900}>{c.value}</Typography>
                      <Typography variant="caption" color="text.secondary">{c.subtitle}</Typography>
                    </Box>
                    <Box sx={{ opacity: 0.85 }}>{c.icon}</Box>
                  </Stack>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* Tabs */}
      <Card variant="outlined">
        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ minHeight: 44, '& .MuiTab-root': { minHeight: 44, fontSize: '0.8rem', fontWeight: 600 } }}
          >
            {TABS.map((t) => <Tab key={t} label={t} />)}
          </Tabs>
        </Box>
        <CardContent sx={{ pt: 2.5 }}>
          <AnimatePresence mode="wait">
            <Box key={tab}>
              {sections[tab]}
            </Box>
          </AnimatePresence>
        </CardContent>
      </Card>
    </Box>
  );
}
