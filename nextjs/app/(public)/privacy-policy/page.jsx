'use client';

import React from 'react';
import { Container, Typography, Box, Paper, Divider, Link } from '@mui/material';
import { motion } from 'framer-motion';
import NextLink from 'next/link';
const Section = ({ title, children }) => (
  <Box sx={{ mb: 4 }}>
    <Typography variant="h5" fontWeight={700} sx={{ mb: 1.5, color: 'text.primary' }}>{title}</Typography>
    {children}
  </Box>
);

const SubHeading = ({ children }) => (
  <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 2, mb: 1 }}>
    {children}
  </Typography>
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
            <Typography variant="body1" color="text.secondary">Last updated: October 5, 2026</Typography>
          </Box>

          <Paper elevation={0} sx={{ p: { xs: 3, md: 6 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Para>
              Mahi Creation operates the SK Digital platform ("SK Digital," "we," "us," or "our"). SK Digital includes customer communication and business-growth tools, with WhatsApp messaging built on Meta&apos;s official WhatsApp Business Platform (Cloud API). This Privacy Policy explains how we collect, use, disclose, and safeguard information when you use our platform, including our website and API services.
            </Para>

            <Divider sx={{ my: 4 }} />

            <Section title="1. Information We Collect">
              <Para>We collect several categories of information to provide and improve our services:</Para>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Business Information</Typography>
              <BulletList items={[
                'Business name, legal entity type, and registration details',
                'Business phone numbers registered with WhatsApp Business',
                'Business verification information you choose to provide or connect for supported provider workflows',
                'Tax or billing identifiers when you provide them for an enabled billing or compliance feature',
                'Billing and subscription information used by enabled billing features; payment credentials handled directly by a payment provider are not represented here as if we store full card or bank credentials',
              ]} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>WhatsApp Data</Typography>
              <BulletList items={[
                'WhatsApp Business Account (WABA) ID and associated phone number IDs',
                'Message templates submitted and their approval status',
                'Message delivery receipts and read receipts',
                'Webhook event payloads received from Meta',
                'Message content processed through the platform and, where the feature requires it, stored in message history subject to the configured retention settings',
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
                'IP addresses used for security, abuse prevention and rate limiting where available',
                'Browser type, version, and operating system',
                'API request logs including endpoints accessed and response codes',
                'Authentication tokens and session identifiers',
                'Browser and device information supplied by the client where available',
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
              <Para>Because SK Digital integrates with Meta's official WhatsApp Business Platform, businesses using WhatsApp features must comply with WhatsApp's Business Policy and Messaging Policy, including the applicable consent and messaging requirements.</Para>
              <Para>Businesses using SK Digital are responsible for:</Para>
              <BulletList items={[
                'Obtaining clear, affirmative consent from contacts before sending them WhatsApp messages',
                'Clearly disclosing the nature and frequency of messages at the point of opt-in',
                'Providing a simple mechanism for contacts to opt out at any time',
                'Maintaining records of consent for audit purposes',
                'Honoring opt-out requests promptly (within 24 hours)',
              ]} />
              <Para>SK Digital provides tools to help businesses manage opt-in/opt-out records, but ultimate responsibility for consent compliance lies with the business using our platform.</Para>
            </Section>

            <Section title="4. Data Retention">
              <Para>
                The application has automated retention controls for messages, inactive contacts and audit logs, but the
                retention windows are deployment-configurable rather than hard-coded. If no retention window is configured,
                those records are not automatically expired by the retention scheduler.
              </Para>
              <BulletList items={[
                'Message, contact and audit-log retention windows are controlled by the deployment configuration.',
                'Account and billing records may be retained where required to provide the service or meet applicable accounting and legal obligations.',
                'A verified deletion request removes the account-owned live data covered by our deletion service, including messages, contacts, connected accounts, API keys, webhooks, automations and SMB records.',
                'A minimal deletion-request record may be retained to evidence that the request was received and processed.',
                'Backup retention depends on the backup system actually enabled for the deployment; we do not promise a fixed backup purge period unless it is configured and published.',
              ]} />
              <Para>You may request deletion of your account data at any time. See Section 8 for details.</Para>
            </Section>

            <Section title="5. Data Encryption and Security">
              <Para>We publish only controls that are implemented by the current application or its production transport:</Para>
              <BulletList items={[
                'WhatsApp access tokens and values passed through the sensitive-value helper are encrypted with application-layer AES-256-GCM.',
                'Customer API keys are stored as one-way hashes; the plaintext key is returned only when it is created.',
                'The web application applies a nonce-based Content Security Policy and additional browser security headers.',
                'Meta callbacks and customer webhook deliveries use cryptographic signature-verification paths where applicable.',
                'Production browser and provider connections are served over HTTPS/TLS.',
              ]} />
            </Section>

            <Section title="6. Data Sharing and Disclosure">
              <Para>
                We do not sell your data or use message content for advertising. Beyond the
                sub-processors named below, we share information only when required by law, court
                order or government request, or with your explicit consent.
              </Para>

              <SubHeading>Sub-processors</SubHeading>
                <Para>
                  These are the third parties that process data on our behalf, what each one
                  receives, and why. Every one of them is bound to process it only on our
                  instructions.
                </Para>
                <BulletList items={[
                  'Meta Platforms, Inc. — message content, phone numbers and delivery status. Required to send and receive on the WhatsApp Business Platform; there is no way to operate without it.',
                  'MongoDB Atlas — the database of record: accounts, contacts, message history, and encrypted access tokens.',
                  'Cloudinary — media attachments (images, video, audio, documents) sent or received on your number, so they can be shown in the inbox after Meta expires the original.',
                  'Render — hosting and the queue that holds inbound messages between arrival and processing.',
                  'Anthropic PBC — the text of an incoming message, and only when you have switched on an AI auto-reply rule. It is sent to generate that one reply, is not used to train models, and no message reaches Anthropic while AI replies are off. Turn the rule off and this sub-processor drops out entirely.',
                ]} />

              <SubHeading>Your own endpoints</SubHeading>
                <Para>
                  Where you register a webhook destination, we also deliver your inbound messages to
                  the URL you gave us. What happens to them after that is governed by your own
                  policies, not this one.
                </Para>
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
              <Para>To exercise an applicable privacy right, contact us at privacy@meta.sanjusk.in or submit a request through our data deletion page. We will verify and process requests according to the law that applies to the requester and the data involved.</Para>
            </Section>

            <Section title="8. How to Delete Your Data">
              <Para>
                You can request deletion of your data at any time by visiting our{' '}
                <Link component={NextLink} href="/data-deletion" color="primary">Data Deletion page</Link>.
                Upon receiving a valid deletion request, we will:
              </Para>
              <BulletList items={[
                'Record your request with a confirmation code and status page',
                'Verify the requester before destructive manual deletion',
                'Remove the account-owned live data covered by the deletion service after verification',
                'Update the request status when processing completes or requires manual follow-up',
              ]} />
            </Section>

            <Section title="9. How Businesses Revoke Access">
              <Para>Businesses can revoke SK Digital's access to their WhatsApp Business Account at any time by:</Para>
              <BulletList items={[
                'Navigating to Meta Business Suite → Business Settings → Connected Apps and removing SK Digital',
                'Visiting Facebook Settings → Business Integrations and removing the SK Digital integration',
                'Contacting our support team at support@meta.sanjusk.in to initiate immediate access revocation',
                'Deleting your SK Digital account through the Account Settings page',
              ]} />
              <Para>Revoking provider access stops future provider-authorized processing once the revocation takes effect. Historical data remains subject to the configured retention settings and any verified deletion request.</Para>
            </Section>

            <Section title="10. Cookies">
              <Para>
                We use cookies and similar tracking technologies. For detailed information, please see our{' '}
                <Link component={NextLink} href="/cookie-policy" color="primary">Cookie Policy</Link>.
              </Para>
            </Section>

            <Section title="11. Children's Privacy">
              <Para>Our platform is intended for business use and is not directed at individuals under the age of 18. We do not knowingly collect personal information from minors.</Para>
            </Section>

            <Section title="12. Changes to This Policy">
              <Para>We may update this Privacy Policy periodically. Material changes will be reflected on this page with a revised "Last updated" date and, where required by law or appropriate for the change, may also be communicated through the product or available account contact channels.</Para>
            </Section>

            <Section title="13. Contact Us">
              <Para>For privacy-related inquiries, please contact our privacy team:</Para>
              <BulletList items={[
                'Email: privacy@meta.sanjusk.in',
                'Subject line: Privacy Inquiry – [Your Name/Company]',
                'We acknowledge and process privacy requests according to the timelines required by applicable law; verification or complex requests may require additional information.',
              ]} />
            </Section>
          </Paper>
        </Container>
      </Box>
    </motion.div>
  );
}
