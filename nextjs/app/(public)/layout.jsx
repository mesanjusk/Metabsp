'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import BrandMark from '@/lib/ui/app/BrandMark';

const NAV_LINKS = [
  { label: 'Product', to: '/' },
  { label: 'Apps', to: '/#services' },
  { label: 'Pricing', to: '/#pricing' },
  { label: 'FAQ', to: '/#faq' },
  { label: 'About', to: '/about' },
  { label: 'Developers', to: '/developer-docs' },
];

const FOOTER_SECTIONS = [
  {
    title: 'Platform',
    links: [
      { label: 'Product', to: '/' },
      { label: 'All apps', to: '/#services' },
      { label: 'Pricing', to: '/#pricing' },
      { label: 'Help Center', to: '/help-center' },
      { label: 'Status', to: '/status' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Contact', to: '/contact' },
      { label: 'Security', to: '/security-info' },
      { label: 'Developers', to: '/developer-docs' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', to: '/privacy-policy' },
      { label: 'Terms of Service', to: '/terms-of-service' },
      { label: 'Cookie Policy', to: '/cookie-policy' },
      { label: 'Data Deletion', to: '/data-deletion' },
    ],
  },
];

export default function PublicLayout({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#fff' }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'rgba(255,255,255,0.96)',
          color: '#24212a',
          borderBottom: '1px solid #ece9ef',
          backdropFilter: 'blur(14px)',
        }}
      >
        <Toolbar
          disableGutters
          sx={{
            width: '100%',
            maxWidth: 1240,
            mx: 'auto',
            minHeight: { xs: 64, md: 72 },
            px: { xs: 2, sm: 3, md: 4 },
            gap: 2,
          }}
        >
          <Box
            component={NextLink}
            href="/"
            aria-label="SanjuSK home"
            sx={{ textDecoration: 'none', color: '#714B67', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
          >
            <BrandMark size={31} />
          </Box>

          <Stack
            direction="row"
            spacing={0.25}
            alignItems="center"
            sx={{ ml: { md: 3 }, display: { xs: 'none', md: 'flex' } }}
          >
            {NAV_LINKS.map((link) => {
              const selected = link.to === '/' ? pathname === '/' : pathname === link.to;
              return (
                <Button
                  key={link.to}
                  component={NextLink}
                  href={link.to}
                  sx={{
                    px: 1.35,
                    color: selected ? '#714B67' : '#514b55',
                    fontWeight: selected ? 750 : 600,
                    '&:hover': { bgcolor: '#f6f1f5', color: '#714B67' },
                  }}
                >
                  {link.label}
                </Button>
              );
            })}
          </Stack>

          <Box sx={{ flex: 1 }} />

          <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', md: 'flex' } }}>
            <Button component={NextLink} href="/login" sx={{ color: '#514b55', fontWeight: 700 }}>
              Sign in
            </Button>
            <Button
              component={NextLink}
              href="/signup"
              variant="contained"
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{
                bgcolor: '#714B67',
                px: 2.25,
                '&:hover': { bgcolor: '#5d3e55' },
              }}
            >
              Start free
            </Button>
          </Stack>

          <IconButton
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            sx={{ display: { xs: 'inline-flex', md: 'none' }, color: '#342f36' }}
          >
            <MenuRoundedIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 'min(88vw, 360px)',
            bgcolor: '#fff',
            borderLeft: '1px solid #ece9ef',
          },
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.25, py: 1.5 }}>
          <Box sx={{ color: '#714B67' }}>
            <BrandMark size={28} />
          </Box>
          <IconButton onClick={() => setDrawerOpen(false)} aria-label="Close menu">
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
        <Divider />
        <List sx={{ px: 1.25, py: 1.5 }}>
          {NAV_LINKS.map((link) => (
            <ListItemButton
              key={link.to}
              component={NextLink}
              href={link.to}
              onClick={() => setDrawerOpen(false)}
              sx={{ borderRadius: 2.5, mb: 0.5, py: 1.1 }}
            >
              <ListItemText
                primary={link.label}
                primaryTypographyProps={{ fontWeight: 700, color: '#342f36' }}
              />
            </ListItemButton>
          ))}
        </List>
        <Box sx={{ flex: 1 }} />
        <Stack spacing={1} sx={{ p: 2 }}>
          <Button component={NextLink} href="/login" variant="outlined" fullWidth onClick={() => setDrawerOpen(false)}>
            Sign in
          </Button>
          <Button
            component={NextLink}
            href="/signup"
            variant="contained"
            fullWidth
            onClick={() => setDrawerOpen(false)}
            sx={{ bgcolor: '#714B67', '&:hover': { bgcolor: '#5d3e55' } }}
          >
            Start free
          </Button>
        </Stack>
      </Drawer>

      <Box component="main" sx={{ flex: 1, bgcolor: '#fff' }}>
        {children}
      </Box>

      <Box component="footer" sx={{ mt: 'auto', bgcolor: '#282630', color: '#f7f4f7', pt: { xs: 7, md: 9 }, pb: 4 }}>
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', md: '1.6fr repeat(3, 1fr)' },
              gap: { xs: 4, md: 5 },
            }}
          >
            <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
              <Box sx={{ color: '#fff', mb: 2 }}>
                <BrandMark size={34} />
              </Box>
              <Typography sx={{ color: 'rgba(255,255,255,0.68)', maxWidth: 390, lineHeight: 1.75 }}>
                One business workspace for customer communication, sales, local presence, operations, staff and automation.
              </Typography>
              <Button
                component={NextLink}
                href="/signup"
                variant="contained"
                sx={{ mt: 3, bgcolor: '#875A7B', '&:hover': { bgcolor: '#99678c' } }}
              >
                Start free
              </Button>
            </Box>

            {FOOTER_SECTIONS.map((section) => (
              <Box key={section.title}>
                <Typography sx={{ fontWeight: 800, mb: 1.5 }}>{section.title}</Typography>
                <Stack spacing={1.1}>
                  {section.links.map((link) => (
                    <Typography
                      key={link.to}
                      component={NextLink}
                      href={link.to}
                      variant="body2"
                      sx={{ color: 'rgba(255,255,255,0.62)', textDecoration: 'none', '&:hover': { color: '#fff' } }}
                    >
                      {link.label}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>

          <Divider sx={{ my: 5, borderColor: 'rgba(255,255,255,0.12)' }} />
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              © {new Date().getFullYear()} SanjuSK. All rights reserved.
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', maxWidth: 640 }}>
              WhatsApp is a trademark of Meta Platforms, Inc. SanjuSK is an independent solution provider using official provider APIs.
            </Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
