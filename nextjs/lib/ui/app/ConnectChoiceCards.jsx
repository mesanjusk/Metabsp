'use client';

import { Alert, Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import {
  EMBEDDED_SIGNUP_COMING_SOON_LABEL,
  EMBEDDED_SIGNUP_COMING_SOON_NOTE,
  EMBEDDED_SIGNUP_ENABLED,
} from './embeddedSignup';

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
 *
 * While Embedded Signup is off (see ./embeddedSignup), its card stays on the
 * page — greyed out and marked "Coming soon" rather than removed, so the route
 * a customer may have been told about is visibly planned, not missing — and
 * the token route carries the recommendation.
 */
const OPTIONS = [
  {
    id: 'embedded',
    icon: BoltRoundedIcon,
    title: 'Connect with Meta',
    tag: EMBEDDED_SIGNUP_ENABLED ? 'Recommended' : EMBEDDED_SIGNUP_COMING_SOON_LABEL,
    lead: "You do not have a WhatsApp Business Account yet, or you would rather Meta set it up.",
    points: [
      'Meta walks you through creating or choosing a business account and number',
      'Everything happens in a Meta-hosted window — no credentials are typed here',
      'Takes a few minutes end to end',
    ],
    cta: EMBEDDED_SIGNUP_ENABLED ? 'Connect with Meta' : EMBEDDED_SIGNUP_COMING_SOON_LABEL,
  },
  {
    id: 'manual',
    icon: KeyRoundedIcon,
    title: 'Use an existing token',
    tag: EMBEDDED_SIGNUP_ENABLED ? 'For existing WABAs' : 'Available now',
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
    <Stack spacing={2.5}>
      {EMBEDDED_SIGNUP_ENABLED ? null : <Alert severity="info">{EMBEDDED_SIGNUP_COMING_SOON_NOTE}</Alert>}

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2.5}
        alignItems="stretch"
        sx={{ '& > *': { flex: 1, minWidth: 0 } }}
      >
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const isEmbedded = option.id === 'embedded';
          // Whichever card can actually be used right now is the highlighted,
          // primary one; the other is the quieter outlined card.
          const isPrimary = isEmbedded === EMBEDDED_SIGNUP_ENABLED;
          const isUnavailable = isEmbedded && !EMBEDDED_SIGNUP_ENABLED;

          return (
            <Card
              key={option.id}
              variant="outlined"
              sx={(theme) => ({
                display: 'flex',
                borderColor: isPrimary ? alpha(theme.palette.primary.main, 0.4) : undefined,
                opacity: isUnavailable ? 0.7 : 1,
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
                    color={isPrimary ? 'primary' : 'default'}
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

                {isUnavailable ? (
                  <Typography variant="caption" color="text.disabled">
                    We are finishing this route with Meta. Use an existing token in the meantime.
                  </Typography>
                ) : null}

                <Button
                  variant={isPrimary ? 'contained' : 'outlined'}
                  size="large"
                  onClick={isEmbedded ? onEmbedded : onManual}
                  disabled={isBusy || isUnavailable}
                  sx={{ mt: 0.5 }}
                >
                  {isBusy && isEmbedded && EMBEDDED_SIGNUP_ENABLED ? 'Connecting…' : option.cta}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Stack>
  );
}
