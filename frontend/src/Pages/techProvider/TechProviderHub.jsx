import { Box, Button, Card, CardContent, Grid, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import WebhookRoundedIcon from '@mui/icons-material/WebhookRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import InventoryRoundedIcon from '@mui/icons-material/InventoryRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';

const CARDS = [
  {
    icon: <BusinessRoundedIcon sx={{ fontSize: 36, color: '#25d366' }} />,
    title: 'My WABAs',
    desc: 'View and manage WhatsApp Business Accounts and phone numbers connected to your Meta app.',
    href: '/tech-provider/wabas',
    label: 'Open WABAs',
  },
  {
    icon: <AccountTreeRoundedIcon sx={{ fontSize: 36, color: '#25d366' }} />,
    title: 'Embedded Signup',
    desc: 'Build and launch the Embedded Signup flow to onboard businesses onto WhatsApp Business Platform.',
    href: '/tech-provider/embedded-signup',
    label: 'Open Builder',
  },
  {
    icon: <WebhookRoundedIcon sx={{ fontSize: 36, color: '#25d366' }} />,
    title: 'Webhook Viewer',
    desc: 'Inspect incoming webhook payloads from Meta in real time. Great for debugging your integration.',
    href: '/tech-provider/webhooks',
    label: 'Open Viewer',
  },
  {
    icon: <SendRoundedIcon sx={{ fontSize: 36, color: '#25d366' }} />,
    title: 'Paid / Template Messaging',
    desc: 'Send pre-approved message templates to your customers for marketing, utility, or authentication.',
    href: '/tech-provider/paid-messaging',
    label: 'Open Messaging',
  },
  {
    icon: <InventoryRoundedIcon sx={{ fontSize: 36, color: '#25d366' }} />,
    title: 'Business Assets',
    desc: 'Browse Pages, Ad Accounts, Catalogs, Datasets, and Instagram accounts linked to your business.',
    href: '/tech-provider/assets',
    label: 'View Assets',
  },
];

export default function TechProviderHub() {
  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        Tech Provider Dashboard
      </Typography>
      <Typography color="text.secondary" mb={4} fontSize={14}>
        Manage your WhatsApp Business Platform integration via the Meta Graph API.
      </Typography>

      <Grid container spacing={3}>
        {CARDS.map((c) => (
          <Grid item xs={12} sm={6} md={4} key={c.title}>
            <Card
              sx={{
                height: '100%',
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                transition: 'box-shadow 0.2s',
                '&:hover': { boxShadow: '0 4px 24px rgba(37,211,102,0.15)' },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Stack spacing={2} height="100%">
                  {c.icon}
                  <Box flexGrow={1}>
                    <Typography fontWeight={700} mb={0.75}>
                      {c.title}
                    </Typography>
                    <Typography color="text.secondary" fontSize={13} lineHeight={1.6}>
                      {c.desc}
                    </Typography>
                  </Box>
                  <Button
                    component={Link}
                    to={c.href}
                    variant="outlined"
                    size="small"
                    endIcon={<ArrowForwardRoundedIcon />}
                    sx={{ alignSelf: 'flex-start', borderColor: '#25d366', color: '#25d366', '&:hover': { bgcolor: 'rgba(37,211,102,0.06)' } }}
                  >
                    {c.label}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
