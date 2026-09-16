'use client';
import { Box, Stack, Typography } from '@mui/material';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import BrandMark from './BrandMark';
import { brand, neutral } from '@/lib/ui/tokens';

export default function AuthBrandPanel() {
  return (
    <Stack sx={{ p: { xs: 3, lg: 7, xl: 10 }, bgcolor: (t) => (t.palette.mode === 'dark' ? brand[900] : brand[100]), color: (t) => (t.palette.mode === 'dark' ? brand[50] : neutral[900]), justifyContent: 'space-between', minWidth: 0 }} spacing={{ xs: 3, lg: 8 }}>
      <BrandMark size={36} />
      <Box sx={{ maxWidth: 620, display: { xs: 'none', lg: 'block' } }}>
        <Typography variant="overline" sx={{ color: (t) => (t.palette.mode === 'dark' ? brand[300] : brand[700]) }}>YOUR BUSINESS. CONNECTED.</Typography>
        <Typography component="h2" sx={{ fontSize: { lg: '3.5rem', xl: '4.5rem' }, fontWeight: 650, letterSpacing: '-0.055em', lineHeight: 1.08, mt: 2, mb: 3 }}>
          Less switching.<br /><Box component="span" sx={{ color: (t) => (t.palette.mode === 'dark' ? brand[200] : brand[700]) }}>More growing.</Box>
        </Typography>
        <Typography sx={{ color: (t) => (t.palette.mode === 'dark' ? brand[100] : neutral[700]), maxWidth: 440, fontSize: '1.0625rem' }}>Bring your conversations, customers and everyday work into one calm, connected workspace.</Typography>
        <Stack spacing={2} sx={{ mt: 5 }}>
          {[[ForumRoundedIcon, 'Every conversation, in one place'], [PeopleAltRoundedIcon, 'A clearer picture of every customer'], [BoltRoundedIcon, 'More time for the work that matters']].map(([Icon, label]) => (
            <Stack key={label} direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ width: 40, height: 40, bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : brand[200]), borderRadius: 2, display: 'grid', placeItems: 'center', color: (t) => (t.palette.mode === 'dark' ? brand[200] : brand[800]) }}><Icon fontSize="small" /></Box>
              <Typography variant="body2">{label}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
      <Typography variant="caption" sx={{ color: (t) => (t.palette.mode === 'dark' ? brand[300] : brand[700]), display: { xs: 'none', lg: 'block' } }}>One workspace. Built around your business.</Typography>
    </Stack>
  );
}
