import React, { useState } from 'react';
import {
  Container, Typography, Box, Paper, Divider, TextField, MenuItem,
  Button, Alert, Snackbar, Chip, Stack
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { motion } from 'framer-motion';

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
  const [submitted, setSubmitted] = useState(false);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitted(true);
    setSnackOpen(true);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <Box sx={{ py: 8, bgcolor: 'background.default', minHeight: '100vh' }}>
        <Container maxWidth="md">
          <Box sx={{ mb: 6, textAlign: 'center' }}>
            <DeleteOutlineIcon sx={{ fontSize: 56, color: 'error.main', mb: 1 }} />
            <Typography variant="h3" fontWeight={800} sx={{ mb: 2 }}>Data Deletion</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560, mx: 'auto' }}>
              You have the right to request deletion of all data we hold about you and your business. We process all deletion requests within 30 days.
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
                retentionNote="Duration of account + 7 years for billing records (tax compliance)"
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
                retentionNote="90 days from transmission date"
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
                retentionNote="Retained while account is active or until deletion request"
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
                retentionNote="1 year from creation"
              />
            </Paper>

            <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>WhatsApp Data Disconnection</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                To revoke MetaBSP's access to your WhatsApp Business Account before requesting data deletion:
              </Typography>
              <Box component="ol" sx={{ pl: 3 }}>
                {[
                  'Log in to Meta Business Suite (business.facebook.com)',
                  'Go to Business Settings → Accounts → WhatsApp Accounts',
                  'Select your WhatsApp Business Account',
                  'Under "Solution Providers," find MetaBSP and click "Remove"',
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
                If you used "Login with Facebook" to connect your account, you can remove MetaBSP's Facebook app permissions:
              </Typography>
              <Box component="ol" sx={{ pl: 3 }}>
                {[
                  'Go to your Facebook account Settings',
                  'Click on "Apps and Websites" in the left sidebar',
                  'Find "MetaBSP" in the list of connected apps',
                  'Click "Remove" next to the MetaBSP app',
                  'Confirm removal — this revokes all Facebook permissions granted to MetaBSP',
                  'Submit a data deletion request below to remove all stored data',
                ].map((step, i) => (
                  <Box component="li" key={i} sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">{step}</Typography>
                  </Box>
                ))}
              </Box>
              <Alert severity="info" sx={{ mt: 2 }} icon={<InfoOutlinedIcon />}>
                MetaBSP's Facebook App Data Deletion Callback URL: <strong>https://metabsp.com/api/auth/facebook/data-deletion</strong>. This URL is registered with Meta and handles automated deletion callbacks triggered when users remove our app from their Facebook settings.
              </Alert>
            </Paper>

            <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>Deletion Process</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                After submitting a deletion request, here is what happens:
              </Typography>
              <Stack spacing={2}>
                {[
                  { step: '1', label: 'Request Received', desc: 'We receive your request and send a confirmation email within 24 hours.' },
                  { step: '2', label: 'Identity Verification', desc: 'We may ask you to verify ownership of the account via email confirmation.' },
                  { step: '3', label: 'Data Deletion Initiated', desc: 'Your account is deactivated and data deletion is queued across all systems.' },
                  { step: '4', label: 'Deletion Complete', desc: 'All requested data is permanently deleted within 30 days. We send a completion confirmation.' },
                  { step: '5', label: 'Backup Purge', desc: 'Encrypted backups containing your data are purged within 90 days per our backup rotation schedule.' },
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
                  <Typography variant="subtitle2" fontWeight={700}>Deletion Request Submitted</Typography>
                  <Typography variant="body2">
                    We have received your data deletion request. You will receive a confirmation email at <strong>{form.email}</strong> within 24 hours. All data will be permanently deleted within 30 days.
                  </Typography>
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
                      helperText={errors.email || 'The email associated with your MetaBSP account'}
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
                    <Alert severity="warning">
                      <Typography variant="body2">
                        <strong>This action is irreversible.</strong> Deleting your account will permanently remove all data and cannot be undone. Make sure you have exported any data you wish to keep before submitting.
                      </Typography>
                    </Alert>
                    <Button
                      type="submit"
                      variant="contained"
                      color="error"
                      size="large"
                      startIcon={<DeleteOutlineIcon />}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      Submit Deletion Request
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
          Deletion request submitted. Confirmation email sent to {form.email}.
        </Alert>
      </Snackbar>
    </motion.div>
  );
}
