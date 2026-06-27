import React, { useState } from 'react';
import {
  Container, Typography, Box, Paper, Grid, TextField, Button,
  MenuItem, Alert, Snackbar, Stack, Divider, Link
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import GitHubIcon from '@mui/icons-material/GitHub';
import TwitterIcon from '@mui/icons-material/Twitter';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import SendIcon from '@mui/icons-material/Send';
import { Link as RouterLink } from 'react-router-dom';
import { motion } from 'framer-motion';

const SUBJECTS = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'sales', label: 'Sales & Pricing' },
  { value: 'technical', label: 'Technical Support' },
  { value: 'billing', label: 'Billing Question' },
  { value: 'partnership', label: 'Partnership Opportunity' },
  { value: 'security', label: 'Security Issue' },
  { value: 'other', label: 'Other' },
];

const ContactInfo = ({ icon, label, value, href }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
    <Box sx={{ color: 'primary.main', mt: 0.25 }}>{icon}</Box>
    <Box>
      <Typography variant="caption" color="text.disabled" display="block">{label}</Typography>
      {href ? (
        <Link href={href} color="primary" underline="hover">
          <Typography variant="body1" fontWeight={600}>{value}</Typography>
        </Link>
      ) : (
        <Typography variant="body1" fontWeight={600}>{value}</Typography>
      )}
    </Box>
  </Box>
);

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [errors, setErrors] = useState({});
  const [snackOpen, setSnackOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Valid email required';
    if (!form.subject) errs.subject = 'Please select a subject';
    if (!form.message.trim() || form.message.trim().length < 10) errs.message = 'Message must be at least 10 characters';
    return errs;
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors((prev) => ({ ...prev, [e.target.name]: undefined }));
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
        <Container maxWidth="lg">
          <Box sx={{ mb: 8, textAlign: 'center' }}>
            <Typography variant="h3" fontWeight={800} sx={{ mb: 2 }}>Get in Touch</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500, mx: 'auto' }}>
              Have a question, need support, or want to discuss a partnership? We'd love to hear from you.
            </Typography>
          </Box>

          <Grid container spacing={5}>
            <Grid item xs={12} md={4}>
              <Stack spacing={4}>
                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Contact Information</Typography>
                  <ContactInfo
                    icon={<EmailIcon />}
                    label="General Support"
                    value="support@metabsp.com"
                    href="mailto:support@metabsp.com"
                  />
                  <ContactInfo
                    icon={<SupportAgentIcon />}
                    label="Sales Inquiries"
                    value="sales@metabsp.com"
                    href="mailto:sales@metabsp.com"
                  />
                  <ContactInfo
                    icon={<EmailIcon />}
                    label="Security Issues"
                    value="security@metabsp.com"
                    href="mailto:security@metabsp.com"
                  />
                  <ContactInfo
                    icon={<EmailIcon />}
                    label="Privacy Requests"
                    value="privacy@metabsp.com"
                    href="mailto:privacy@metabsp.com"
                  />
                </Box>

                <Divider />

                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Follow Us</Typography>
                  <Stack direction="row" spacing={1.5}>
                    <Button variant="outlined" size="small" startIcon={<TwitterIcon />} href="https://twitter.com" target="_blank">
                      Twitter
                    </Button>
                    <Button variant="outlined" size="small" startIcon={<LinkedInIcon />} href="https://linkedin.com" target="_blank">
                      LinkedIn
                    </Button>
                    <Button variant="outlined" size="small" startIcon={<GitHubIcon />} href="https://github.com" target="_blank">
                      GitHub
                    </Button>
                  </Stack>
                </Box>

                <Divider />

                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <HelpOutlineIcon sx={{ color: 'primary.main' }} />
                    <Typography variant="subtitle2" fontWeight={700}>Looking for quick answers?</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Check our Help Center — it covers most common questions about WhatsApp setup, templates, billing, and the API.
                  </Typography>
                  <Button
                    component={RouterLink}
                    to="/help"
                    variant="contained"
                    color="primary"
                    size="small"
                    fullWidth
                  >
                    Visit Help Center
                  </Button>
                </Paper>
              </Stack>
            </Grid>

            <Grid item xs={12} md={8}>
              <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                {submitted ? (
                  <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                      <SendIcon sx={{ fontSize: 56, color: 'primary.main', mb: 2 }} />
                      <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>Message Sent!</Typography>
                      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                        Thanks for reaching out, <strong>{form.name}</strong>. We've received your message and will reply to <strong>{form.email}</strong> within 24 hours.
                      </Typography>
                      <Button variant="outlined" onClick={() => { setForm({ name: '', email: '', subject: '', message: '' }); setSubmitted(false); }}>
                        Send Another Message
                      </Button>
                    </Box>
                  </motion.div>
                ) : (
                  <>
                    <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>Send Us a Message</Typography>
                    <Box component="form" onSubmit={handleSubmit}>
                      <Grid container spacing={2.5}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Full Name"
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            error={!!errors.name}
                            helperText={errors.name}
                            fullWidth
                            required
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Email Address"
                            name="email"
                            type="email"
                            value={form.email}
                            onChange={handleChange}
                            error={!!errors.email}
                            helperText={errors.email}
                            fullWidth
                            required
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            select
                            label="Subject"
                            name="subject"
                            value={form.subject}
                            onChange={handleChange}
                            error={!!errors.subject}
                            helperText={errors.subject}
                            fullWidth
                            required
                          >
                            {SUBJECTS.map((opt) => (
                              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            label="Message"
                            name="message"
                            value={form.message}
                            onChange={handleChange}
                            error={!!errors.message}
                            helperText={errors.message || `${form.message.length} characters`}
                            multiline
                            rows={6}
                            fullWidth
                            required
                            placeholder="Describe your question or issue in as much detail as possible..."
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <Alert severity="info" sx={{ mb: 2 }}>
                            For urgent technical issues affecting live production systems, please include your Account ID and a description of the impact.
                          </Alert>
                          <Button
                            type="submit"
                            variant="contained"
                            color="primary"
                            size="large"
                            endIcon={<SendIcon />}
                          >
                            Send Message
                          </Button>
                        </Grid>
                      </Grid>
                    </Box>
                  </>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Snackbar
        open={snackOpen}
        autoHideDuration={5000}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSnackOpen(false)}>
          Message sent successfully! We'll get back to you within 24 hours.
        </Alert>
      </Snackbar>
    </motion.div>
  );
}
