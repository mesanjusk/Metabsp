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
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import BrandMark from '@/lib/ui/app/BrandMark';

const NAV_LINKS = [
  { label: 'Product', to: '/' },
  { label: 'About', to: '/about' },
  { label: 'Developers', to: '/developer-docs' },
  { label: 'Status', to: '/status' },
  { label: 'Contact', to: '/contact' },
];

const FOOTER_SECTIONS = [
  {
    title: 'Platform',
    links: [
      { label: 'Product', to: '/' },
      { label: 'About', to: '/about' },
      { label: 'Status', to: '/status' },
      { label: 'Help Center', to: '/help-center' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'API reference', to: '/developer-docs' },
      { label: 'Security', to: '/security-info' },
      { label: 'Contact support', to: '/contact' },
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

/**
 * The public shell around the marketing and legal pages.
 *
 * Two things changed beyond appearance, and both matter to App Review.
 *
 * The header used WhatsApp's own glyph as this product's logo. A Business
 * Solution Provider is a distinct company operating on top of WhatsApp, and
 * presenting Meta's mark as its own is a brand-guideline problem a reviewer
 * looks for. It is the product's own mark now.
 *
 * The footer laid its columns out with Tailwind classes (`grid grid-cols-3`)
 * that this app has no Tailwind to interpret, so the whole footer — including
 * the Privacy Policy and Terms links Meta checks — rendered as one unstyled
 * stack. It uses the layout system the rest of the app uses.
 */
export default function PublicLayout({ children }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          color: 'text.primary',
        }}
      >
        <Toolbar sx={{ maxWidth: 1200, width: '100%', mx: 'auto', px: { xs: 2, md: 4 } }}>
          <Box
            component={NextLink}
            href="/"
            sx={{ textDecoration: 'none', color: 'primary.main', display: 'flex', alignItems: 'center' }}
          >
            <BrandMark size={30} />
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {!isMobile && (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mr: 2 }}>
              {NAV_LINKS.map((link) => (
                <Button
                  key={link.to}
                  component={NextLink}
                  href={link.to}
                  sx={{
                    color: pathname === link.to ? 'primary.main' : 'text.secondary',
                    fontWeight: pathname === link.to ? 650 : 500,
                  }}
                >
                  {link.label}
                </Button>
              ))}
            </Stack>
          )}

          {!isMobile && (
            <Stack direction="row" spacing={1}>
              <Button component={NextLink} href="/login" variant="text">
                Sign in
              </Button>
              <Button component={NextLink} href="/signup" variant="contained">
                Get started
              </Button>
            </Stack>
          )}

          {isMobile && (
            <IconButton onClick={() => setDrawerOpen(true)} aria-label="Open menu" sx={{ color: 'text.primary' }}>
              <MenuRoundedIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 272, pt: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, pb: 2 }}>
            <Box sx={{ color: 'primary.main' }}>
              <BrandMark size={26} />
            </Box>
            <IconButton onClick={() => setDrawerOpen(false)} aria-label="Close menu">
              <CloseRoundedIcon />
            </IconButton>
          </Stack>
          <Divider />
          <List>
            {NAV_LINKS.map((link) => (
              <ListItem key={link.to} disablePadding>
                <ListItemButton
                  component={NextLink}
                  href={link.to}
                  selected={pathname === link.to}
                  onClick={() => setDrawerOpen(false)}
                >
                  <ListItemText primary={link.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Divider />
          <Stack spacing={1} sx={{ p: 2 }}>
            <Button component={NextLink} href="/login" variant="outlined" fullWidth onClick={() => setDrawerOpen(false)}>
              Sign in
            </Button>
            <Button component={NextLink} href="/signup" variant="contained" fullWidth onClick={() => setDrawerOpen(false)}>
              Get started
            </Button>
          </Stack>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1 }}>
        {children}
      </Box>

      <Box
        component="footer"
        sx={{ bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider', mt: 'auto', py: 7 }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={5} sx={{ mb: 5 }}>
            <Grid item xs={12} md={4}>
              <Box sx={{ color: 'primary.main', mb: 1.5 }}>
                <BrandMark size={30} />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }}>
                A WhatsApp Business Solution Provider on Meta&apos;s official Cloud API. Every message in
                and out runs on the WhatsApp Business Platform.
              </Typography>
            </Grid>

            {FOOTER_SECTIONS.map((section) => (
              <Grid item xs={12} sm={4} md={2.6} key={section.title}>
                <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  {section.title}
                </Typography>
                <Stack spacing={1}>
                  {section.links.map((link) => (
                    <Typography
                      key={link.to}
                      component={NextLink}
                      href={link.to}
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                        textDecoration: 'none',
                        '&:hover': { color: 'primary.main' },
                      }}
                    >
                      {link.label}
                    </Typography>
                  ))}
                </Stack>
              </Grid>
            ))}
          </Grid>

          <Divider sx={{ mb: 3 }} />

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ sm: 'center' }}
            spacing={1}
          >
            <Typography variant="body2" color="text.secondary">
              © {new Date().getFullYear()} MetaBSP. All rights reserved.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              WhatsApp is a trademark of Meta Platforms, Inc. MetaBSP is an independent solution provider.
            </Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
