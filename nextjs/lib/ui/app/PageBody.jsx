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
    <Box sx={{ px: { xs: 2, md: 3, xl: 4 }, py: { xs: 2.5, md: 3.5 }, minWidth: 0 }}>
      <Box sx={{ maxWidth: maxWidth ?? layout.contentMaxWidth, mx: 'auto' }}>
        {title || description || actions ? (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ sm: 'flex-start' }}
            justifyContent="space-between"
            sx={{ mb: 3, pb: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <Box sx={{ minWidth: 0 }}>
              {title ? (
                <Typography component="h1" variant="h4" sx={{ mb: description ? 0.75 : 0, fontSize: { xs: '1.5rem', md: '1.875rem' }, letterSpacing: '-0.035em', fontWeight: 750 }}>
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
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexShrink: { sm: 0 }, flexWrap: 'wrap', maxWidth: '100%' }}>
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
