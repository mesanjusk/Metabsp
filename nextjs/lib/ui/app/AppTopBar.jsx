'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  InputAdornment,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import SettingsBrightnessRoundedIcon from '@mui/icons-material/SettingsBrightnessRounded';
import ConnectionBadge from './ConnectionBadge';
import { useColorScheme } from '@/lib/ui/ColorSchemeContext';
import { layout } from '@/lib/ui/theme';

const initialsFor = (name) =>
  String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';

const SCHEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: LightModeRoundedIcon },
  { value: 'dark', label: 'Dark', icon: DarkModeRoundedIcon },
  { value: 'system', label: 'Match system', icon: SettingsBrightnessRoundedIcon },
];

/**
 * The application top bar: page title, contextual search, connection state and
 * the account menu.
 *
 * Search is rendered only where the current screen actually consumes it. The
 * previous shell showed a search field on every screen and quietly ignored it
 * on most of them, which teaches people the control is broken.
 */
export default function AppTopBar({
  title,
  searchPlaceholder,
  search,
  onSearchChange,
  connectionState,
  connectionDetail,
  lastCheckedAt,
  userName,
  userGroup,
  onOpenNav,
  onLogout,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const { preference, setPreference } = useColorScheme();

  return (
    <Box
      component="header"
      sx={{
        height: layout.topBarHeight,
        flexShrink: 0,
        px: { xs: 1.5, md: 3 },
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <IconButton
        onClick={onOpenNav}
        aria-label="Open navigation"
        sx={{ display: { lg: 'none' } }}
        size="small"
      >
        <MenuRoundedIcon />
      </IconButton>

      <Typography variant="h6" noWrap sx={{ fontWeight: 700, minWidth: 0 }}>
        {title}
      </Typography>

      {searchPlaceholder ? (
        <TextField
          size="small"
          value={search}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder={searchPlaceholder}
          inputProps={{ 'aria-label': searchPlaceholder }}
          sx={{ ml: 'auto', width: { xs: 140, sm: 240, md: 320 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" color="disabled" />
              </InputAdornment>
            ),
          }}
        />
      ) : (
        <Box sx={{ ml: 'auto' }} />
      )}

      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexShrink: 0 }}>
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          <ConnectionBadge state={connectionState} detail={connectionDetail} lastCheckedAt={lastCheckedAt} />
        </Box>

        <Tooltip title="Account">
          <IconButton onClick={(event) => setAnchorEl(event.currentTarget)} size="small" aria-label="Account menu">
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.8125rem', fontWeight: 700 }}>
              {initialsFor(userName)}
            </Avatar>
          </IconButton>
        </Tooltip>
      </Stack>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 232, mt: 0.5 } } }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography variant="subtitle2" noWrap>
            {userName || 'Signed in'}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {userGroup || 'Member'}
          </Typography>
        </Box>
        <Divider />

        <Typography variant="overline" sx={{ px: 2, pt: 1, display: 'block', color: 'text.secondary' }}>
          Appearance
        </Typography>
        {SCHEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <MenuItem
              key={option.value}
              selected={preference === option.value}
              onClick={() => setPreference(option.value)}
              dense
            >
              <ListItemIcon>
                <Icon fontSize="small" />
              </ListItemIcon>
              {option.label}
            </MenuItem>
          );
        })}

        <Divider />
        <MenuItem component={NextLink} href="/settings" onClick={() => setAnchorEl(null)} dense>
          <ListItemIcon>
            <SettingsRoundedIcon fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            onLogout?.();
          }}
          dense
        >
          <ListItemIcon>
            <LogoutRoundedIcon fontSize="small" />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>
    </Box>
  );
}
