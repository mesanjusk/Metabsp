import { useMemo, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar, Avatar, Badge, Box, Chip, Divider, Drawer,
  IconButton, List, ListItemButton, ListItemIcon, ListItemText,
  Menu, MenuItem, Stack, Toolbar, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MenuIcon               from '@mui/icons-material/Menu';
import DashboardIcon          from '@mui/icons-material/Dashboard';
import CategoryIcon           from '@mui/icons-material/Category';
import NotificationsIcon      from '@mui/icons-material/Notifications';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ChatIcon               from '@mui/icons-material/Chat';
import LogoutIcon             from '@mui/icons-material/Logout';
import MoreVertIcon           from '@mui/icons-material/MoreVert';
import TuneIcon               from '@mui/icons-material/Tune';
import SendIcon               from '@mui/icons-material/Send';
import AltRouteIcon           from '@mui/icons-material/AltRoute';
// Use BulkAuthContext for event-management app shell
import { useAuth }        from '../context/BulkAuthContext';
import { useLive }        from '../context/LiveContext';
import useOnlineStatus    from '../hooks/useOnlineStatus';
import OnlineStatusBanner from './pwa/OnlineStatusBanner';
import PwaInstallPrompt   from './pwa/PwaInstallPrompt';
import { APP_ROUTES, canAccess, isSuperAdmin } from '../utils/accessControl';

const DRAWER_WIDTH = 272;

const NAV_ICONS = {
  '/dashboard':            <DashboardIcon />,
  '/whatsapp-bulk':        <ChatIcon />,
  '/notifications':        <NotificationsIcon />,
  '/users':                <AdminPanelSettingsIcon />,
  '/roles':                <CategoryIcon />,
  '/admin':                <AdminPanelSettingsIcon />,
  '/admin/routing':        <AltRouteIcon />,
  '/super-admin/settings': <TuneIcon />,
};

export default function AppShell({ children }) {
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [menuAnchor, setMenuAnchor]   = useState(null);
  const theme    = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { pathname }          = useLocation();
  const { user, logout }      = useAuth();
  const { connected, events } = useLive();
  const isOnline  = useOnlineStatus();
  const navItems  = useMemo(() => APP_ROUTES.filter((r) => canAccess(user, r.permission)), [user]);
  const superAdmin = useMemo(() => isSuperAdmin(user), [user]);

  const isLiveMode = ['/notifications', '/whatsapp'].some((p) => pathname.startsWith(p));

  const drawerContent = (
    <Box sx={{ width: DRAWER_WIDTH, display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#fff' }}>
      {/* Brand header */}
      <Box sx={{
        px: 2.5, py: 2,
        background: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 60%, #3B82F6 100%)',
        color: '#fff',
      }}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.18)', display: 'grid', placeItems: 'center' }}>
            <SendIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={800} lineHeight={1.2}>Instify</Typography>
            <Typography variant="caption" sx={{ opacity: 0.85, lineHeight: 1 }}>WhatsApp Automation</Typography>
          </Box>
        </Stack>
      </Box>

      <Divider />

      {/* Nav items */}
      <List sx={{ px: 1.5, py: 1.5, flexGrow: 1 }}>
        {navItems.map((item) => {
          const selected = pathname === item.to || (item.to !== '/' && pathname.startsWith(item.to));
          return (
            <ListItemButton
              key={item.to}
              component={RouterLink}
              to={item.to}
              selected={selected}
              onClick={() => setDrawerOpen(false)}
              sx={{ borderRadius: 3, mb: 0.5, px: 1.75, py: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 38, color: selected ? 'primary.main' : 'text.secondary' }}>
                {NAV_ICONS[item.to]}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontWeight: selected ? 700 : 500, fontSize: 14 }}
              />
              {item.to === '/notifications' && events.length > 0 && (
                <Badge badgeContent={events.length} color="error" />
              )}
            </ListItemButton>
          );
        })}
      </List>

      <Divider />

      {/* User footer */}
      <Box sx={{ p: 1.5 }}>
        <Box sx={{ px: 1.5, py: 1.25, borderRadius: 3, bgcolor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Avatar sx={{ width: 38, height: 38, bgcolor: 'primary.main', fontSize: 15, fontWeight: 700 }}>
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography fontWeight={700} variant="body2" noWrap>{user?.name || 'User'}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap>{user?.roleId?.name || 'Role'}</Typography>
            </Box>
            <Tooltip title="Logout">
              <IconButton size="small" onClick={logout}><LogoutIcon fontSize="small" /></IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Top bar */}
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(12px)',
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml:    { md: `${DRAWER_WIDTH}px` },
        }}
      >
        <Toolbar sx={{ gap: 1, minHeight: { xs: 60, sm: 66 } }}>
          {isMobile && (
            <IconButton onClick={() => setDrawerOpen(true)} edge="start">
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {user?.roleId?.name || 'Dashboard'}
            </Typography>
            <Typography variant="subtitle2" fontWeight={700} noWrap>{user?.name || 'User'}</Typography>
          </Box>

          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Chip
              size="small"
              label={connected && isOnline ? 'Live' : 'Offline'}
              color={connected && isOnline ? 'success' : 'warning'}
              variant="outlined"
              sx={{ fontSize: 11, height: 22 }}
            />
            <Tooltip title="Notifications">
              <IconButton component={RouterLink} to="/notifications" size="small">
                <Badge badgeContent={events.length} color="error">
                  <NotificationsIcon fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
            {canAccess(user, 'whatsapp:send')    && <MenuItem component={RouterLink} to="/whatsapp-bulk"        onClick={() => setMenuAnchor(null)}>WhatsApp</MenuItem>}
            {canAccess(user, 'users:manage')     && <MenuItem component={RouterLink} to="/admin"                onClick={() => setMenuAnchor(null)}>Admin</MenuItem>}
            {superAdmin                          && <MenuItem component={RouterLink} to="/super-admin/settings" onClick={() => setMenuAnchor(null)}>System Settings</MenuItem>}
            <Divider />
            <MenuItem onClick={() => { setMenuAnchor(null); logout(); }} sx={{ color: 'error.main' }}>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      {isMobile ? (
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} PaperProps={{ sx: { width: DRAWER_WIDTH } }}>
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          open
          PaperProps={{ sx: { width: DRAWER_WIDTH, boxSizing: 'border-box', border: 'none', borderRight: '1px solid #E2E8F0' } }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p:   { xs: 1.5, sm: 2, md: 2.5 },
          pt:  { xs: 9, sm: 10, md: 10.5 },
          ml:  { md: `${DRAWER_WIDTH}px` },
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          maxWidth: '100vw',
          overflowX: 'hidden',
        }}
      >
        <Stack spacing={1} sx={{ mb: 2 }}>
          <PwaInstallPrompt />
          <OnlineStatusBanner isOnline={isOnline} isLiveMode={isLiveMode} />
        </Stack>
        {children}
      </Box>
    </Box>
  );
}
