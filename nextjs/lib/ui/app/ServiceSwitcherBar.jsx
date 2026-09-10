'use client';

import { useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import {
  Box,
  ButtonBase,
  CircularProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import apiClient from '@/lib/api/client';
import { SERVICES } from './serviceRegistry';

/**
 * Amazon-style horizontal app switcher.
 *
 * Every product is intentionally visible so the customer understands the
 * complete platform. Only released + entitled products are interactive.
 * ServiceAccessGate and provider APIs remain the actual security boundary;
 * this component is the fast visual switcher.
 */
export default function ServiceSwitcherBar({ activeService = 'hub' }) {
  const [access, setAccess] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiClient
      .get('/api/services/access')
      .then((response) => {
        if (mounted) setAccess(response?.data?.data || {});
      })
      .catch(() => {
        if (mounted) setAccess({});
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const items = useMemo(
    () =>
      SERVICES.map((service) => {
        const released = service.status === 'active' || service.status === 'beta';
        const entitlement = access?.[service.slug];
        const enabled = released && entitlement?.enabled === true;
        return {
          service,
          enabled,
          reason: !released
            ? 'Coming soon'
            : entitlement?.reason || 'Not included in your current access',
        };
      }),
    [access]
  );

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        px: { xs: 1, sm: 1.5, md: 2 },
        py: 1,
      }}
    >
      <Stack
        direction="row"
        spacing={1.1}
        sx={{
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'x proximity',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {loading ? (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ minHeight: 68, px: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary" noWrap>
              Loading services…
            </Typography>
          </Stack>
        ) : null}

        {!loading
          ? items.map(({ service, enabled, reason }) => {
              const Icon = service.icon;
              const selected = activeService === service.slug;

              const tile = (
                <ButtonBase
                  component={enabled ? NextLink : 'div'}
                  href={enabled ? service.href : undefined}
                  disabled={!enabled}
                  aria-label={`${service.label}${enabled ? '' : ` - ${reason}`}`}
                  sx={{
                    width: { xs: 72, sm: 82 },
                    minWidth: { xs: 72, sm: 82 },
                    height: 70,
                    borderRadius: 2.5,
                    scrollSnapAlign: 'start',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 0.55,
                    border: '1px solid',
                    borderColor: selected ? 'primary.main' : 'divider',
                    bgcolor: selected ? 'action.selected' : 'background.default',
                    opacity: enabled ? 1 : 0.62,
                    position: 'relative',
                    px: 0.75,
                    transition: 'transform 120ms ease, border-color 120ms ease, background-color 120ms ease',
                    '&:hover': enabled
                      ? {
                          bgcolor: selected ? 'action.selected' : 'action.hover',
                          transform: 'translateY(-1px)',
                        }
                      : undefined,
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 1.5,
                      color: selected ? 'primary.main' : 'text.primary',
                    }}
                  >
                    <Icon fontSize="medium" />
                  </Box>

                  <Typography
                    variant="caption"
                    noWrap
                    sx={{
                      width: '100%',
                      fontWeight: selected ? 750 : 650,
                      fontSize: '0.68rem',
                      lineHeight: 1.15,
                    }}
                  >
                    {service.shortLabel || service.label}
                  </Typography>

                  {!enabled ? (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 5,
                        right: 5,
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        bgcolor: 'background.paper',
                        display: 'grid',
                        placeItems: 'center',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <LockRoundedIcon sx={{ fontSize: 11 }} />
                    </Box>
                  ) : null}
                </ButtonBase>
              );

              return enabled ? (
                <Box key={service.slug}>{tile}</Box>
              ) : (
                <Tooltip key={service.slug} title={reason} arrow>
                  <Box component="span">{tile}</Box>
                </Tooltip>
              );
            })
          : null}
      </Stack>
    </Box>
  );
}
