'use client';

import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import BrandMark from './BrandMark';
import { NAV_SECTIONS } from './navigation';
import { layout } from '@/lib/ui/theme';

/**
 * The primary navigation.
 *
 * Every destination is a link with a real href, not a tab that swaps state —
 * so middle-click, cmd-click, browser back and a pasted URL all behave the way
 * a user expects, and a support article can point someone at a screen.
 *
 * Admin-only entries are filtered out rather than rendered disabled: showing a
 * customer a greyed-out "Administration" tells them something exists that they
 * cannot have, which invites a support ticket and reveals platform structure
 * for no benefit. Server-side authorisation is what actually enforces this;
 * hiding is presentation only.
 */
export default function AppSidebar({ isAdmin = false, onNavigate }) {
  const pathname = usePathname() || '';

  return (
    <Box
      component="nav"
      aria-label="Main"
      sx={{
        width: layout.sidebarWidth,
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderRight: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box
        sx={{
          height: layout.topBarHeight,
          px: 2.5,
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
          color: 'primary.main',
        }}
      >
        <Box component={NextLink} href="/inbox" sx={{ color: 'inherit', textDecoration: 'none' }}>
          <BrandMark size={28} />
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 2 }}>
        {NAV_SECTIONS.map((section, index) => {
          const items = section.items.filter((item) => !item.adminOnly || isAdmin);
          if (!items.length) return null;

          return (
            <Box key={section.id} sx={{ mb: 2.5 }}>
              {index > 0 ? <Divider sx={{ mb: 2, mx: 0.5 }} /> : null}
              <Typography
                variant="overline"
                sx={{ px: 1.5, color: 'text.secondary', display: 'block', mb: 0.75 }}
              >
                {section.label}
              </Typography>
              <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                {items.map((item) => {
                  const Icon = item.icon;
                  const selected = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <ListItemButton
                      key={item.href}
                      component={NextLink}
                      href={item.href}
                      selected={selected}
                      onClick={onNavigate}
                      aria-current={selected ? 'page' : undefined}
                      sx={{ py: 0.9, px: 1.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>
                        <Icon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: selected ? 650 : 500 }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Tooltip title="Messaging runs on the official WhatsApp Business Platform (Cloud API)">
          <Stack spacing={0.25}>
            <Typography variant="caption" color="text.secondary">
              Official WhatsApp Business Platform
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Cloud API · Meta Tech Provider
            </Typography>
          </Stack>
        </Tooltip>
      </Box>
    </Box>
  );
}
