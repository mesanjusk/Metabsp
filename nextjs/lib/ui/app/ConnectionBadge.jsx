'use client';

import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { WHATSAPP_CONNECTED } from '@/lib/ui/tokens';

/**
 * Whether this business's WhatsApp number is live, shown in the top bar.
 *
 * Colour alone never carries the state: each variant has its own label, so it
 * survives both greyscale and the ~8% of men with a colour vision deficiency.
 * The dot is the one place WhatsApp's own green appears in the product, and it
 * means "connected to WhatsApp" rather than standing in for a brand.
 */
const VARIANTS = {
  connected: { label: 'Connected', color: 'success', dot: WHATSAPP_CONNECTED },
  loading: { label: 'Checking…', color: 'default', dot: 'text.disabled' },
  disconnected: { label: 'Not connected', color: 'warning', dot: 'warning.main' },
  error: { label: 'Unavailable', color: 'error', dot: 'error.main' },
};

export default function ConnectionBadge({ state = 'loading', detail = '', lastCheckedAt = null }) {
  const variant = VARIANTS[state] || VARIANTS.loading;

  const tooltip = [
    detail,
    lastCheckedAt
      ? `Last checked ${lastCheckedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Tooltip title={tooltip || variant.label}>
      <Chip
        size="small"
        variant="outlined"
        color={variant.color}
        label={
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <Box
              component="span"
              sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: variant.dot, flexShrink: 0 }}
            />
            <Typography variant="caption" sx={{ fontWeight: 650 }}>
              {variant.label}
            </Typography>
          </Stack>
        }
        sx={{ '& .MuiChip-label': { px: 1 } }}
      />
    </Tooltip>
  );
}
