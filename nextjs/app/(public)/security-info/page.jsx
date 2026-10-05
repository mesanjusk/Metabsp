'use client';

import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Chip,
  Divider,
  Stack,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import ShieldIcon from '@mui/icons-material/Shield';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import HttpsIcon from '@mui/icons-material/Https';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import BugReportIcon from '@mui/icons-material/BugReport';
import { motion } from 'framer-motion';

const SecurityCard = ({ icon, title, children }) => (
  <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
      <Box sx={{ color: 'primary.main' }}>{icon}</Box>
      <Typography variant="h6" fontWeight={700}>{title}</Typography>
    </Box>
    {children}
  </Paper>
);

const Para = ({ children }) => (
  <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.8 }}>
    {children}
  </Typography>
);

const BulletList = ({ items }) => (
  <Box component="ul" sx={{ pl: 2.5, mb: 0 }}>
    {items.map((item) => (
      <Box component="li" key={item} sx={{ mb: 0.5 }}>
        <Typography variant="body2" color="text.secondary">{item}</Typography>
      </Box>
    ))}
  </Box>
);

export default function SecurityPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <Box sx={{ py: { xs: 5, md: 8 }, bgcolor: 'background.default', minHeight: '100dvh' }}>
        <Container maxWidth="lg">
          <Box sx={{ mb: 5, textAlign: 'center' }}>
            <ShieldIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h3" fontWeight={800} sx={{ mb: 2 }}>Security at SK Digital</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 720, mx: 'auto' }}>
              This page describes controls that are implemented in the current product. We deliberately avoid claiming certifications, audit results or security controls that the deployed system cannot prove.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap sx={{ mb: 4 }}>
            <Chip label="Official WhatsApp Cloud API" color="primary" variant="outlined" />
            <Chip label="AES-256-GCM token encryption" color="primary" variant="outlined" icon={<LockIcon />} />
            <Chip label="Nonce-based CSP" color="primary" variant="outlined" icon={<HttpsIcon />} />
            <Chip label="No SOC 2 certification claimed" variant="outlined" />
          </Stack>

          <Divider sx={{ mb: 5 }} />

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <SecurityCard icon={<LockIcon />} title="Sensitive token encryption">
                <Para>WhatsApp access tokens stored by the application are encrypted with AES-256-GCM before they are written to the database.</Para>
                <BulletList items={[
                  'A 32-byte application encryption key is required by the server.',
                  'Authenticated encryption uses a fresh random IV and authentication tag.',
                  'A previous key can be configured so key rotation does not strand existing encrypted tokens.',
                  'This claim applies to sensitive values protected by the application encryption helper; it is not a claim that every database field is application-level AES encrypted.',
                ]} />
              </SecurityCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <SecurityCard icon={<VpnKeyIcon />} title="API credentials">
                <Para>Customer API keys are designed so a database copy does not expose reusable plaintext credentials.</Para>
                <BulletList items={[
                  'General API keys are stored as SHA-256 hashes and the plaintext is shown only when the key is created.',
                  'Only a short non-secret prefix is retained for identification in the dashboard.',
                  'BUSY integrations use a separate send-only credential scope rather than a general API credential.',
                  'Credentials can be revoked from the platform.',
                ]} />
              </SecurityCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <SecurityCard icon={<HttpsIcon />} title="Browser and transport protections">
                <Para>The web application sends security headers and a per-request Content Security Policy intended to reduce common browser-side attack paths.</Para>
                <BulletList items={[
                  'Per-request CSP nonce with strict-dynamic for production scripts.',
                  'HSTS, clickjacking protection, MIME-sniffing protection and a restrictive referrer policy are configured.',
                  'Cross-origin access is explicit: the public machine API and the signed-in dashboard have different CORS policies.',
                  'The production service is expected to be served over HTTPS by the hosting platform.',
                ]} />
              </SecurityCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <SecurityCard icon={<ShieldIcon />} title="Webhook and callback verification">
                <Para>Provider callbacks and customer webhook deliveries have cryptographic verification paths rather than relying only on a secret URL.</Para>
                <BulletList items={[
                  'Meta webhook signatures are verified before trusted processing when enforcement is enabled.',
                  'Customer webhook destinations receive an HMAC-SHA256 signature derived from their endpoint secret.',
                  'Meta data-deletion callbacks verify Meta’s signed_request before identifying and deleting provider-linked data.',
                  'Invalid signed deletion callbacks are rejected instead of being treated as successful.',
                ]} />
              </SecurityCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <SecurityCard icon={<ShieldIcon />} title="Authentication and rate limits">
                <Para>Authorization is enforced by server-side route handlers. UI visibility is not treated as the security boundary.</Para>
                <BulletList items={[
                  'Signed-in API routes validate the bearer session on the server.',
                  'Admin-only APIs perform an additional server-side role check.',
                  'Authentication and authenticated request limits use Redis-backed counters with endpoint/user scopes.',
                  'During a Redis failure the limiter currently fails open for availability; this behavior is documented rather than presented as absolute brute-force prevention.',
                ]} />
              </SecurityCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <SecurityCard icon={<DeleteOutlineRoundedIcon />} title="Deletion and data handling">
                <Para>Deletion behavior is implemented as an operational path, not only a policy statement.</Para>
                <BulletList items={[
                  'A signed Meta data-deletion callback is implemented.',
                  'Deletion requests receive a confirmation code and status URL.',
                  'Data-retention automation exists and is deployment-configurable; launch readiness must verify the configured retention windows match the published privacy policy.',
                  'Customers can revoke platform credentials and connected integrations independently.',
                ]} />
              </SecurityCard>
            </Grid>
          </Grid>

          <Paper elevation={0} sx={{ mt: 5, p: { xs: 3, md: 4 }, borderRadius: 3, border: '1px solid', borderColor: 'warning.main', bgcolor: 'action.hover' }}>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>Certification status</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              SK Digital does not claim SOC 2, ISO 27001, PCI DSS or another independent security certification on this page. If a certification or third-party audit is completed later, it should be published here only with verifiable scope and dates.
            </Typography>
          </Paper>

          <Paper elevation={0} sx={{ mt: 3, p: { xs: 3, md: 4 }, borderRadius: 3, border: '2px solid', borderColor: 'primary.main', bgcolor: 'action.hover' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <BugReportIcon sx={{ color: 'primary.main', fontSize: 32 }} />
              <Typography variant="h5" fontWeight={700}>Responsible disclosure</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.8 }}>
              If you discover a security issue, report it privately with the affected URL or feature, reproduction steps and potential impact. Please do not include unnecessary customer data in the report.
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body1">Email: <strong>security@meta.sanjusk.in</strong></Typography>
          </Paper>
        </Container>
      </Box>
    </motion.div>
  );
}
