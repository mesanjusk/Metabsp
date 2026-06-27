import { useState, useCallback } from 'react';
import {
  Box, Tab, Tabs, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Button, TextField, MenuItem, Select,
  FormControl, InputLabel, Stack, IconButton, Tooltip, Avatar, Dialog,
  DialogTitle, DialogContent, DialogActions, FormGroup, FormControlLabel,
  Checkbox, Grid, Divider, Badge, alpha, useMediaQuery, InputAdornment,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

// Icons
import DownloadIcon        from '@mui/icons-material/Download';
import FilterListIcon      from '@mui/icons-material/FilterList';
import RefreshIcon         from '@mui/icons-material/Refresh';
import AddIcon             from '@mui/icons-material/Add';
import ContentCopyIcon     from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon   from '@mui/icons-material/DeleteOutline';
import DevicesIcon         from '@mui/icons-material/Devices';
import LaptopIcon          from '@mui/icons-material/Laptop';
import PhoneAndroidIcon    from '@mui/icons-material/PhoneAndroid';
import CheckCircleIcon     from '@mui/icons-material/CheckCircle';
import CancelIcon          from '@mui/icons-material/Cancel';
import SearchIcon          from '@mui/icons-material/Search';
import SecurityIcon        from '@mui/icons-material/Security';
import LoginIcon           from '@mui/icons-material/Login';
import LogoutIcon          from '@mui/icons-material/Logout';
import SendIcon            from '@mui/icons-material/Send';
import KeyIcon             from '@mui/icons-material/Key';
import LinkIcon            from '@mui/icons-material/Link';
import DescriptionIcon     from '@mui/icons-material/Description';
import PersonIcon          from '@mui/icons-material/Person';
import ApiIcon             from '@mui/icons-material/Api';
import TimelineIcon        from '@mui/icons-material/Timeline';
import StorageIcon         from '@mui/icons-material/Storage';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const AUDIT_LOGS = [
  { id: 1,  timestamp: '2026-06-27 09:15:42', user: 'alice@example.com', action: 'LOGIN',              resource: 'Auth',       ip: '203.0.113.45',  result: 'Success', details: 'Browser login' },
  { id: 2,  timestamp: '2026-06-27 09:18:01', user: 'alice@example.com', action: 'MESSAGE_SENT',       resource: 'Contact #1204', ip: '203.0.113.45', result: 'Success', details: 'Template: order_confirm' },
  { id: 3,  timestamp: '2026-06-27 09:22:10', user: 'bob@example.com',   action: 'LOGIN',              resource: 'Auth',       ip: '198.51.100.22', result: 'Failed',  details: 'Invalid password (attempt 1)' },
  { id: 4,  timestamp: '2026-06-27 09:23:05', user: 'bob@example.com',   action: 'LOGIN',              resource: 'Auth',       ip: '198.51.100.22', result: 'Success', details: 'Browser login' },
  { id: 5,  timestamp: '2026-06-27 09:30:17', user: 'alice@example.com', action: 'TEMPLATE_CREATED',   resource: 'Template #89', ip: '203.0.113.45', result: 'Success', details: 'Name: promo_summer_2026' },
  { id: 6,  timestamp: '2026-06-27 09:45:33', user: 'carol@example.com', action: 'ACCOUNT_CONNECTED',  resource: 'WA Account', ip: '192.0.2.10',   result: 'Success', details: 'Phone: +14155550100' },
  { id: 7,  timestamp: '2026-06-27 10:01:00', user: 'carol@example.com', action: 'API_KEY_CREATED',    resource: 'API Keys',   ip: '192.0.2.10',   result: 'Success', details: 'Key: mbsp_****5f3a' },
  { id: 8,  timestamp: '2026-06-27 10:15:22', user: 'alice@example.com', action: 'MESSAGE_SENT',       resource: 'Bulk Campaign', ip: '203.0.113.45', result: 'Success', details: '452 messages queued' },
  { id: 9,  timestamp: '2026-06-27 10:30:45', user: 'dave@example.com',  action: 'LOGIN',              resource: 'Auth',       ip: '10.0.0.55',    result: 'Success', details: 'Magic link login' },
  { id: 10, timestamp: '2026-06-27 10:44:11', user: 'bob@example.com',   action: 'TEMPLATE_CREATED',   resource: 'Template #90', ip: '198.51.100.22', result: 'Failed', details: 'Meta API rejection' },
  { id: 11, timestamp: '2026-06-27 11:00:00', user: 'alice@example.com', action: 'LOGOUT',             resource: 'Auth',       ip: '203.0.113.45', result: 'Success', details: 'Manual logout' },
  { id: 12, timestamp: '2026-06-27 11:05:18', user: 'admin@example.com', action: 'API_KEY_CREATED',    resource: 'API Keys',   ip: '10.0.0.1',     result: 'Success', details: 'Key: mbsp_****9b2c' },
  { id: 13, timestamp: '2026-06-27 11:20:30', user: 'carol@example.com', action: 'MESSAGE_SENT',       resource: 'Contact #3310', ip: '192.0.2.10', result: 'Success', details: 'Template: appointment_remind' },
  { id: 14, timestamp: '2026-06-27 11:35:55', user: 'dave@example.com',  action: 'ACCOUNT_CONNECTED',  resource: 'WA Account', ip: '10.0.0.55',   result: 'Failed',  details: 'Token expired' },
  { id: 15, timestamp: '2026-06-27 12:00:00', user: 'admin@example.com', action: 'LOGIN',              resource: 'Auth',       ip: '10.0.0.1',    result: 'Success', details: 'Browser login' },
  { id: 16, timestamp: '2026-06-27 12:10:44', user: 'bob@example.com',   action: 'MESSAGE_SENT',       resource: 'Contact #720', ip: '198.51.100.22', result: 'Success', details: 'Free-form text' },
  { id: 17, timestamp: '2026-06-27 12:30:08', user: 'alice@example.com', action: 'LOGIN',              resource: 'Auth',       ip: '203.0.113.45', result: 'Success', details: 'Browser login' },
  { id: 18, timestamp: '2026-06-27 12:45:19', user: 'alice@example.com', action: 'TEMPLATE_CREATED',   resource: 'Template #91', ip: '203.0.113.45', result: 'Success', details: 'Name: payment_receipt' },
  { id: 19, timestamp: '2026-06-27 13:00:37', user: 'carol@example.com', action: 'API_KEY_CREATED',    resource: 'API Keys',   ip: '192.0.2.10',   result: 'Failed',  details: 'Rate limit exceeded' },
  { id: 20, timestamp: '2026-06-27 13:15:52', user: 'admin@example.com', action: 'LOGOUT',             resource: 'Auth',       ip: '10.0.0.1',    result: 'Success', details: 'Session timeout' },
  { id: 21, timestamp: '2026-06-27 13:30:01', user: 'dave@example.com',  action: 'ACCOUNT_CONNECTED',  resource: 'WA Account', ip: '10.0.0.55',   result: 'Success', details: 'Phone: +442012345678' },
  { id: 22, timestamp: '2026-06-27 14:00:00', user: 'bob@example.com',   action: 'LOGOUT',             resource: 'Auth',       ip: '198.51.100.22', result: 'Success', details: 'Manual logout' },
];

const ACTIVITY_LOGS = [
  { id: 1,  user: 'Alice Johnson',  email: 'alice@example.com', action: 'Sent bulk campaign to 452 contacts', icon: 'send',    timestamp: '2 hours ago',  ip: '203.0.113.45', color: '#25D366' },
  { id: 2,  user: 'Carol Smith',    email: 'carol@example.com', action: 'Connected WhatsApp account +14155550100', icon: 'link', timestamp: '3 hours ago', ip: '192.0.2.10',   color: '#128C7E' },
  { id: 3,  user: 'Admin',          email: 'admin@example.com', action: 'Created API key mbsp_****9b2c', icon: 'key',     timestamp: '3.5 hours ago', ip: '10.0.0.1',     color: '#FF9800' },
  { id: 4,  user: 'Bob Williams',   email: 'bob@example.com',   action: 'Failed template creation: Meta API rejection', icon: 'error', timestamp: '4 hours ago', ip: '198.51.100.22', color: '#f44336' },
  { id: 5,  user: 'Alice Johnson',  email: 'alice@example.com', action: 'Created template "promo_summer_2026"', icon: 'desc', timestamp: '5 hours ago',  ip: '203.0.113.45', color: '#2196F3' },
  { id: 6,  user: 'Dave Lee',       email: 'dave@example.com',  action: 'Logged in via magic link', icon: 'login',   timestamp: '6 hours ago',  ip: '10.0.0.55',    color: '#9C27B0' },
  { id: 7,  user: 'Carol Smith',    email: 'carol@example.com', action: 'Sent appointment reminder to #3310', icon: 'send', timestamp: '7 hours ago', ip: '192.0.2.10',  color: '#25D366' },
  { id: 8,  user: 'Alice Johnson',  email: 'alice@example.com', action: 'Logged out', icon: 'logout',  timestamp: '8 hours ago',  ip: '203.0.113.45', color: '#607D8B' },
  { id: 9,  user: 'Bob Williams',   email: 'bob@example.com',   action: 'Logged in successfully', icon: 'login',   timestamp: '9 hours ago',  ip: '198.51.100.22', color: '#4CAF50' },
  { id: 10, user: 'Dave Lee',       email: 'dave@example.com',  action: 'Failed to connect WhatsApp account', icon: 'error', timestamp: '10 hours ago', ip: '10.0.0.55', color: '#f44336' },
];

const ACCESS_LOGS = [
  { id: 1,  timestamp: '2026-06-27 14:01:05', endpoint: '/api/messages/send',       method: 'POST',   status: 200, responseTime: '142ms', ip: '203.0.113.45',  userAgent: 'MetaBSP-SDK/2.1 Node.js' },
  { id: 2,  timestamp: '2026-06-27 14:01:12', endpoint: '/api/contacts',             method: 'GET',    status: 200, responseTime: '67ms',  ip: '192.0.2.10',   userAgent: 'axios/1.6.0' },
  { id: 3,  timestamp: '2026-06-27 14:01:33', endpoint: '/api/templates',            method: 'POST',   status: 422, responseTime: '210ms', ip: '198.51.100.22', userAgent: 'PostmanRuntime/7.36' },
  { id: 4,  timestamp: '2026-06-27 14:02:00', endpoint: '/api/auth/me',              method: 'GET',    status: 200, responseTime: '23ms',  ip: '10.0.0.55',    userAgent: 'Mozilla/5.0 Chrome/124' },
  { id: 5,  timestamp: '2026-06-27 14:02:11', endpoint: '/api/webhooks',             method: 'GET',    status: 200, responseTime: '55ms',  ip: '10.0.0.1',     userAgent: 'MetaBSP-SDK/2.1 Python' },
  { id: 6,  timestamp: '2026-06-27 14:02:22', endpoint: '/api/messages/send',       method: 'POST',   status: 401, responseTime: '12ms',  ip: '185.220.101.7', userAgent: 'curl/8.0.1' },
  { id: 7,  timestamp: '2026-06-27 14:02:45', endpoint: '/api/analytics/overview',  method: 'GET',    status: 200, responseTime: '320ms', ip: '203.0.113.45',  userAgent: 'Mozilla/5.0 Chrome/124' },
  { id: 8,  timestamp: '2026-06-27 14:03:01', endpoint: '/api/campaigns',            method: 'POST',   status: 201, responseTime: '180ms', ip: '192.0.2.10',   userAgent: 'axios/1.6.0' },
  { id: 9,  timestamp: '2026-06-27 14:03:15', endpoint: '/api/contacts',             method: 'DELETE', status: 204, responseTime: '88ms',  ip: '10.0.0.1',     userAgent: 'PostmanRuntime/7.36' },
  { id: 10, timestamp: '2026-06-27 14:03:30', endpoint: '/api/templates/90',         method: 'GET',    status: 404, responseTime: '31ms',  ip: '198.51.100.22', userAgent: 'axios/1.6.0' },
  { id: 11, timestamp: '2026-06-27 14:03:50', endpoint: '/api/messages/send',       method: 'POST',   status: 429, responseTime: '8ms',   ip: '185.220.101.7', userAgent: 'python-requests/2.31' },
  { id: 12, timestamp: '2026-06-27 14:04:05', endpoint: '/api/auth/refresh',         method: 'POST',   status: 200, responseTime: '44ms',  ip: '10.0.0.55',    userAgent: 'Mozilla/5.0 Firefox/125' },
];

const SESSIONS = [
  { id: 1,  device: 'MacBook Pro',      browser: 'Chrome 124',  ip: '203.0.113.45',  location: 'New York, US',     lastActive: 'Active now', started: '2026-06-27 09:15', current: true },
  { id: 2,  device: 'iPhone 15 Pro',    browser: 'Safari 17',   ip: '203.0.113.89',  location: 'New York, US',     lastActive: '2 hours ago', started: '2026-06-26 20:30', current: false },
  { id: 3,  device: 'Windows Desktop',  browser: 'Edge 124',    ip: '198.51.100.5',  location: 'Chicago, US',      lastActive: '1 day ago',  started: '2026-06-26 11:00', current: false },
  { id: 4,  device: 'Android Phone',    browser: 'Chrome 124',  ip: '192.0.2.77',    location: 'London, UK',       lastActive: '3 days ago', started: '2026-06-24 08:45', current: false },
];

const API_TOKENS = [
  { id: 1, name: 'Production Server',  token: 'mbsp_****5f3a', created: '2026-05-01', lastUsed: '2 min ago',    expires: '2027-05-01', status: 'Active',   permissions: ['read', 'send', 'templates'] },
  { id: 2, name: 'Analytics Dashboard', token: 'mbsp_****9b2c', created: '2026-06-15', lastUsed: '1 hour ago',   expires: '2026-12-31', status: 'Active',   permissions: ['read', 'analytics'] },
  { id: 3, name: 'CI/CD Pipeline',      token: 'mbsp_****2d7e', created: '2026-01-10', lastUsed: '5 days ago',   expires: '2026-01-10', status: 'Expired',  permissions: ['read', 'send'] },
  { id: 4, name: 'Dev Environment',     token: 'mbsp_****a1b9', created: '2026-06-27', lastUsed: 'Never',        expires: '2026-07-27', status: 'Active',   permissions: ['read', 'send', 'templates', 'webhooks'] },
];

const ROLES = ['Super Admin', 'Admin', 'Manager', 'Agent', 'Viewer'];
const PERMISSIONS = [
  'Read Messages', 'Send Messages', 'Manage Templates', 'Manage Contacts',
  'View Analytics', 'Manage Users', 'Manage API Keys', 'Manage Webhooks', 'View Audit Logs',
];
const ROLE_PERMISSIONS = {
  'Super Admin': [true, true, true, true, true, true, true, true, true],
  'Admin':       [true, true, true, true, true, true, true, true, true],
  'Manager':     [true, true, true, true, true, false, false, true, true],
  'Agent':       [true, true, false, true, false, false, false, false, false],
  'Viewer':      [true, false, false, false, true, false, false, false, true],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function actionIcon(action) {
  const map = {
    LOGIN: <LoginIcon fontSize="small" />,
    LOGOUT: <LogoutIcon fontSize="small" />,
    MESSAGE_SENT: <SendIcon fontSize="small" />,
    TEMPLATE_CREATED: <DescriptionIcon fontSize="small" />,
    ACCOUNT_CONNECTED: <LinkIcon fontSize="small" />,
    API_KEY_CREATED: <KeyIcon fontSize="small" />,
  };
  return map[action] || <SecurityIcon fontSize="small" />;
}

function activityIcon(icon, color) {
  const map = {
    send: <SendIcon fontSize="small" />,
    link: <LinkIcon fontSize="small" />,
    key: <KeyIcon fontSize="small" />,
    error: <CancelIcon fontSize="small" />,
    desc: <DescriptionIcon fontSize="small" />,
    login: <LoginIcon fontSize="small" />,
    logout: <LogoutIcon fontSize="small" />,
  };
  return (
    <Avatar sx={{ width: 36, height: 36, bgcolor: alpha(color, 0.15), color }}>
      {map[icon] || <SecurityIcon fontSize="small" />}
    </Avatar>
  );
}

function statusColor(status) {
  if (status === 200 || status === 201 || status === 204) return 'success';
  if (status === 401 || status === 403 || status === 404) return 'error';
  if (status === 422 || status === 429) return 'warning';
  return 'default';
}

function methodColor(method) {
  const map = { GET: 'primary', POST: 'success', DELETE: 'error', PUT: 'warning', PATCH: 'warning' };
  return map[method] || 'default';
}

function exportCSV(data, filename) {
  const keys = Object.keys(data[0]);
  const csv  = [keys.join(','), ...data.map(r => keys.map(k => `"${r[k]}"`).join(','))].join('\n');
  const blob  = new Blob([csv], { type: 'text/csv' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, action }) {
  return (
    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
      <Box>
        <Typography variant="h6" fontWeight={700}>{title}</Typography>
        {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
      </Box>
      {action}
    </Stack>
  );
}

// ─── Tab Panels ───────────────────────────────────────────────────────────────

function AuditLogsTab() {
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');
  const [actionFilter, setAction] = useState('ALL');
  const [userFilter, setUser]     = useState('');
  const [search, setSearch]       = useState('');

  const users = [...new Set(AUDIT_LOGS.map(l => l.user))];
  const actions = ['ALL', 'LOGIN', 'LOGOUT', 'MESSAGE_SENT', 'TEMPLATE_CREATED', 'ACCOUNT_CONNECTED', 'API_KEY_CREATED'];

  const filtered = AUDIT_LOGS.filter(l => {
    if (actionFilter !== 'ALL' && l.action !== actionFilter) return false;
    if (userFilter && l.user !== userFilter) return false;
    if (search && !JSON.stringify(l).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <Box>
      <SectionHeader
        title="Audit Logs"
        subtitle="Complete record of all user actions and system events"
        action={
          <Button
            startIcon={<DownloadIcon />}
            variant="outlined"
            size="small"
            onClick={() => exportCSV(filtered, 'audit_logs.csv')}
          >
            Export CSV
          </Button>
        }
      />

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" flexWrap="wrap" gap={2} alignItems="center">
          <TextField
            size="small" label="Search" value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Action</InputLabel>
            <Select value={actionFilter} label="Action" onChange={e => setAction(e.target.value)}>
              {actions.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>User</InputLabel>
            <Select value={userFilter} label="User" onChange={e => setUser(e.target.value)}>
              <MenuItem value="">All Users</MenuItem>
              {users.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="From" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField size="small" label="To"   type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   InputLabelProps={{ shrink: true }} />
          <Button startIcon={<RefreshIcon />} size="small" onClick={() => { setSearch(''); setAction('ALL'); setUser(''); setDateFrom(''); setDateTo(''); }}>
            Reset
          </Button>
        </Stack>
      </Paper>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {['Timestamp', 'User', 'Action', 'Resource', 'IP Address', 'Result', 'Details'].map(h => (
                <TableCell key={h} sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map(row => (
              <TableRow key={row.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>{row.timestamp}</TableCell>
                <TableCell>{row.user}</TableCell>
                <TableCell>
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    {actionIcon(row.action)}
                    <Typography variant="caption" fontWeight={600}>{row.action}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>{row.resource}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{row.ip}</TableCell>
                <TableCell>
                  <Chip
                    label={row.result}
                    size="small"
                    color={row.result === 'Success' ? 'success' : 'error'}
                    icon={row.result === 'Success' ? <CheckCircleIcon /> : <CancelIcon />}
                  />
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{row.details}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No logs match the current filters
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Showing {filtered.length} of {AUDIT_LOGS.length} entries
      </Typography>
    </Box>
  );
}

function ActivityLogsTab() {
  const [userFilter, setUser] = useState('');
  const users = [...new Set(ACTIVITY_LOGS.map(l => l.email))];

  const filtered = ACTIVITY_LOGS.filter(l => !userFilter || l.email === userFilter);

  return (
    <Box>
      <SectionHeader
        title="Activity Timeline"
        subtitle="Recent user activity in chronological order"
      />
      <Stack direction="row" gap={2} mb={3} flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Filter by User</InputLabel>
          <Select value={userFilter} label="Filter by User" onChange={e => setUser(e.target.value)}>
            <MenuItem value="">All Users</MenuItem>
            {users.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
          </Select>
        </FormControl>
        <Button startIcon={<RefreshIcon />} size="small" onClick={() => setUser('')}>Reset</Button>
      </Stack>

      <Stack spacing={0}>
        {filtered.map((log, i) => (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Box sx={{ display: 'flex', gap: 2, pb: 2 }}>
              {/* Timeline line */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 36 }}>
                {activityIcon(log.icon, log.color)}
                {i < filtered.length - 1 && (
                  <Box sx={{ width: 2, flex: 1, bgcolor: 'divider', mt: 0.5, minHeight: 24 }} />
                )}
              </Box>
              {/* Content */}
              <Paper variant="outlined" sx={{ p: 1.5, flex: 1, borderRadius: 2, mb: 0.5 }}>
                <Stack direction="row" justifyContent="space-between" flexWrap="wrap" gap={0.5}>
                  <Typography variant="body2" fontWeight={600}>{log.user}</Typography>
                  <Typography variant="caption" color="text.secondary">{log.timestamp}</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{log.action}</Typography>
                <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>
                  IP: {log.ip}
                </Typography>
              </Paper>
            </Box>
          </motion.div>
        ))}
      </Stack>
    </Box>
  );
}

function AccessLogsTab() {
  const [endpointFilter, setEndpoint] = useState('');
  const [statusFilter, setStatus]     = useState('ALL');

  const endpoints = [...new Set(ACCESS_LOGS.map(l => l.endpoint))];
  const statusGroups = ['ALL', '2xx Success', '4xx Client Error', '5xx Server Error'];

  const filtered = ACCESS_LOGS.filter(l => {
    if (endpointFilter && l.endpoint !== endpointFilter) return false;
    if (statusFilter === '2xx Success'     && !(l.status >= 200 && l.status < 300)) return false;
    if (statusFilter === '4xx Client Error' && !(l.status >= 400 && l.status < 500)) return false;
    if (statusFilter === '5xx Server Error' && !(l.status >= 500)) return false;
    return true;
  });

  return (
    <Box>
      <SectionHeader
        title="API Access Logs"
        subtitle="All inbound API requests to the MetaBSP platform"
        action={
          <Button startIcon={<DownloadIcon />} variant="outlined" size="small" onClick={() => exportCSV(filtered, 'access_logs.csv')}>
            Export CSV
          </Button>
        }
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" flexWrap="wrap" gap={2}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Endpoint</InputLabel>
            <Select value={endpointFilter} label="Endpoint" onChange={e => setEndpoint(e.target.value)}>
              <MenuItem value="">All Endpoints</MenuItem>
              {endpoints.map(ep => <MenuItem key={ep} value={ep} sx={{ fontFamily: 'monospace', fontSize: 13 }}>{ep}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={e => setStatus(e.target.value)}>
              {statusGroups.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          <Button startIcon={<RefreshIcon />} size="small" onClick={() => { setEndpoint(''); setStatus('ALL'); }}>Reset</Button>
        </Stack>
      </Paper>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {['Timestamp', 'Endpoint', 'Method', 'Status', 'Response Time', 'IP Address', 'User Agent'].map(h => (
                <TableCell key={h} sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map(row => (
              <TableRow key={row.id} hover>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{row.timestamp}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{row.endpoint}</TableCell>
                <TableCell>
                  <Chip label={row.method} size="small" color={methodColor(row.method)} variant="outlined" sx={{ fontWeight: 700, fontSize: 11 }} />
                </TableCell>
                <TableCell>
                  <Chip label={row.status} size="small" color={statusColor(row.status)} />
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{row.responseTime}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{row.ip}</TableCell>
                <TableCell sx={{ fontSize: 11, color: 'text.secondary', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.userAgent}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function SessionsTab() {
  const [sessions, setSessions] = useState(SESSIONS);

  const revoke = (id) => setSessions(s => s.filter(sess => sess.id !== id));
  const revokeAll = () => setSessions(s => s.filter(sess => sess.current));

  return (
    <Box>
      <SectionHeader
        title="Active Sessions"
        subtitle="Manage all devices currently signed into your account"
        action={
          <Button variant="outlined" color="error" size="small" onClick={revokeAll} disabled={sessions.length <= 1}>
            Revoke All Other Sessions
          </Button>
        }
      />

      <Stack spacing={2}>
        {sessions.map((sess) => (
          <motion.div key={sess.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 2,
                borderColor: sess.current ? 'primary.main' : 'divider',
                bgcolor: sess.current ? alpha('#1976d2', 0.04) : 'background.paper',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                <Stack direction="row" gap={2} alignItems="center">
                  <Avatar sx={{ bgcolor: sess.current ? 'primary.main' : 'action.selected', width: 44, height: 44 }}>
                    {sess.device.includes('iPhone') || sess.device.includes('Android')
                      ? <PhoneAndroidIcon />
                      : <LaptopIcon />}
                  </Avatar>
                  <Box>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Typography variant="body1" fontWeight={600}>{sess.device}</Typography>
                      {sess.current && <Chip label="Current Session" size="small" color="primary" />}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">{sess.browser}</Typography>
                    <Stack direction="row" gap={2} flexWrap="wrap" mt={0.5}>
                      <Typography variant="caption" color="text.disabled">IP: {sess.ip}</Typography>
                      <Typography variant="caption" color="text.disabled">Location: {sess.location}</Typography>
                      <Typography variant="caption" color="text.disabled">Started: {sess.started}</Typography>
                    </Stack>
                  </Box>
                </Stack>
                <Stack alignItems="flex-end" gap={1}>
                  <Typography variant="caption" color={sess.current ? 'success.main' : 'text.secondary'} fontWeight={sess.current ? 700 : 400}>
                    {sess.lastActive}
                  </Typography>
                  {!sess.current && (
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      startIcon={<DeleteOutlineIcon />}
                      onClick={() => revoke(sess.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          </motion.div>
        ))}
        {sessions.length === 1 && sessions[0].current && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            Only your current session remains.
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

function ApiTokensTab() {
  const [tokens, setTokens]         = useState(API_TOKENS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newToken, setNewToken]     = useState({ name: '', expiry: '', permissions: [] });
  const [created, setCreated]       = useState(null);
  const [copied, setCopied]         = useState(false);

  const permOptions = ['read', 'send', 'templates', 'contacts', 'analytics', 'webhooks'];

  const togglePerm = (perm) => {
    setNewToken(t => ({
      ...t,
      permissions: t.permissions.includes(perm)
        ? t.permissions.filter(p => p !== perm)
        : [...t.permissions, perm],
    }));
  };

  const createToken = () => {
    const full = `mbsp_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
    const masked = `mbsp_****${full.slice(-4)}`;
    const tok = {
      id: Date.now(),
      name: newToken.name,
      token: masked,
      created: new Date().toISOString().slice(0, 10),
      lastUsed: 'Never',
      expires: newToken.expiry || 'Never',
      status: 'Active',
      permissions: newToken.permissions,
    };
    setTokens(t => [tok, ...t]);
    setCreated(full);
    setNewToken({ name: '', expiry: '', permissions: [] });
  };

  const copyToken = () => {
    navigator.clipboard.writeText(created).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const revokeToken = (id) => setTokens(t => t.map(tok => tok.id === id ? { ...tok, status: 'Revoked' } : tok));

  return (
    <Box>
      <SectionHeader
        title="API Tokens"
        subtitle="Manage long-lived API tokens for programmatic access"
        action={
          <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => setDialogOpen(true)}>
            Create Token
          </Button>
        }
      />

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {['Name', 'Token', 'Permissions', 'Created', 'Last Used', 'Expires', 'Status', 'Actions'].map(h => (
                <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {tokens.map(tok => (
              <TableRow key={tok.id} hover sx={{ opacity: tok.status === 'Revoked' ? 0.5 : 1 }}>
                <TableCell fontWeight={600}><Typography variant="body2" fontWeight={600}>{tok.name}</Typography></TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>{tok.token}</TableCell>
                <TableCell>
                  <Stack direction="row" flexWrap="wrap" gap={0.5}>
                    {tok.permissions.map(p => <Chip key={p} label={p} size="small" variant="outlined" sx={{ fontSize: 10 }} />)}
                  </Stack>
                </TableCell>
                <TableCell sx={{ fontSize: 12 }}>{tok.created}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>{tok.lastUsed}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>{tok.expires}</TableCell>
                <TableCell>
                  <Chip
                    label={tok.status}
                    size="small"
                    color={tok.status === 'Active' ? 'success' : tok.status === 'Expired' ? 'warning' : 'default'}
                  />
                </TableCell>
                <TableCell>
                  <Tooltip title="Revoke token">
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        disabled={tok.status !== 'Active'}
                        onClick={() => revokeToken(tok.id)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Token Dialog */}
      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setCreated(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>Create New API Token</DialogTitle>
        <DialogContent dividers>
          {created ? (
            <Box>
              <Typography variant="body2" color="success.main" fontWeight={600} mb={1}>
                Token created successfully! Copy it now — it will not be shown again.
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: '#1e1e2e', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontFamily: 'monospace', fontSize: 13, color: '#a6e3a1', flex: 1, wordBreak: 'break-all' }}>
                  {created}
                </Typography>
                <Tooltip title={copied ? 'Copied!' : 'Copy'}>
                  <IconButton size="small" onClick={copyToken} sx={{ color: '#cdd6f4' }}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Paper>
            </Box>
          ) : (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                label="Token Name"
                fullWidth
                size="small"
                value={newToken.name}
                onChange={e => setNewToken(t => ({ ...t, name: e.target.value }))}
                placeholder="e.g. Production Server"
              />
              <TextField
                label="Expiry Date"
                type="date"
                fullWidth
                size="small"
                value={newToken.expiry}
                onChange={e => setNewToken(t => ({ ...t, expiry: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                helperText="Leave blank for no expiry"
              />
              <Box>
                <Typography variant="body2" fontWeight={600} mb={1}>Permissions</Typography>
                <FormGroup row>
                  {permOptions.map(p => (
                    <FormControlLabel
                      key={p}
                      control={
                        <Checkbox
                          size="small"
                          checked={newToken.permissions.includes(p)}
                          onChange={() => togglePerm(p)}
                        />
                      }
                      label={<Typography variant="body2" sx={{ textTransform: 'capitalize' }}>{p}</Typography>}
                    />
                  ))}
                </FormGroup>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDialogOpen(false); setCreated(null); }}>
            {created ? 'Close' : 'Cancel'}
          </Button>
          {!created && (
            <Button
              variant="contained"
              onClick={createToken}
              disabled={!newToken.name.trim()}
            >
              Create Token
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function RolePermissionsTab() {
  return (
    <Box>
      <SectionHeader
        title="Role Permissions Matrix"
        subtitle="Overview of permissions granted to each role in the platform"
      />

      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 700 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, minWidth: 140 }}>Role</TableCell>
              {PERMISSIONS.map(p => (
                <TableCell key={p} align="center" sx={{ fontWeight: 600, fontSize: 12, minWidth: 90 }}>
                  {p}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {ROLES.map((role, ri) => (
              <TableRow key={role} hover sx={{ bgcolor: role === 'Super Admin' ? alpha('#1976d2', 0.05) : 'inherit' }}>
                <TableCell>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: role === 'Super Admin' ? 'primary.main' : 'action.selected' }}>
                      {role === 'Super Admin' ? <SupervisorAccountIcon fontSize="small" /> : <PersonIcon fontSize="small" />}
                    </Avatar>
                    <Typography variant="body2" fontWeight={role === 'Super Admin' ? 700 : 400}>{role}</Typography>
                  </Stack>
                </TableCell>
                {ROLE_PERMISSIONS[role].map((has, pi) => (
                  <TableCell key={pi} align="center">
                    {has
                      ? <CheckCircleIcon fontSize="small" sx={{ color: 'success.main' }} />
                      : <CancelIcon     fontSize="small" sx={{ color: 'action.disabled' }} />}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      <Paper variant="outlined" sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: alpha('#FF9800', 0.05), borderColor: alpha('#FF9800', 0.3) }}>
        <Typography variant="body2" color="text.secondary">
          <strong>Note:</strong> Role permissions can only be modified by a Super Admin. Contact your administrator to request changes.
        </Typography>
      </Paper>
    </Box>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS = [
  { label: 'Audit Logs',         icon: <SecurityIcon />,        component: AuditLogsTab },
  { label: 'Activity',           icon: <TimelineIcon />,        component: ActivityLogsTab },
  { label: 'Access Logs',        icon: <ApiIcon />,             component: AccessLogsTab },
  { label: 'Sessions',           icon: <DevicesIcon />,         component: SessionsTab },
  { label: 'API Tokens',         icon: <KeyIcon />,             component: ApiTokensTab },
  { label: 'Role Permissions',   icon: <SupervisorAccountIcon />, component: RolePermissionsTab },
];

export default function SecurityDashboardPage() {
  const [tab, setTab]   = useState(0);
  const theme           = useTheme();
  const isMobile        = useMediaQuery(theme.breakpoints.down('sm'));

  const ActiveTab = TABS[tab].component;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Page Header */}
      <Stack direction="row" alignItems="center" gap={2} mb={3}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
          <SecurityIcon />
        </Avatar>
        <Box>
          <Typography variant="h5" fontWeight={700}>Security &amp; Compliance</Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor activity, manage access, and review security events
          </Typography>
        </Box>
      </Stack>

      {/* Tabs */}
      <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant={isMobile ? 'scrollable' : 'scrollable'}
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}
        >
          {TABS.map((t, i) => (
            <Tab
              key={t.label}
              label={isMobile ? undefined : t.label}
              icon={t.icon}
              iconPosition={isMobile ? 'top' : 'start'}
              sx={{ minHeight: 56, fontSize: 13, fontWeight: 600 }}
            />
          ))}
        </Tabs>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              <ActiveTab />
            </Box>
          </motion.div>
        </AnimatePresence>
      </Paper>
    </Box>
  );
}
