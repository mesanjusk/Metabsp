'use client';

import { useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Box,
  Collapse,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import BrandMark from './BrandMark';
import { findNavItem, getActiveServiceInfo, getNavSections } from './navigation';
import { layout } from '@/lib/ui/theme';

const MUTED = '#9FB9AF';
const INK = '#CADAD5';

/**
 * Service-aware primary navigation.
 *
 * The customer enters one service at a time. WhatsApp, Instagram and every
 * future module therefore get their own menu instead of sharing one giant
 * sidebar. "All services" is the deliberate way back to the service hub.
 *
 * A section may declare itself `collapsible`, which is what lets a service with sixty tools —
 * Institute Management — keep all of them here instead of spilling them onto its main screen. A
 * collapsible group opens when the page you are on is inside it and stays shut otherwise, so the
 * menu is as long as the part of it you are using.
 */
export default function AppSidebar({ isAdmin = false, onNavigate }) {
  const pathname = usePathname() || '';
  const sections = getNavSections(pathname);
  const activeService = getActiveServiceInfo(pathname);
  const activeItem = findNavItem(pathname);

  // Which collapsible group holds the current page. Recomputed on navigation so following a link
  // out of one group and into another opens the one you landed in.
  const openByRoute = useMemo(
    () =>
      sections.find(
        (section) => section.collapsible && section.items.some((item) => item.href === activeItem?.href)
      )?.id || null,
    [sections, activeItem?.href]
  );

  const [openSection, setOpenSection] = useState(openByRoute);
  useEffect(() => { if (openByRoute) setOpenSection(openByRoute); }, [openByRoute]);

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
        color: INK,
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

          const expanded = !section.collapsible || openSection === section.id;
          const listId = `nav-section-${section.id}`;

          const list = (
            <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }} id={listId}>
              {items.map((item) => {
                const Icon = item.icon;
                const selected = item.href === activeItem?.href;
                return (
                  <ListItemButton
                    key={item.href}
                    component={NextLink}
                    href={item.href}
                    selected={selected}
                    onClick={onNavigate}
                    aria-current={selected ? 'page' : undefined}
                    sx={{ minHeight: 44, py: 1, px: 1.5, color: INK, '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' }, '&.Mui-selected': { bgcolor: '#D6F5E5', color: '#153E32', boxShadow: '0 3px 12px rgba(0,0,0,0.08)', '&:hover': { bgcolor: '#C1ECD5' } } }}
                  >
                    <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>
                      <Icon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      secondary={item.shared ? 'Shared workspace' : null}
                      primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: selected ? 650 : 500 }}
                      secondaryTypographyProps={{ fontSize: '0.6875rem', color: 'inherit', sx: { opacity: 0.65 } }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          );

          return (
            <Box key={section.id} sx={{ mb: section.collapsible ? 1 : 2.5 }}>
              {index > 0 && !section.collapsible ? <Divider sx={{ mb: 2, mx: 0.5 }} /> : null}

              {section.collapsible ? (
                <ListItemButton
                  onClick={() => setOpenSection((current) => (current === section.id ? null : section.id))}
                  aria-expanded={expanded}
                  aria-controls={listId}
                  sx={{ minHeight: 40, py: 0.5, px: 1.5, borderRadius: 2, color: MUTED, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
                >
                  <ListItemText
                    primary={section.label}
                    primaryTypographyProps={{ variant: 'overline', sx: { color: 'inherit', lineHeight: 1.6 } }}
                  />
                  <Typography variant="caption" sx={{ color: 'inherit', mr: 0.75, opacity: 0.8 }}>
                    {items.length}
                  </Typography>
                  {expanded ? <ExpandLessRoundedIcon fontSize="small" /> : <ExpandMoreRoundedIcon fontSize="small" />}
                </ListItemButton>
              ) : (
                <Typography variant="overline" sx={{ px: 1.5, color: MUTED, display: 'block', mb: 0.75 }}>
                  {section.label}
                </Typography>
              )}

              {section.collapsible ? (
                <Collapse in={expanded} unmountOnExit>
                  <Box sx={{ pt: 0.5 }}>{list}</Box>
                </Collapse>
              ) : (
                list
              )}
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
            <Typography variant="caption" sx={{ color: '#BDD0C8' }}>
              {activeService?.label || 'Small Business Digital OS'}
            </Typography>
            <Typography variant="caption" sx={{ color: MUTED }}>
              {activeService ? 'Shared business workspace' : 'All services'}
            </Typography>
          </Stack>
        </Tooltip>
      </Box>
    </Box>
  );
}
