import { Alert, Box, Chip, Container, Paper, Stack, Typography } from '@mui/material';
import { connectDB } from '@/lib/db/mongo';
import { findDeletionRequest } from '@/lib/services/dataDeletionService';

/**
 * The status URL returned to Meta alongside a confirmation code.
 *
 * Meta's contract is that the code can be looked up afterwards, so this page
 * has to exist for the callback to be honest. It is deliberately thin: the
 * code is the only thing presented, and nothing about the person it belonged
 * to is shown — a page that echoed an email address or phone number back to
 * whoever guessed a code would leak exactly what the deletion removed.
 */
export const dynamic = 'force-dynamic';

const STATUS_COPY = {
  completed: {
    severity: 'success',
    title: 'Deletion completed',
    body: 'Everything held for this account has been permanently deleted — messages, contacts, connected WhatsApp numbers and their access tokens, API keys and webhook destinations. Nothing remains to restore.',
  },
  no_account_found: {
    severity: 'info',
    title: 'Nothing was held for this account',
    body: 'The request was received and processed. No account matched it, so there was no data to delete.',
  },
  failed: {
    severity: 'error',
    title: 'Deletion did not complete',
    body: 'The request was recorded but could not be completed. Contact support quoting this code and it will be finished by hand.',
  },
};

export default async function DataDeletionStatusPage({ searchParams }) {
  const params = await searchParams;
  const code = String(params?.code || '').trim();

  let request = null;
  if (code) {
    try {
      await connectDB();
      request = await findDeletionRequest(code);
    } catch {
      request = null;
    }
  }

  const copy = request ? STATUS_COPY[request.status] || STATUS_COPY.failed : null;

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        Data deletion status
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        Look up a deletion request using the confirmation code you were given.
      </Typography>

      <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
        {!code ? (
          <Alert severity="info">
            Add your confirmation code to the address of this page, as{' '}
            <code>?code=your-code</code>.
          </Alert>
        ) : !request ? (
          <Alert severity="warning">
            No deletion request matches the code <strong>{code}</strong>. Check it for typing
            mistakes, or contact support.
          </Alert>
        ) : (
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Confirmation code
              </Typography>
              <Chip label={request.confirmationCode} sx={{ fontFamily: 'monospace' }} />
            </Box>

            <Alert severity={copy.severity}>
              <Typography fontWeight={700} gutterBottom>
                {copy.title}
              </Typography>
              {copy.body}
            </Alert>

            {request.completedAt ? (
              <Typography variant="body2" color="text.secondary">
                Completed {new Date(request.completedAt).toUTCString()}
              </Typography>
            ) : null}
          </Stack>
        )}
      </Paper>
    </Container>
  );
}
