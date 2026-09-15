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
import { getActiveServiceInfo, getNavSections } from './navigation';
import { layout } from '@/lib/ui/theme';

/**
 * Service-aware primary navigation.
 *
 * The customer enters one service at a time. WhatsApp, Instagram and every
 * future module therefore get their own menu instead of sharing one giant
 * sidebar. "All services" is the deliberate way back to the service hub.
 */
export default function AppSidebar({ isAdmin = false, onNavigate }) {
  const pathname = usePathname() || '';
  const sections = getNavSections(pathname);
  const activeService = getActiveServiceInfo(pathname);

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
        bgcolor: '#122B2A',
        color: '#CADAD5',
        '& .MuiDivider-root': { borderColor: 'rgba(255,255,255,0.09)' },
        borderRight: '1px solid',
        borderColor: 'rgba(255,255,255,0.09)',
      }}
    >
      <Box
        sx={{
          height: layout.topBarHeight,
          px: 2.5,
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: 'rgba(255,255,255,0.09)',
          color: '#EDFFF7',
        }}
      >
        <Box component={NextLink} href="/home" sx={{ color: 'inherit', textDecoration: 'none' }}>
          <BrandMark size={28} />
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 2 }}>
        {sections.map((section, index) => {
          const items = section.items.filter((item) => !item.adminOnly || isAdmin);
          if (!items.length) return null;

          return (
            <Box key={section.id} sx={{ mb: 2.5 }}>
              {index > 0 ? <Divider sx={{ mb: 2, mx: 0.5 }} /> : null}
              <Typography
                variant="overline"
                sx={{ px: 1.5, color: '#9FB9AF', display: 'block', mb: 0.75 }}
              >
                {section.label}
              </Typography>
              <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
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
                      sx={{ minHeight: 44, py: 1, px: 1.5, color: '#CADAD5', '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' }, '&.Mui-selected': { bgcolor: '#D6F5E5', color: '#153E32', boxShadow: '0 3px 12px rgba(0,0,0,0.08)', '&:hover': { bgcolor: '#C1ECD5' } } }}
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

      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'rgba(255,255,255,0.09)' }}>
        <Tooltip
          title={
            activeService
              ? `${activeService.label} uses the same business account and shared workspace data.`
              : 'Choose a service to open its dedicated dashboard.'
          }
        >
          <Stack spacing={0.25}>
            <Typography variant="caption" sx={{ color: "#BDD0C8" }}>
              {activeService?.label || 'Small Business Digital OS'}
            </Typography>
            <Typography variant="caption" sx={{ color: "#9FB9AF" }}>
              {activeService ? 'Shared business workspace' : 'All services'}
            </Typography>
          </Stack>
        </Tooltip>
      </Box>
    </Box>
  );
}
