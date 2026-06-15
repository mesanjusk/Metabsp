import { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Card, CardContent, Grid, List, ListItem,
  ListItemText, Stack, Typography,
} from '@mui/material';
import PeopleIcon       from '@mui/icons-material/People';
import ChatIcon         from '@mui/icons-material/Chat';
import CategoryIcon     from '@mui/icons-material/Category';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SendIcon         from '@mui/icons-material/Send';
import OpenInNewIcon    from '@mui/icons-material/OpenInNew';
import api              from '../api';
import { useAuth }      from '../context/AuthContext';
import { useLive }      from '../context/LiveContext';
import PageHeader       from '../components/PageHeader';
import PageSurface      from '../components/PageSurface';
import StatCard         from '../components/StatCard';

export default function DashboardPage() {
  const { user }              = useAuth();
  const { events, connected } = useLive();
  const [summary, setSummary] = useState({});

  useEffect(() => {
    api.get('/dashboard/summary').then((r) => setSummary(r.data)).catch(() => {});
  }, []);

  const cards = useMemo(() => [
    ['Users',         summary.users            || 0, 'Active accounts',         <PeopleIcon />],
    ['WhatsApp Msgs', summary.whatsappMessages  || 0, connected ? 'Live' : 'Syncing', <ChatIcon />],
    ['Events',        summary.events            || 0, 'Configured events',       <CategoryIcon />],
    ['Notifications', summary.notifications     || 0, 'Unread',                  <NotificationsIcon />],
  ], [summary, connected]);

  return (
    <Box sx={{ pb: 4 }}>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        subtitle="Manage your bulk invite campaigns and WhatsApp communications."
        chips={[
          { label: user?.roleId?.name || 'User' },
          { label: connected ? 'Connected' : 'Connecting...', color: connected ? 'success' : 'warning' },
        ]}
      />

      {/* Stat cards */}
      <PageSurface sx={{ mb: 2.5 }}>
        <Grid container spacing={2}>
          {cards.map(([title, value, subtitle]) => (
            <Grid key={title} size={{ xs: 6, sm: 3 }}>
              <StatCard title={title} value={value} subtitle={subtitle} />
            </Grid>
          ))}
        </Grid>
      </PageSurface>

      {/* Quick actions */}
      <PageSurface sx={{ mb: 2.5 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Quick Actions</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
              <Button
                variant="contained"
                startIcon={<SendIcon />}
                href="/whatsapp"
                sx={{ bgcolor: '#2563EB' }}
              >
                Send Bulk Invites
              </Button>
              <Button
                variant="outlined"
                startIcon={<PeopleIcon />}
                href="/admin"
              >
                Manage Users
              </Button>
              <Button
                variant="outlined"
                startIcon={<OpenInNewIcon />}
                href="/public-invite"
                target="_blank"
                rel="noopener noreferrer"
              >
                Public Invite Link
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </PageSurface>

      {/* Live activity */}
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
                      No live events yet — they will appear here in real time.
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
                    2. Connect your WhatsApp via <strong>System Settings → Baileys</strong> by scanning the QR code.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    3. Use <strong>WhatsApp</strong> to compose and send bulk invitations to your contact list.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    4. Monitor replies and manage conversations in the WhatsApp inbox.
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
