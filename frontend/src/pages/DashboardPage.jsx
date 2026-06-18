import { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Card, CardContent, Grid, List, ListItem,
  ListItemText, Stack, Typography,
} from '@mui/material';
import PeopleIcon        from '@mui/icons-material/People';
import ChatIcon          from '@mui/icons-material/Chat';
import CampaignIcon      from '@mui/icons-material/Campaign';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SendIcon          from '@mui/icons-material/Send';
import QrCode2Icon       from '@mui/icons-material/QrCode2';
import api               from '../api';
import { useAuth }       from '../context/BulkAuthContext';
import { useLive }       from '../context/LiveContext';
import PageHeader        from '../components/PageHeader';
import PageSurface       from '../components/PageSurface';
import StatCard          from '../components/StatCard';

export default function DashboardPage() {
  const { user }              = useAuth();
  const { events, connected } = useLive();
  const [summary, setSummary] = useState({});

  useEffect(() => {
    api.get('/dashboard/summary').then((r) => setSummary(r.data)).catch(() => {});
  }, []);

  const cards = useMemo(() => [
    ['Users',        summary.users           || 0, 'Active accounts',     <PeopleIcon />],
    ['WA Messages',  summary.whatsappMessages || 0, connected ? 'Live' : 'Syncing', <ChatIcon />],
    ['Campaigns',    summary.campaigns        || 0, 'Total saved',        <CampaignIcon />],
    ['Notifications',summary.notifications   || 0, 'Unread',             <NotificationsIcon />],
  ], [summary, connected]);

  return (
    <Box sx={{ pb: 4 }}>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        subtitle="WhatsApp automation — send bulk messages, manage campaigns, and monitor conversations."
        chips={[
          { label: user?.roleId?.name || 'User' },
          { label: connected ? 'Connected' : 'Connecting...', color: connected ? 'success' : 'warning' },
        ]}
      />

      <PageSurface sx={{ mb: 2.5 }}>
        <Grid container spacing={2}>
          {cards.map(([title, value, subtitle]) => (
            <Grid key={title} size={{ xs: 6, sm: 3 }}>
              <StatCard title={title} value={value} subtitle={subtitle} />
            </Grid>
          ))}
        </Grid>
      </PageSurface>

      <PageSurface sx={{ mb: 2.5 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Quick Actions</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
              <Button
                variant="contained"
                startIcon={<SendIcon />}
                href="/whatsapp-bulk"
                sx={{ bgcolor: '#25D366' }}
              >
                Open WhatsApp
              </Button>
              <Button
                variant="outlined"
                startIcon={<QrCode2Icon />}
                href="/whatsapp-bulk"
              >
                Setup Baileys / QR
              </Button>
              <Button
                variant="outlined"
                startIcon={<PeopleIcon />}
                href="/admin"
              >
                Manage Users
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </PageSurface>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <PageSurface>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>Live Activity</Typography>
                <List sx={{ py: 0 }}>
                  {events.length ? events.slice(0, 8).map((ev, idx) => (
                    <ListItem key={idx} divider sx={{ px: 0 }}>
                      <ListItemText
                        primary={ev.name.replace(/_/g, ' ')}
                        primaryTypographyProps={{ fontWeight: 600, variant: 'body2' }}
                        secondary={JSON.stringify(ev.payload).slice(0, 90) + '…'}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  )) : (
                    <Typography color="text.secondary" variant="body2">
                      No live events yet — WhatsApp messages will appear here in real time.
                    </Typography>
                  )}
                </List>
              </CardContent>
            </Card>
          </PageSurface>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <PageSurface>
            <Card>
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="h6" fontWeight={700}>Getting Started</Typography>
                  <Typography variant="body2" color="text.secondary">
                    1. Go to <strong>Admin</strong> to create users and assign roles.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    2. Open <strong>WhatsApp → Setup / QR</strong> and scan the QR code to connect Baileys.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    3. Use <strong>WhatsApp → Invitation</strong> to send bulk messages with personalised images.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    4. Use <strong>Manual (wa.me)</strong> when the API is unavailable — generate direct links instead.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    5. Monitor replies and manage conversations in the <strong>Inbox</strong>.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </PageSurface>
        </Grid>
      </Grid>
    </Box>
  );
}
