'use client';

import { Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';

/**
 * The two ways to connect a WhatsApp number, presented side by side.
 *
 * Both have always been available to every account — neither is admin-only —
 * but they were a primary button and a quieter one next to it, which reads as
 * a recommended path and a fallback. They are not: Embedded Signup suits a
 * business that has not set up WhatsApp with Meta yet, and pasting an existing
 * token suits one whose administrator already manages a WhatsApp Business
 * Account. Showing them as two equal choices, each saying who it is for, is
 * the difference between a customer picking the right one and guessing.
 */
const OPTIONS = [
  {
    id: 'embedded',
    icon: BoltRoundedIcon,
    title: 'Connect with Meta',
    tag: 'Recommended',
    lead: "You do not have a WhatsApp Business Account yet, or you would rather Meta set it up.",
    points: [
      'Meta walks you through creating or choosing a business account and number',
      'Everything happens in a Meta-hosted window — no credentials are typed here',
      'Takes a few minutes end to end',
    ],
    cta: 'Connect with Meta',
  },
  {
    id: 'manual',
    icon: KeyRoundedIcon,
    title: 'Use an existing token',
    tag: 'For existing WABAs',
    lead: 'Your administrator already manages the WhatsApp Business Account in Meta Business Manager.',
    points: [
      'Paste an access token, phone number ID and business account ID',
      'We verify with Meta that the account is genuinely yours before storing anything',
      'A System User token is best — it does not expire',
    ],
    cta: 'Use an existing token',
  },
];

export default function ConnectChoiceCards({ onEmbedded, onManual, isBusy }) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={2.5}
      alignItems="stretch"
      sx={{ '& > *': { flex: 1, minWidth: 0 } }}
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const isEmbedded = option.id === 'embedded';

        return (
          <Card
            key={option.id}
            variant="outlined"
            sx={(theme) => ({
              display: 'flex',
              borderColor: isEmbedded ? alpha(theme.palette.primary.main, 0.4) : undefined,
            })}
          >
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, width: '100%', p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={(theme) => ({
                    width: 38,
                    height: 38,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                    flexShrink: 0,
                  })}
                >
                  <Icon fontSize="small" />
                </Box>
                <Typography variant="h6" sx={{ flex: 1, minWidth: 0 }}>
                  {option.title}
                </Typography>
                <Chip
                  size="small"
                  label={option.tag}
                  variant="outlined"
                  color={isEmbedded ? 'primary' : 'default'}
                />
              </Stack>

              <Typography variant="body2" color="text.secondary">
                {option.lead}
              </Typography>

              <Stack component="ul" spacing={0.75} sx={{ m: 0, pl: 2.25, flex: 1 }}>
                {option.points.map((point) => (
                  <Typography key={point} component="li" variant="body2" color="text.secondary">
                    {point}
                  </Typography>
                ))}
              </Stack>

              <Button
                variant={isEmbedded ? 'contained' : 'outlined'}
                size="large"
                onClick={isEmbedded ? onEmbedded : onManual}
                disabled={isBusy}
                sx={{ mt: 0.5 }}
              >
                {isBusy && isEmbedded ? 'Connecting…' : option.cta}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}
