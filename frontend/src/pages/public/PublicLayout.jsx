import React, { useState } from 'react';
import { Outlet, Link as RouterLink, useLocation } from 'react-router-dom';
import {
  AppBar, Toolbar, Box, Button, Typography, Container, Divider,
  IconButton, Drawer, List, ListItem, ListItemButton, ListItemText,
  useTheme, useMediaQuery, Stack
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { motion, AnimatePresence } from 'framer-motion';

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/about' },
  { label: 'Docs', to: '/developer-docs' },
  { label: 'Status', to: '/status' },
  { label: 'Contact', to: '/contact' },
];

const FOOTER_LINKS = [
  { label: 'Privacy Policy', to: '/privacy-policy' },
  { label: 'Terms of Service', to: '/terms-of-service' },
  { label: 'Cookie Policy', to: '/cookie-policy' },
  { label: 'Data Deletion', to: '/data-deletion' },
  { label: 'Security', to: '/security-info' },
  { label: 'Help Center', to: '/help-center' },
];

export default function PublicLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  const isDark = theme.palette.mode === 'dark';
  const navBg = isDark ? '#111b21' : '#ffffff';
  const navBorder = isDark ? '#2a3942' : '#e0e0e0';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: navBg,
          borderBottom: `1px solid ${navBorder}`,
          color: 'text.primary',
        }}
      >
        <Toolbar sx={{ maxWidth: 1200, width: '100%', mx: 'auto', px: { xs: 2, md: 4 } }}>
          <RouterLink to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <WhatsAppIcon sx={{ color: 'primary.main', fontSize: 28 }} />
            <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 800, letterSpacing: '-0.5px' }}>
              MetaBSP
            </Typography>
          </RouterLink>

          <Box sx={{ flexGrow: 1 }} />

          {!isMobile && (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mr: 2 }}>
              {NAV_LINKS.map((link) => (
                <Button
                  key={link.to}
                  component={RouterLink}
                  to={link.to}
                  sx={{
                    color: location.pathname === link.to ? 'primary.main' : 'text.secondary',
                    fontWeight: location.pathname === link.to ? 700 : 500,
                    '&:hover': { color: 'primary.main', bgcolor: 'transparent' },
                  }}
                >
                  {link.label}
                </Button>
              ))}
            </Stack>
          )}

          {!isMobile && (
            <Stack direction="row" spacing={1}>
              <Button component={RouterLink} to="/login" variant="outlined" color="primary" size="small">
                Login
              </Button>
              <Button component={RouterLink} to="/signup" variant="contained" color="primary" size="small">
                Sign Up
              </Button>
            </Stack>
          )}

          {isMobile && (
            <IconButton onClick={() => setDrawerOpen(true)} sx={{ color: 'text.primary' }}>
              <MenuIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 260, pt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, pb: 2 }}>
            <Typography variant="h6" fontWeight={800}>MetaBSP</Typography>
            <IconButton onClick={() => setDrawerOpen(false)}><CloseIcon /></IconButton>
          </Box>
          <Divider />
          <List>
            {NAV_LINKS.map((link) => (
              <ListItem key={link.to} disablePadding>
                <ListItemButton component={RouterLink} to={link.to} onClick={() => setDrawerOpen(false)}>
                  <ListItemText primary={link.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Divider />
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button component={RouterLink} to="/login" variant="outlined" color="primary" fullWidth onClick={() => setDrawerOpen(false)}>
              Login
            </Button>
            <Button component={RouterLink} to="/signup" variant="contained" color="primary" fullWidth onClick={() => setDrawerOpen(false)}>
              Sign Up
            </Button>
          </Box>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </Box>

      <Box
        component="footer"
        sx={{
          bgcolor: isDark ? '#111b21' : '#f8f9fa',
          borderTop: `1px solid ${navBorder}`,
          mt: 'auto',
          py: 6,
        }}
      >
        <Container maxWidth="lg">
          <Box className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <WhatsAppIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" fontWeight={800}>MetaBSP</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 240 }}>
                A Meta-authorized WhatsApp Business Solution Provider helping businesses communicate at scale.
              </Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Platform</Typography>
              <Stack spacing={0.5}>
                {NAV_LINKS.map((link) => (
                  <RouterLink key={link.to} to={link.to} style={{ textDecoration: 'none' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ '&:hover': { color: 'primary.main' } }}>
                      {link.label}
                    </Typography>
                  </RouterLink>
                ))}
              </Stack>
            </Box>
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Legal</Typography>
              <Stack spacing={0.5}>
                {FOOTER_LINKS.map((link) => (
                  <RouterLink key={link.to} to={link.to} style={{ textDecoration: 'none' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ '&:hover': { color: 'primary.main' } }}>
                      {link.label}
                    </Typography>
                  </RouterLink>
                ))}
              </Stack>
            </Box>
          </Box>
          <Divider sx={{ mb: 3 }} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              © {new Date().getFullYear()} MetaBSP. All rights reserved.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              support@metabsp.com
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
