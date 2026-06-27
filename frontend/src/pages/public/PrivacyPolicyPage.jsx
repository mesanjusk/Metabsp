import React from 'react';
import { Container, Typography, Box, Paper, Divider, Link } from '@mui/material';
import { motion } from 'framer-motion';
import { Link as RouterLink } from 'react-router-dom';

const Section = ({ title, children }) => (
  <Box sx={{ mb: 4 }}>
    <Typography variant="h5" fontWeight={700} sx={{ mb: 1.5, color: 'text.primary' }}>{title}</Typography>
    {children}
  </Box>
);

const Para = ({ children }) => (
  <Typography variant="body1" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.8 }}>
    {children}
  </Typography>
);

const BulletList = ({ items }) => (
  <Box component="ul" sx={{ pl: 3, mb: 1.5 }}>
    {items.map((item, i) => (
      <Box component="li" key={i} sx={{ mb: 0.5 }}>
        <Typography variant="body1" color="text.secondary">{item}</Typography>
      </Box>
    ))}
  </Box>
);

export default function PrivacyPolicyPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <Box sx={{ py: 8, bgcolor: 'background.default', minHeight: '100vh' }}>
        <Container maxWidth="md">
          <Box sx={{ mb: 6, textAlign: 'center' }}>
            <Typography variant="h3" fontWeight={800} sx={{ mb: 2 }}>Privacy Policy</Typography>
            <Typography variant="body1" color="text.secondary">Last updated: June 2025</Typography>
          </Box>

          <Paper elevation={0} sx={{ p: { xs: 3, md: 6 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Para>
              MetaBSP ("we," "us," or "our") is a WhatsApp Business Solution Provider authorized by Meta Platforms, Inc. This Privacy Policy explains how we collect, use, disclose, and safeguard information when you use our platform, including our website and API services.
            </Para>

            <Divider sx={{ my: 4 }} />

            <Section title="1. Information We Collect">
              <Para>We collect several categories of information to provide and improve our services:</Para>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Business Information</Typography>
              <BulletList items={[
                'Business name, legal entity type, and registration details',
                'Business phone numbers registered with WhatsApp Business',
                'Business verification documents submitted to Meta',
                'Tax identification numbers (where required)',
                'Billing information and payment method details',
              ]} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>WhatsApp Data</Typography>
              <BulletList items={[
                'WhatsApp Business Account (WABA) ID and associated phone number IDs',
                'Message templates submitted and their approval status',
                'Message delivery receipts and read receipts',
                'Webhook event payloads received from Meta',
                'Message content you send through our API (temporarily cached)',
                'Business profile information (name, description, website, address)',
              ]} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Contact and End-User Data</Typography>
              <BulletList items={[
                'Phone numbers of contacts you message through our platform',
                'Contact display names (if provided)',
                'Opt-in and opt-out records for your messaging campaigns',
                'Message history between your business and its customers',
              ]} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Technical Data</Typography>
              <BulletList items={[
                'IP addresses and geolocation data',
                'Browser type, version, and operating system',
                'API request logs including endpoints accessed and response codes',
                'Authentication tokens and session identifiers',
                'Device identifiers for mobile access',
              ]} />
            </Section>

            <Section title="2. How We Use WhatsApp Data">
              <Para>WhatsApp data processed through our platform is used strictly to provide the services you have subscribed to:</Para>
              <BulletList items={[
                'Facilitating the sending and receiving of WhatsApp messages on your behalf',
                'Storing message templates and managing their submission to Meta for approval',
                'Processing webhook events from Meta and routing them to your configured endpoints',
                'Generating analytics and delivery reports for your messaging campaigns',
                'Troubleshooting delivery failures and API errors',
                'Maintaining audit logs for compliance and security purposes',
              ]} />
              <Para>We do not use message content for advertising purposes, and we do not sell WhatsApp message data to third parties. Access to message content is strictly limited to authorized personnel for support and debugging purposes, subject to access controls and audit logging.</Para>
            </Section>

            <Section title="3. How User Consent is Collected">
              <Para>As a WhatsApp Business Solution Provider, we require all businesses using our platform to comply with WhatsApp's Business Policy and Messaging Policy, which mandate that businesses obtain explicit opt-in consent from end users before messaging them.</Para>
              <Para>Businesses using MetaBSP are responsible for:</Para>
              <BulletList items={[
                'Obtaining clear, affirmative consent from contacts before sending them WhatsApp messages',
                'Clearly disclosing the nature and frequency of messages at the point of opt-in',
                'Providing a simple mechanism for contacts to opt out at any time',
                'Maintaining records of consent for audit purposes',
                'Honoring opt-out requests promptly (within 24 hours)',
              ]} />
              <Para>MetaBSP provides tools to help businesses manage opt-in/opt-out records, but ultimate responsibility for consent compliance lies with the business using our platform.</Para>
            </Section>

            <Section title="4. Data Retention">
              <Para>We retain different categories of data for different periods based on business necessity and legal requirements:</Para>
              <BulletList items={[
                'Message content: 90 days from the date of transmission, then permanently deleted',
                'Contact phone numbers and opt-in records: Retained indefinitely while your account is active, or until you request deletion',
                'API request logs and webhook logs: 1 year from the date of the request',
                'Account information and billing records: Duration of your account plus 7 years for tax compliance',
                'Message delivery receipts: 1 year from transmission date',
                'Template submission history: Duration of your account',
                'Security and audit logs: 2 years',
              ]} />
              <Para>You may request early deletion of your data at any time. See Section 8 for details on how to request data deletion.</Para>
            </Section>

            <Section title="5. Data Encryption and Security">
              <Para>We implement industry-standard security measures to protect your data:</Para>
              <BulletList items={[
                'AES-256 encryption for all data at rest, including databases and file storage',
                'TLS 1.3 for all data in transit between your systems, our platform, and Meta\'s APIs',
                'Encrypted storage of API keys, access tokens, and webhook secrets',
                'Database encryption at the disk level using AES-256',
                'Encrypted backups stored in geographically separate locations',
              ]} />
            </Section>

            <Section title="6. Data Sharing and Disclosure">
              <Para>We share your information only in the following circumstances:</Para>
              <BulletList items={[
                'With Meta Platforms, Inc. as required to operate the WhatsApp Business API',
                'With your designated webhook endpoints as configured in your account',
                'With payment processors for billing purposes (we do not store full card numbers)',
                'With cloud infrastructure providers (AWS/GCP) who process data under our instructions',
                'When required by law, court order, or government request',
                'With your explicit consent for any other purpose',
              ]} />
            </Section>

            <Section title="7. Your Rights – GDPR and CCPA">
              <Para>Depending on your jurisdiction, you may have the following rights regarding your personal data:</Para>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>GDPR (EU/EEA Residents)</Typography>
              <BulletList items={[
                'Right to access your personal data',
                'Right to rectification of inaccurate data',
                'Right to erasure ("right to be forgotten")',
                'Right to restriction of processing',
                'Right to data portability',
                'Right to object to processing',
                'Right to withdraw consent at any time',
              ]} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>CCPA (California Residents)</Typography>
              <BulletList items={[
                'Right to know what personal information is collected about you',
                'Right to delete personal information',
                'Right to opt-out of the sale of personal information (we do not sell personal information)',
                'Right to non-discrimination for exercising your rights',
              ]} />
              <Para>To exercise these rights, contact us at privacy@metabsp.com or submit a request through our data deletion page.</Para>
            </Section>

            <Section title="8. How to Delete Your Data">
              <Para>
                You can request deletion of your data at any time by visiting our{' '}
                <Link component={RouterLink} to="/data-deletion" color="primary">Data Deletion page</Link>.
                Upon receiving a valid deletion request, we will:
              </Para>
              <BulletList items={[
                'Permanently delete your account data within 30 days',
                'Remove all message content and contact data',
                'Revoke all API keys and access tokens',
                'Send a confirmation email when deletion is complete',
              ]} />
            </Section>

            <Section title="9. How Businesses Revoke Access">
              <Para>Businesses can revoke MetaBSP's access to their WhatsApp Business Account at any time by:</Para>
              <BulletList items={[
                'Navigating to Meta Business Suite → Business Settings → Connected Apps and removing MetaBSP',
                'Visiting Facebook Settings → Business Integrations and removing the MetaBSP integration',
                'Contacting our support team at support@metabsp.com to initiate immediate access revocation',
                'Deleting your MetaBSP account through the Account Settings page',
              ]} />
              <Para>Upon revocation, we will cease processing any new WhatsApp data within 24 hours and will retain historical data per our retention schedule unless a deletion request is submitted.</Para>
            </Section>

            <Section title="10. Cookies">
              <Para>
                We use cookies and similar tracking technologies. For detailed information, please see our{' '}
                <Link component={RouterLink} to="/cookie-policy" color="primary">Cookie Policy</Link>.
              </Para>
            </Section>

            <Section title="11. Children's Privacy">
              <Para>Our platform is intended for business use and is not directed at individuals under the age of 18. We do not knowingly collect personal information from minors.</Para>
            </Section>

            <Section title="12. Changes to This Policy">
              <Para>We may update this Privacy Policy periodically. We will notify you of material changes by email and by posting the updated policy on this page with a revised "Last updated" date. Your continued use of our services after changes constitute acceptance of the updated policy.</Para>
            </Section>

            <Section title="13. Contact Us">
              <Para>For privacy-related inquiries, please contact our Data Protection Officer:</Para>
              <BulletList items={[
                'Email: privacy@metabsp.com',
                'Subject line: Privacy Inquiry – [Your Name/Company]',
                'Response time: Within 72 hours for routine inquiries, 30 days for formal GDPR/CCPA requests',
              ]} />
            </Section>
          </Paper>
        </Container>
      </Box>
    </motion.div>
  );
}
