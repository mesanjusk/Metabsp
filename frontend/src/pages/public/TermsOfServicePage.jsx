import React from 'react';
import { Container, Typography, Box, Paper, Divider } from '@mui/material';
import { motion } from 'framer-motion';

const Section = ({ title, children }) => (
  <Box sx={{ mb: 4 }}>
    <Typography variant="h5" fontWeight={700} sx={{ mb: 1.5 }}>{title}</Typography>
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

export default function TermsOfServicePage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <Box sx={{ py: 8, bgcolor: 'background.default', minHeight: '100vh' }}>
        <Container maxWidth="md">
          <Box sx={{ mb: 6, textAlign: 'center' }}>
            <Typography variant="h3" fontWeight={800} sx={{ mb: 2 }}>Terms of Service</Typography>
            <Typography variant="body1" color="text.secondary">Last updated: June 2025</Typography>
          </Box>

          <Paper elevation={0} sx={{ p: { xs: 3, md: 6 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Para>
              These Terms of Service ("Terms") govern your access to and use of the MetaBSP platform, including our website, APIs, and related services (collectively, the "Service"). By accessing or using our Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
            </Para>

            <Divider sx={{ my: 4 }} />

            <Section title="1. Acceptance of Terms">
              <Para>
                By creating an account, clicking "I Agree," or otherwise accessing the Service, you represent and warrant that: (a) you are at least 18 years of age; (b) you have the legal authority to enter into these Terms on behalf of yourself or the business entity you represent; and (c) your use of the Service will comply with all applicable laws and regulations.
              </Para>
              <Para>
                These Terms incorporate by reference our Privacy Policy, Cookie Policy, and any additional terms applicable to specific features of the Service. In the event of a conflict, these Terms control.
              </Para>
            </Section>

            <Section title="2. WhatsApp Business Platform Usage Requirements">
              <Para>
                MetaBSP is a WhatsApp Business Solution Provider (BSP) authorized by Meta Platforms, Inc. Your use of our Service to access the WhatsApp Business API is subject to additional requirements:
              </Para>
              <BulletList items={[
                'You must comply with Meta\'s WhatsApp Business Policy (https://www.whatsapp.com/legal/business-policy)',
                'You must comply with Meta\'s Messaging Policy (https://www.whatsapp.com/legal/messaging-policy)',
                'You must comply with WhatsApp\'s Commerce Policy where applicable',
                'You must complete Meta\'s Business Verification process before sending messages at scale',
                'Your WhatsApp Business Account must represent a legitimate, legal business entity',
                'You must not misrepresent your identity or business to Meta or to end users',
                'All message templates must be submitted for Meta\'s approval before use',
                'You must honor Meta\'s quality ratings and reduce opt-out rates to maintain messaging access',
              ]} />
              <Para>
                MetaBSP reserves the right to suspend or terminate your access if we determine, at our sole discretion, that your use violates Meta's policies, as violations may jeopardize our status as an authorized BSP.
              </Para>
            </Section>

            <Section title="3. Prohibited Uses">
              <Para>You agree not to use the Service for any of the following purposes:</Para>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Spam and Unsolicited Messaging</Typography>
              <BulletList items={[
                'Sending unsolicited commercial messages (spam) to any phone number',
                'Messaging contacts who have not provided explicit opt-in consent',
                'Sending messages at volumes that exceed WhatsApp rate limits or quality thresholds',
                'Using purchased, scraped, or otherwise illegally obtained contact lists',
                'Ignoring or delaying processing of opt-out requests',
              ]} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Illegal and Harmful Content</Typography>
              <BulletList items={[
                'Content that is illegal in the jurisdiction of the sender or recipient',
                'Child sexual abuse material (CSAM) or any content sexualizing minors',
                'Content that facilitates violence, terrorism, or hate crimes',
                'Content that defames, harasses, or threatens any individual',
                'Fraudulent content designed to deceive recipients',
                'Phishing content or content designed to steal credentials',
              ]} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>WhatsApp Policy Violations</Typography>
              <BulletList items={[
                'Sending content in categories prohibited by WhatsApp (gambling, tobacco, weapons, pharmaceuticals without authorization)',
                'Impersonating other businesses or individuals',
                'Attempting to circumvent WhatsApp rate limits or quality enforcement',
                'Using the API to enable peer-to-peer messaging not related to your business',
                'Reverse engineering or attempting to extract WhatsApp\'s underlying protocols',
              ]} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Platform Abuse</Typography>
              <BulletList items={[
                'Attempting to access accounts or data not belonging to you',
                'Introducing malware, viruses, or malicious code',
                'Conducting denial-of-service attacks against our infrastructure',
                'Using automated tools to create accounts in violation of our policies',
                'Reselling access to the MetaBSP platform without written authorization',
              ]} />
            </Section>

            <Section title="4. Account Responsibilities">
              <Para>You are responsible for:</Para>
              <BulletList items={[
                'Maintaining the confidentiality of your account credentials and API keys',
                'All activities that occur under your account, whether authorized by you or not',
                'Promptly notifying MetaBSP of any unauthorized access to your account',
                'Ensuring that all users in your organization who access the Service comply with these Terms',
                'Keeping your business and contact information accurate and up to date',
                'Maintaining adequate records of end-user consent for WhatsApp messaging',
                'Paying all fees and charges associated with your subscription plan',
              ]} />
            </Section>

            <Section title="5. Meta/WhatsApp API Usage Compliance">
              <Para>
                As an intermediary between you and Meta's WhatsApp Business API, MetaBSP must comply with Meta's Platform Terms. Accordingly:
              </Para>
              <BulletList items={[
                'We may be required to provide Meta with information about your use of the API if requested',
                'Meta may independently restrict or terminate your access to the WhatsApp API regardless of your agreement with MetaBSP',
                'Quality ratings assigned by Meta to your phone numbers affect your messaging capabilities and are outside our control',
                'Meta\'s decisions regarding template approval, business verification, and account status are final and not subject to appeal through MetaBSP',
                'We will notify you as promptly as possible of any communications we receive from Meta that affect your account',
              ]} />
            </Section>

            <Section title="6. Data Handling">
              <Para>
                Our handling of your data is governed by our Privacy Policy, which is incorporated into these Terms by reference. Key points:
              </Para>
              <BulletList items={[
                'You retain ownership of all data you input into the Service',
                'You grant MetaBSP a limited license to process your data solely to provide the Service',
                'Message content is retained for 90 days; contact data is retained while your account is active',
                'You are responsible for obtaining all necessary consents to process end-user data through our platform',
                'Upon account termination, you may request export of your data within 30 days',
              ]} />
            </Section>

            <Section title="7. Service Availability and SLA">
              <Para>
                MetaBSP strives to maintain 99.9% uptime for our API and dashboard. Planned maintenance windows will be announced at least 48 hours in advance via our Status Page and email notifications. We are not responsible for downtime caused by Meta's WhatsApp API infrastructure, third-party providers, or events outside our reasonable control.
              </Para>
            </Section>

            <Section title="8. Fees and Payment">
              <Para>
                Fees for the Service are described on our pricing page. All fees are in USD unless otherwise specified. Subscriptions renew automatically unless cancelled before the renewal date. We reserve the right to modify pricing with 30 days' written notice. Refunds are issued at our discretion for billing errors; no refunds are provided for partial months of service.
              </Para>
            </Section>

            <Section title="9. Intellectual Property">
              <Para>
                The Service, including all software, algorithms, interfaces, and content created by MetaBSP, is protected by intellectual property laws. You receive a limited, non-exclusive, non-transferable license to use the Service during your subscription. You may not copy, modify, distribute, sell, or lease any part of the Service or its underlying code.
              </Para>
            </Section>

            <Section title="10. Limitation of Liability">
              <Para>
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, METABSP AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AGENTS, PARTNERS, AND LICENSORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
              </Para>
              <BulletList items={[
                'Your access to or use of, or inability to access or use, the Service',
                'Any conduct or content of any third party on the Service',
                'Unauthorized access, use, or alteration of your transmissions or content',
                'Actions taken by Meta or WhatsApp affecting your account or messaging capabilities',
                'Any interruption or cessation of transmission to or from our Service',
              ]} />
              <Para>
                OUR TOTAL CUMULATIVE LIABILITY TO YOU FOR ALL CLAIMS ARISING FROM OR RELATED TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID TO US IN THE THREE (3) MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED DOLLARS ($100).
              </Para>
            </Section>

            <Section title="11. Indemnification">
              <Para>
                You agree to defend, indemnify, and hold harmless MetaBSP and its affiliates, officers, directors, employees, and agents from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising out of or relating to your violation of these Terms, your use of the Service, your WhatsApp messaging activities, or your violation of any rights of a third party.
              </Para>
            </Section>

            <Section title="12. Termination">
              <Para>
                Either party may terminate the Service agreement at any time. You may terminate by cancelling your subscription through the account settings or by contacting support@metabsp.com. We may terminate or suspend your access immediately, without prior notice or liability, if you:
              </Para>
              <BulletList items={[
                'Breach any provision of these Terms',
                'Violate Meta\'s WhatsApp Business Policy or Messaging Policy',
                'Fail to pay fees when due',
                'Engage in fraudulent or abusive behavior',
                'Are required by law or regulation to be terminated',
              ]} />
              <Para>
                Upon termination, your right to access the Service will cease immediately. Sections on Intellectual Property, Limitation of Liability, Indemnification, and Governing Law survive termination.
              </Para>
            </Section>

            <Section title="13. Governing Law">
              <Para>
                These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions. Any dispute arising under these Terms shall be resolved through binding arbitration administered by JAMS in accordance with its Commercial Arbitration Rules, except that either party may seek injunctive or other equitable relief in a court of competent jurisdiction to prevent irreparable harm.
              </Para>
            </Section>

            <Section title="14. Changes to Terms">
              <Para>
                We reserve the right to modify these Terms at any time. We will provide at least 30 days' notice of material changes by email and by posting a notice on our website. Your continued use of the Service after the effective date of modified Terms constitutes acceptance of those Terms.
              </Para>
            </Section>

            <Section title="15. Contact">
              <Para>
                For questions about these Terms, contact us at legal@metabsp.com or write to: MetaBSP Legal Team, [Address on file]. For support inquiries, contact support@metabsp.com.
              </Para>
            </Section>
          </Paper>
        </Container>
      </Box>
    </motion.div>
  );
}
