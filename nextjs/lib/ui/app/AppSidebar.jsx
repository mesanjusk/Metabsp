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
import { SERVICES } from './serviceRegistry';
import { layout } from '@/lib/ui/theme';
import { useTheme } from '@mui/material/styles';
import { brand, neutral } from '@/lib/ui/tokens';

/**
 * The rail is the one place in the product that is brand-coloured all over, so it reads from the
 * lavender ramp rather than repeating hexes. Each pair below clears WCAG AA against its own rail.
 *
 * Light mode's rail is the pale end of the ramp with dark text on it, not the deep end with light
 * text: the deep purple was the loudest thing on every screen, and a navigation rail is the last
 * thing that should be. Dark mode keeps a near-black rail — a pale lavender panel in a dark app is
 * a lamp — and carries the brand in the selected row instead.
 */
const RAIL = {
  light: {
    bg: brand[50],
    ink: neutral[800],
    heading: neutral[500],
    logo: brand[800],
    hover: brand[100],
    selectedBg: brand[200],
    selectedInk: brand[900],
    selectedHover: brand[300],
    hairline: brand[200],
  },
  dark: {
    bg: neutral[900],
    ink: neutral[200],
    heading: neutral[400],
    logo: neutral[100],
    hover: 'rgba(255,255,255,0.06)',
    selectedBg: brand[800],
    selectedInk: brand[100],
    selectedHover: brand[700],
    hairline: 'rgba(255,255,255,0.10)',
  },
};

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
  const rail = RAIL[useTheme().palette.mode] || RAIL.light;
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
        bgcolor: rail.bg,
        color: rail.ink,
        '& .MuiDivider-root': { borderColor: rail.hairline },
        borderRight: '1px solid',
        borderColor: rail.hairline,
      }}
    >
      <Box
        sx={{
          height: layout.topBarHeight,
          px: 2.5,
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: rail.hairline,
          color: rail.logo,
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
                    sx={{ minHeight: 44, py: 1, px: 1.5, color: rail.ink, '&:hover': { bgcolor: rail.hover }, '&.Mui-selected': { bgcolor: rail.selectedBg, color: rail.selectedInk, fontWeight: 650, '&:hover': { bgcolor: rail.selectedHover } } }}
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
                  sx={{ minHeight: 40, py: 0.5, px: 1.5, borderRadius: 2, color: rail.heading, '&:hover': { bgcolor: rail.hover } }}
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
                <Typography variant="overline" sx={{ px: 1.5, color: rail.heading, display: 'block', mb: 0.75 }}>
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

      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: rail.hairline }}>
        <Tooltip
          title={
            activeService
              ? `${activeService.label} uses the same business account and shared workspace data.`
              : 'Every service here shares one business account and one set of customer records.'
          }
        >
          <Stack spacing={0.25}>
            <Typography variant="caption" sx={{ color: rail.ink }}>
              {activeService?.label || 'Small Business Digital OS'}
            </Typography>
            {/* On the hub this line used to read "All services" — the third copy of that phrase on
                one screen, after the menu item above it and the title in the top bar. It says
                something now. */}
            <Typography variant="caption" sx={{ color: rail.heading }}>
              {activeService ? 'Shared business workspace' : `${SERVICES.length} services, one account`}
            </Typography>
          </Stack>
        </Tooltip>
      </Box>
    </Box>
  );
}
