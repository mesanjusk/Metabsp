'use client';

import React, { useState } from 'react';
import {
  Container, Typography, Box, Paper, Divider, TextField, MenuItem,
  Button, Alert, Snackbar, Chip, Stack, CircularProgress
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { motion } from 'framer-motion';

// The callback URL registered in the Meta App Dashboard's Data Deletion field.
// Previously hardcoded to a third domain — different from both the live site
// and the API host — which meant this page advertised a URL that did not
// resolve. Driven from the deployment's own configuration so the page, the
// dashboard, and the running service cannot drift apart.
const DATA_DELETION_CALLBACK_URL =
  process.env.NEXT_PUBLIC_DATA_DELETION_CALLBACK_URL ||
  `${process.env.NEXT_PUBLIC_APP_URL || 'https://meta.sanjusk.in'}/api/meta/data-deletion`;

// The human-readable instructions URL, which is a different field in the Meta
// App Dashboard from the callback above. This page is that URL.
const DATA_DELETION_INSTRUCTIONS_URL =
  `${process.env.NEXT_PUBLIC_APP_URL || 'https://meta.sanjusk.in'}/data-deletion`;

const REASONS = [
  { value: 'no_longer_needed', label: 'I no longer need the service' },
  { value: 'privacy_concerns', label: 'Privacy concerns' },
  { value: 'switching_providers', label: 'Switching to another provider' },
  { value: 'business_closure', label: 'Business closing down' },
  { value: 'gdpr_request', label: 'GDPR / legal data subject request' },
  { value: 'ccpa_request', label: 'CCPA data deletion request' },
  { value: 'other', label: 'Other' },
];

const DataCategory = ({ title, items, retentionNote }) => (
  <Box sx={{ mb: 3 }}>
    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>{title}</Typography>
    <Box component="ul" sx={{ pl: 3, mb: 0.5 }}>
      {items.map((item, i) => (
        <Box component="li" key={i} sx={{ mb: 0.25 }}>
          <Typography variant="body2" color="text.secondary">{item}</Typography>
        </Box>
      ))}
    </Box>
    {retentionNote && (
      <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
        Retention: {retentionNote}
      </Typography>
    )}
  </Box>
);

export default function DataDeletionPage() {
  const [form, setForm] = useState({ email: '', accountId: '', reason: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [snackOpen, setSnackOpen] = useState(false);

  const validate = () => {
    const errs = {};
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'A valid email address is required';
    }
    if (!form.reason) {
      errs.reason = 'Please select a reason';
    }
    return errs;
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) {
      setErrors((prev) => ({ ...prev, [e.target.name]: undefined }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const response = await fetch('/api/privacy/deletion-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Could not record your deletion request.');
      }
      setSubmitted(data);
      setSnackOpen(true);
    } catch (error) {
      setSubmitError(error?.message || 'Could not record your deletion request. Please contact privacy support.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <Box sx={{ py: 8, bgcolor: 'background.default', minHeight: '100vh' }}>
        <Container maxWidth="md">
          <Box sx={{ mb: 6, textAlign: 'center' }}>
            <DeleteOutlineIcon sx={{ fontSize: 56, color: 'error.main', mb: 1 }} />
            <Typography variant="h3" fontWeight={800} sx={{ mb: 2 }}>Data Deletion</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560, mx: 'auto' }}>
              You can request deletion of data associated with your account. Manual requests are recorded with a confirmation code, then verified before destructive account data is removed.
            </Typography>
          </Box>

          <Stack spacing={4}>
            <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>What Data We Store</Typography>

              <DataCategory
                title="Account & Business Data"
                items={[
                  'Business name, email address, and contact information',
                  'WhatsApp Business Account (WABA) IDs and phone number IDs',
                  'Business verification documents and Meta Business Manager details',
                  'Billing records and payment history',
                  'User preferences and account settings',
                ]}
                retentionNote="Kept while needed for the service and applicable accounting/legal obligations; verified deletion requests remove deletable account data."
              />
              <Divider sx={{ my: 2 }} />
              <DataCategory
                title="WhatsApp Message Data"
                items={[
                  'Outgoing message content and media files you sent through our API',
                  'Incoming message content from your customers',
                  'Message delivery and read receipts',
                  'Webhook event payloads received from Meta',
                ]}
                retentionNote="Automated retention is deployment-configurable; a verified deletion request removes account-owned message records."
              />
              <Divider sx={{ my: 2 }} />
              <DataCategory
                title="Contact Data"
                items={[
                  'Phone numbers of contacts you have messaged',
                  'Contact display names (if imported)',
                  'Opt-in and opt-out consent records',
                  'Tags and segments applied to contacts',
                ]}
                retentionNote="Kept while the account is active unless a configured retention window or verified deletion request removes it."
              />
              <Divider sx={{ my: 2 }} />
              <DataCategory
                title="Technical Logs"
                items={[
                  'API request logs (endpoints, status codes, timestamps)',
                  'Webhook delivery logs',
                  'Authentication and session logs',
                  'IP addresses associated with your account activity',
                ]}
                retentionNote="Retention is deployment-configurable; security/audit records may be retained where needed to evidence security or deletion actions."
              />
            </Paper>

            <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>WhatsApp Data Disconnection</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                To revoke SK Digital's access to your WhatsApp Business Account before requesting data deletion:
              </Typography>
              <Box component="ol" sx={{ pl: 3 }}>
                {[
                  'Log in to Meta Business Suite (business.facebook.com)',
                  'Go to Business Settings → Accounts → WhatsApp Accounts',
                  'Select your WhatsApp Business Account',
                  'Under "Solution Providers," find SK Digital and click "Remove"',
                  'Confirm the removal when prompted',
                ].map((step, i) => (
                  <Box component="li" key={i} sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">{step}</Typography>
                  </Box>
                ))}
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>Facebook Login Data Deletion</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                If you used "Login with Facebook" to connect your account, you can remove SK Digital's Facebook app permissions:
              </Typography>
              <Box component="ol" sx={{ pl: 3 }}>
                {[
                  'Go to your Facebook account Settings',
                  'Click on "Apps and Websites" in the left sidebar',
                  'Find "SK Digital" in the list of connected apps',
                  'Click "Remove" next to the SK Digital app',
                  'Confirm removal — this revokes all Facebook permissions granted to SK Digital',
                  'Submit a data deletion request below to remove all stored data',
                ].map((step, i) => (
                  <Box component="li" key={i} sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">{step}</Typography>
                  </Box>
                ))}
              </Box>
              <Alert severity="info" sx={{ mt: 2 }} icon={<InfoOutlinedIcon />}>
                Two URLs are registered with Meta, and they do different jobs. The{' '}
                <strong>Data Deletion Callback URL</strong> is{' '}
                <strong>{DATA_DELETION_CALLBACK_URL}</strong> — Meta posts a signed request to it
                when someone removes SK Digital from their Facebook settings, and it deletes that
                account automatically and returns a confirmation code. The{' '}
                <strong>Data Deletion Instructions URL</strong> is{' '}
                <strong>{DATA_DELETION_INSTRUCTIONS_URL}</strong> — this page.
              </Alert>
            </Paper>

            <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>Deletion Process</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                After submitting a deletion request, here is what happens:
              </Typography>
              <Stack spacing={2}>
                {[
                  { step: '1', label: 'Request Recorded', desc: 'The platform stores your request and gives you a confirmation code and status link.' },
                  { step: '2', label: 'Identity Verification', desc: 'We verify that the requester is authorised to delete the account or data.' },
                  { step: '3', label: 'Deletion Processing', desc: 'Verified account-owned data is removed from the live application stores covered by the deletion service.' },
                  { step: '4', label: 'Status Updated', desc: 'The confirmation-code status page is updated when processing completes or if manual follow-up is required.' },
                  { step: '5', label: 'Backups', desc: 'Backup handling depends on the backup system enabled for the deployment. We do not claim a fixed backup-purge window unless one is actually configured.' },
                ].map((item) => (
                  <Box key={item.step} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                    <Chip label={item.step} color="primary" size="small" sx={{ mt: 0.25, minWidth: 28 }} />
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700}>{item.label}</Typography>
                      <Typography variant="body2" color="text.secondary">{item.desc}</Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Paper>

            <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <SecurityIcon color="error" />
                <Typography variant="h5" fontWeight={700}>Request Data Deletion</Typography>
              </Box>

              {submitted ? (
                <Alert severity="success" icon={<CheckCircleOutlineIcon />} sx={{ borderRadius: 2 }}>
                  <Typography variant="subtitle2" fontWeight={700}>Deletion request recorded</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Your request has been stored for identity verification and processing. This submission does not itself delete the account.
                  </Typography>
                  <Typography variant="body2">
                    Confirmation code: <strong>{submitted.confirmationCode}</strong>
                  </Typography>
                  {submitted.statusUrl ? (
                    <Button component="a" href={submitted.statusUrl} size="small" sx={{ mt: 1 }}>
                      Check request status
                    </Button>
                  ) : null}
                </Alert>
              ) : (
                <Box component="form" onSubmit={handleSubmit}>
                  <Stack spacing={3}>
                    <TextField
                      label="Email Address"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      error={!!errors.email}
                      helperText={errors.email || 'The email associated with your SK Digital account'}
                      fullWidth
                      required
                    />
                    <TextField
                      label="Account ID (optional)"
                      name="accountId"
                      value={form.accountId}
                      onChange={handleChange}
                      helperText="Found in your Account Settings page. Helps us locate your account faster."
                      fullWidth
                    />
                    <TextField
                      select
                      label="Reason for Deletion"
                      name="reason"
                      value={form.reason}
                      onChange={handleChange}
                      error={!!errors.reason}
                      helperText={errors.reason || 'Please select the primary reason'}
                      fullWidth
                      required
                    >
                      {REASONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      label="Additional Notes (optional)"
                      name="notes"
                      value={form.notes}
                      onChange={handleChange}
                      multiline
                      rows={3}
                      fullWidth
                      placeholder="Any specific data you want deleted, or context for your request..."
                    />
                    {submitError ? <Alert severity="error">{submitError}</Alert> : null}
                    <Alert severity="warning">
                      <Typography variant="body2">
                        <strong>Verified deletion is irreversible.</strong> Submitting this form records the request; deletion occurs only after identity verification. Export anything you need before the request is completed.
                      </Typography>
                    </Alert>
                    <Button
                      type="submit"
                      variant="contained"
                      color="error"
                      size="large"
                      startIcon={<DeleteOutlineIcon />}
                      sx={{ alignSelf: 'flex-start' }}
                      disabled={submitting}
                      endIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
                    >
                      {submitting ? 'Recording request…' : 'Submit Deletion Request'}
                    </Button>
                  </Stack>
                </Box>
              )}
            </Paper>
          </Stack>
        </Container>
      </Box>

      <Snackbar
        open={snackOpen}
        autoHideDuration={6000}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSnackOpen(false)}>
          Deletion request recorded. Keep your confirmation code to check its status.
        </Alert>
      </Snackbar>
    </motion.div>
  );
}
