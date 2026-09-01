'use client';

import { Box, Stack, Typography } from '@mui/material';
import { layout } from '@/lib/ui/theme';

/**
 * Standard padding, max width and header for a dashboard section.
 *
 * Having one of these is what stops six pages from each inventing their own
 * margins — the thing that makes a product look assembled rather than
 * designed. `bleed` opts out for the inbox, which is a full-height split view
 * that must not be inset or capped.
 */
export default function PageBody({ title, description, actions, children, bleed = false, maxWidth }) {
  if (bleed) {
    return <Box sx={{ height: '100%', minHeight: 0 }}>{children}</Box>;
  }

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
      <Box sx={{ maxWidth: maxWidth ?? layout.contentMaxWidth, mx: 'auto' }}>
        {title || description || actions ? (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ sm: 'flex-start' }}
            justifyContent="space-between"
            sx={{ mb: 3 }}
          >
            <Box sx={{ minWidth: 0 }}>
              {title ? (
                <Typography variant="h4" sx={{ mb: description ? 0.75 : 0 }}>
                  {title}
                </Typography>
              ) : null}
              {description ? (
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 680 }}>
                  {description}
                </Typography>
              ) : null}
            </Box>
            {actions ? (
              <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                {actions}
              </Stack>
            ) : null}
          </Stack>
        ) : null}

        {children}
      </Box>
    </Box>
  );
}
