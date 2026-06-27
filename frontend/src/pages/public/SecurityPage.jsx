import React from 'react';
import {
  Container, Typography, Box, Paper, Grid, Chip, Divider, Stack
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import ShieldIcon from '@mui/icons-material/Shield';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import HttpsIcon from '@mui/icons-material/Https';
import HistoryIcon from '@mui/icons-material/History';
import BugReportIcon from '@mui/icons-material/BugReport';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
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
    {items.map((item, i) => (
      <Box component="li" key={i} sx={{ mb: 0.5 }}>
        <Typography variant="body2" color="text.secondary">{item}</Typography>
      </Box>
    ))}
  </Box>
);

export default function SecurityPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <Box sx={{ py: 8, bgcolor: 'background.default', minHeight: '100vh' }}>
        <Container maxWidth="lg">
          <Box sx={{ mb: 8, textAlign: 'center' }}>
            <ShieldIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h3" fontWeight={800} sx={{ mb: 2 }}>Security at MetaBSP</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
              We take the security of your data and your customers' data seriously. Here's a detailed overview of our security posture and practices.
            </Typography>
          </Box>

          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap" useFlexGap>
              <Chip label="SOC 2 Type II (In Progress)" color="warning" variant="outlined" icon={<VerifiedUserIcon />} />
              <Chip label="AES-256 Encryption" color="primary" variant="outlined" icon={<LockIcon />} />
              <Chip label="TLS 1.3" color="primary" variant="outlined" icon={<HttpsIcon />} />
              <Chip label="GDPR Compliant" color="success" variant="outlined" icon={<ShieldIcon />} />
            </Stack>
          </Box>

          <Divider sx={{ mb: 6 }} />

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <SecurityCard icon={<LockIcon />} title="Encryption at Rest">
                <Para>All data stored on MetaBSP infrastructure is encrypted using AES-256, the industry standard for data encryption at rest.</Para>
                <BulletList items={[
                  'Database encryption: AES-256 at the disk level (dm-crypt / LUKS)',
                  'Object storage (S3-compatible): SSE-AES256 server-side encryption',
                  'Database field-level encryption for sensitive fields (tokens, secrets)',
                  'Encrypted backups using the same AES-256 standard',
                  'Keys managed through a dedicated Key Management Service (KMS)',
                  'Key rotation performed every 90 days',
                ]} />
              </SecurityCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <SecurityCard icon={<HttpsIcon />} title="Encryption in Transit">
                <Para>All communications between clients and MetaBSP servers, and between our services, use TLS encryption.</Para>
                <BulletList items={[
                  'TLS 1.3 enforced for all public API endpoints',
                  'TLS 1.2 minimum (TLS 1.0 and 1.1 are disabled)',
                  'HSTS (HTTP Strict Transport Security) enabled with 1-year max-age',
                  'Certificate pinning for our mobile clients',
                  'Internal service-to-service communication uses mutual TLS (mTLS)',
                  'Webhook deliveries made over HTTPS only; HTTP endpoints rejected',
                ]} />
              </SecurityCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <SecurityCard icon={<VpnKeyIcon />} title="Token and Secret Encryption">
                <Para>WhatsApp Business API tokens and webhook secrets are among the most sensitive data we store. We apply additional protection beyond disk encryption.</Para>
                <BulletList items={[
                  'API access tokens encrypted with a separate application-layer AES-256 key',
                  'Webhook verification secrets stored in encrypted form, never in plaintext',
                  'API keys displayed only once at creation; thereafter stored as bcrypt hashes',
                  'Environment secrets managed through a secrets management vault (HashiCorp Vault)',
                  'No secrets stored in source code or environment variables in plain text',
                  'Regular automated secret scanning of our repositories',
                ]} />
              </SecurityCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <SecurityCard icon={<ShieldIcon />} title="Webhook Signature Verification">
                <Para>All webhooks delivered by MetaBSP include cryptographic signatures so you can verify they originate from our servers.</Para>
                <BulletList items={[
                  'HMAC-SHA256 signature included in the X-MetaBSP-Signature-256 header',
                  'Signatures computed using your per-endpoint webhook secret',
                  'Timestamp included to prevent replay attacks (5-minute tolerance window)',
                  'Detailed signature verification guide provided in our developer docs',
                  'Webhook secrets rotatable at any time from your dashboard',
                ]} />
              </SecurityCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <SecurityCard icon={<HistoryIcon />} title="Audit Logging">
                <Para>We maintain comprehensive audit logs of all significant actions within the platform for security investigation and compliance.</Para>
                <BulletList items={[
                  'All API calls logged with timestamp, IP address, user agent, and response code',
                  'Authentication events (login, logout, failed attempts, MFA) logged',
                  'Account changes (settings, team members, permissions) logged',
                  'API key creation, rotation, and deletion logged',
                  'Webhook configuration changes logged',
                  'Audit logs retained for 2 years',
                  'Audit logs exported in SIEM-compatible JSON format',
                ]} />
              </SecurityCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <SecurityCard icon={<ManageAccountsIcon />} title="Session Management">
                <Para>User sessions are managed securely to prevent unauthorized access.</Para>
                <BulletList items={[
                  'Session tokens generated using cryptographically secure random number generators',
                  'Sessions expire after 8 hours of inactivity',
                  'Dashboard sessions bound to the originating IP address (configurable)',
                  'Multi-factor authentication (MFA) available and encouraged for all accounts',
                  'MFA required for accounts with Admin or Owner roles',
                  'Active sessions viewable and revocable from Account Settings',
                  'All sessions invalidated on password change',
                ]} />
              </SecurityCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <SecurityCard icon={<VerifiedUserIcon />} title="IP Logging and Access Control">
                <Para>We log IP addresses for security purposes and provide tools for IP-based access restrictions.</Para>
                <BulletList items={[
                  'IP address logged for all authentication events and API calls',
                  'IP allowlist available to restrict dashboard access to specified IP ranges',
                  'Brute-force protection: accounts temporarily locked after 10 failed login attempts',
                  'Rate limiting applied to all API endpoints (configurable per plan)',
                  'Anomalous login detection with email alerts for new devices/locations',
                  'IP logs retained for 1 year',
                ]} />
              </SecurityCard>
            </Grid>

            <Grid item xs={12} md={6}>
              <SecurityCard icon={<VerifiedUserIcon />} title="SOC 2 Compliance">
                <Para>MetaBSP is actively pursuing SOC 2 Type II certification, demonstrating our commitment to enterprise-grade security controls.</Para>
                <BulletList items={[
                  'SOC 2 Type I audit: Completed Q1 2025',
                  'SOC 2 Type II audit: In progress (expected completion Q4 2025)',
                  'Covers Trust Service Criteria: Security, Availability, and Confidentiality',
                  'Annual penetration testing by a third-party security firm',
                  'Quarterly vulnerability assessments',
                  'Formal incident response plan with defined SLAs',
                  'Business continuity and disaster recovery plan maintained',
                ]} />
              </SecurityCard>
            </Grid>
          </Grid>

          <Paper
            elevation={0}
            sx={{ mt: 5, p: { xs: 3, md: 5 }, borderRadius: 3, border: '2px solid', borderColor: 'primary.main', bgcolor: 'action.hover' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <BugReportIcon sx={{ color: 'primary.main', fontSize: 32 }} />
              <Typography variant="h5" fontWeight={700}>Responsible Disclosure</Typography>
            </Box>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.8 }}>
              We believe in responsible disclosure of security vulnerabilities. If you discover a security issue in our platform, please report it to us before disclosing it publicly. We commit to:
            </Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {[
                'Acknowledge your report within 48 hours',
                'Provide an initial assessment within 7 days',
                'Work with you to understand and reproduce the issue',
                'Keep you updated on our progress',
                'Publicly credit you in our security acknowledgments (if desired)',
                'Not take legal action against good-faith security researchers',
              ].map((item, i) => (
                <Grid item xs={12} sm={6} key={i}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <VerifiedUserIcon sx={{ color: 'success.main', fontSize: 18, mt: 0.25 }} />
                    <Typography variant="body2" color="text.secondary">{item}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Security Contact</Typography>
            <Typography variant="body1">
              Email: <strong>security@metabsp.com</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Please encrypt sensitive reports using our PGP key (available on request). Include a detailed description of the vulnerability, steps to reproduce, and potential impact.
            </Typography>
          </Paper>
        </Container>
      </Box>
    </motion.div>
  );
}
