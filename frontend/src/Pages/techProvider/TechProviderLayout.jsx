import { useState } from 'react';
import {
  Avatar, Box, Divider, Drawer, IconButton, List, ListItemButton,
  ListItemIcon, ListItemText, Stack, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import WebhookRoundedIcon from '@mui/icons-material/WebhookRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import InventoryRoundedIcon from '@mui/icons-material/InventoryRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../constants/routes';

const NAV_ITEMS = [
  { label: 'Overview', href: '/tech-provider', icon: <HomeRoundedIcon fontSize="small" /> },
  { label: 'My WABAs', href: '/tech-provider/wabas', icon: <BusinessRoundedIcon fontSize="small" /> },
  { label: 'Embedded Signup', href: '/tech-provider/embedded-signup', icon: <AccountTreeRoundedIcon fontSize="small" /> },
  { label: 'Webhook Viewer', href: '/tech-provider/webhooks', icon: <WebhookRoundedIcon fontSize="small" /> },
  { label: 'Paid Messaging', href: '/tech-provider/paid-messaging', icon: <SendRoundedIcon fontSize="small" /> },
  { label: 'Business Assets', href: '/tech-provider/assets', icon: <InventoryRoundedIcon fontSize="small" /> },
];

const SIDEBAR_WIDTH = 220;

function Sidebar({ onClose }) {
  const location = useLocation();

  return (
    <Box sx={{ width: SIDEBAR_WIDTH, height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#111b21', color: '#cfd4d8' }}>
      <Box sx={{ px: 2, py: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ChatBubbleOutlineRoundedIcon sx={{ color: '#fff', fontSize: 18 }} />
          </Box>
          <Box>
            <Typography fontWeight={700} fontSize={14} color="#fff">Metabsp</Typography>
            <Typography fontSize={11} color="rgba(255,255,255,0.4)">Tech Provider</Typography>
          </Box>
        </Stack>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      <List dense sx={{ px: 1, py: 1, flexGrow: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.href;
          return (
            <ListItemButton
              key={item.href}
              component={Link}
              to={item.href}
              onClick={onClose}
              selected={active}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                color: active ? '#25d366' : '#cfd4d8',
                '&.Mui-selected': { bgcolor: '#202c33', color: '#25d366' },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
              }}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 13 }} />
            </ListItemButton>
          );
        })}
      </List>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      <Box sx={{ px: 1, py: 1.5 }}>
        <ListItemButton
          component={Link}
          to={ROUTES.WHATSAPP}
          sx={{ borderRadius: 2, color: '#cfd4d8', '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } }}
        >
          <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}>
            <ArrowBackRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Back to WhatsApp" primaryTypographyProps={{ fontSize: 13 }} />
        </ListItemButton>
        <Box sx={{ px: 1, pt: 0.5 }}>
          <Typography
            component={Link}
            to="/privacy-policy"
            sx={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textDecoration: 'none', '&:hover': { color: '#25d366' } }}
          >
            Privacy Policy
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default function TechProviderLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default' }}>
      {isMobile ? (
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} PaperProps={{ sx: { width: SIDEBAR_WIDTH } }}>
          <Sidebar onClose={() => setDrawerOpen(false)} />
        </Drawer>
      ) : (
        <Box sx={{ width: SIDEBAR_WIDTH, flexShrink: 0 }}>
          <Box sx={{ width: SIDEBAR_WIDTH, height: '100vh', position: 'sticky', top: 0, overflow: 'auto' }}>
            <Sidebar onClose={() => {}} />
          </Box>
        </Box>
      )}

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        {isMobile && (
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
            <IconButton size="small" onClick={() => setDrawerOpen(true)} sx={{ mr: 1 }}>
              <MenuRoundedIcon />
            </IconButton>
            <Typography fontWeight={700} fontSize={16}>Tech Provider</Typography>
          </Box>
        )}
        <Box sx={{ overflowY: 'auto', minHeight: '100vh' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
