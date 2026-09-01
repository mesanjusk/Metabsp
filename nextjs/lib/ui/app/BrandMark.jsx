'use client';

import { Box, Stack, Typography } from '@mui/material';

/**
 * The product's own mark.
 *
 * Deliberately not WhatsApp's glyph. The previous shell used the WhatsApp icon
 * and a green "WA" avatar as this product's identity, which is both a brand
 * guideline problem for a Business Solution Provider and a usability one: a
 * customer running three vendors' dashboards could not tell them apart.
 *
 * Drawn as an inline SVG rather than an image file so it inherits the current
 * text colour, stays crisp at any size, and costs no extra request. The shape
 * is a rounded speech container with a signal bar rising through it — messaging
 * plus throughput, which is what the platform does.
 */
export default function BrandMark({ size = 32, showWordmark = true, wordmarkVariant = 'h6' }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.25}>
      <Box
        component="svg"
        viewBox="0 0 32 32"
        role="img"
        aria-label="SanjuSK"
        sx={{ width: size, height: size, flexShrink: 0, display: 'block' }}
      >
        <rect width="32" height="32" rx="9" fill="currentColor" opacity="0.12" />
        <path
          d="M8 12.5A4.5 4.5 0 0 1 12.5 8h7A4.5 4.5 0 0 1 24 12.5v5a4.5 4.5 0 0 1-4.5 4.5H14l-4.4 3.3A1 1 0 0 1 8 24.5Z"
          fill="currentColor"
          opacity="0.9"
        />
        <g stroke="var(--brand-mark-fg, #FFFFFF)" strokeWidth="2" strokeLinecap="round">
          <line x1="13" y1="18" x2="13" y2="15.5" />
          <line x1="16" y1="18" x2="16" y2="13" />
          <line x1="19" y1="18" x2="19" y2="11" />
        </g>
      </Box>

      {showWordmark ? (
        <Typography
          variant={wordmarkVariant}
          sx={{ fontWeight: 750, letterSpacing: '-0.02em', lineHeight: 1, whiteSpace: 'nowrap' }}
        >
          SanjuSK
        </Typography>
      ) : null}
    </Stack>
  );
}
