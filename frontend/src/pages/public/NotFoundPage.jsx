import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Container, Typography, Button, Stack } from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

export default function NotFoundPage() {
  return (
    <Container maxWidth="sm" sx={{ py: { xs: 10, md: 16 }, textAlign: 'center' }}>
      <WhatsAppIcon sx={{ color: 'primary.main', fontSize: 48, mb: 2 }} />
      <Typography variant="h3" fontWeight={900} sx={{ mb: 1 }}>404</Typography>
      <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
        This page doesn't exist.
      </Typography>
      <Stack direction="row" spacing={1.5} justifyContent="center">
        <Button component={RouterLink} to="/" variant="contained">Go home</Button>
        <Button component={RouterLink} to="/login" variant="outlined">Log in</Button>
      </Stack>
    </Container>
  );
}
