'use client';

import { useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import { Box, ButtonBase, Chip, CircularProgress, Stack, Tooltip, Typography } from '@mui/material';
import apiClient from '@/lib/api/client';
import { SERVICES } from './serviceRegistry';

/** Compact, labelled service navigation. Entitlements still determine which links are enabled. */
export default function ServiceSwitcherBar({ activeService = 'hub' }) {
  const [access, setAccess] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiClient.get('/api/services/access')
      .then((response) => { if (mounted) setAccess(response?.data?.data || {}); })
      .catch(() => { if (mounted) setAccess({}); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const items = useMemo(() => SERVICES.map((service) => {
    const released = service.status === 'active' || service.status === 'beta';
    const entitlement = access?.[service.slug];
    const enabled = released && (service.tier === 'basic' || entitlement?.enabled === true);
    return {
      service,
      enabled,
      reason: !released ? 'Coming soon' : entitlement?.reason || (service.tier === 'basic' ? 'Included' : 'Pro service'),
    };
  }), [access]);

  return (
    <Box sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', px: { xs: 1, sm: 1.5, md: 2 }, py: { xs: 0.75, sm: 1 } }}>
      <Stack direction="row" spacing={{ xs: 0.75, sm: 1.1 }} sx={{ overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', scrollSnapType: 'x proximity', '&::-webkit-scrollbar': { display: 'none' } }}>
        {loading ? (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ minHeight: 44, px: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary" noWrap>Loading services…</Typography>
          </Stack>
        ) : null}

        {!loading ? items.map(({ service, enabled, reason }) => {
          const Icon = service.icon;
          const selected = activeService === service.slug;
          const tile = (
            <ButtonBase
              component={enabled ? NextLink : 'div'}
              href={enabled ? service.href : undefined}
              disabled={!enabled}
              aria-label={`${service.label}${enabled ? '' : ` - ${reason}`}`}
              sx={{
                width: 'auto', minWidth: 'max-content', height: 44, flexShrink: 0,
                // A 20px radius on a 52x48 tile is a circle, not a squircle — app icons read as
                // rounded squares, and the difference is most of what makes a row of them look
                // like an app rather than a row of buttons.
                borderRadius: 2, scrollSnapAlign: 'start', display: 'flex', flexDirection: 'row',
                justifyContent: 'center', gap: 0.75, border: '1px solid',
                borderColor: selected ? 'primary.main' : 'transparent',
                bgcolor: selected ? 'action.selected' : 'transparent',
                opacity: enabled ? 1 : 0.58, position: 'relative', px: 1.25,
                transition: 'transform 120ms ease, border-color 120ms ease, background-color 120ms ease',
                '&:hover': enabled ? { bgcolor: selected ? 'action.selected' : 'action.hover', transform: 'translateY(-1px)' } : undefined,
              }}
            >
              <Box sx={{ width: 24, height: 24, display: 'grid', placeItems: 'center', borderRadius: 1.5, color: selected ? 'primary.main' : 'text.primary' }}>
                <Icon fontSize="small" sx={{ fontSize: 19 }} />
              </Box>
              <Typography
                variant="caption"
                noWrap
                sx={{ display: 'block', fontWeight: selected ? 700 : 550, fontSize: '0.75rem', lineHeight: 1.4 }}
              >
                {service.shortLabel || service.label}
              </Typography>
              {service.tier === 'pro' ? (
                <Chip
                  label="PRO"
                  size="small"
                  variant="outlined"
                  sx={{
                    position: 'static',
                    height: 18,
                    fontSize: '0.55rem',
                    '& .MuiChip-label': { px: 0.45 },
                    // Purely a marker at phone size — it must never be what the eye lands on, and
                    // at 12px tall over a 26px icon it would otherwise touch it.
                    pointerEvents: 'none',
                  }}
                />
              ) : null}
            </ButtonBase>
          );
          return enabled ? <Box key={service.slug}>{tile}</Box> : <Tooltip key={service.slug} title={reason} arrow><Box component="span">{tile}</Box></Tooltip>;
        }) : null}
      </Stack>
    </Box>
  );
}
