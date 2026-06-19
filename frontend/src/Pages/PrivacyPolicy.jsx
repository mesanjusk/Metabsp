import { Box, Container, Divider, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';

const LAST_UPDATED = 'June 19, 2026';
const APP_NAME = 'Metabsp';
const CONTACT_EMAIL = 'privacy@instify.in';
const WEBSITE = 'https://meta.instify.in';

function Section({ title, children }) {
  return (
    <Box mb={4}>
      <Typography variant="h6" fontWeight={700} mb={1.5} sx={{ color: '#e2e8f0' }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function Para({ children }) {
  return (
    <Typography sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, mb: 1.5, fontSize: '0.95rem' }}>
      {children}
    </Typography>
  );
}

function Ul({ items }) {
  return (
    <Box component="ul" sx={{ pl: 3, m: 0, mb: 1.5 }}>
      {items.map((item, i) => (
        <Box component="li" key={i} sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, mb: 0.5, fontSize: '0.95rem' }}>
          {item}
        </Box>
      ))}
    </Box>
  );
}

export default function PrivacyPolicy() {
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: '#0a1628', color: '#fff' }}>

      {/* Nav */}
      <Box
        component="nav"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 3, md: 6 },
          py: 2,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backdropFilter: 'blur(12px)',
          bgcolor: 'rgba(10,22,40,0.9)',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} component={Link} to="/" sx={{ textDecoration: 'none', color: 'inherit' }}>
          <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChatBubbleOutlineRoundedIcon sx={{ color: '#fff', fontSize: 18 }} />
          </Box>
          <Typography fontWeight={700} fontSize={18}>{APP_NAME}</Typography>
        </Stack>
        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>Privacy Policy</Typography>
      </Box>

      <Container maxWidth="md" sx={{ py: { xs: 6, md: 10 } }}>

        {/* Header */}
        <Box mb={6}>
          <Typography variant="h3" fontWeight={800} mb={1} sx={{ letterSpacing: -1 }}>
            Privacy Policy
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>
            Last updated: {LAST_UPDATED}
          </Typography>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 5 }} />

        <Section title="1. Introduction">
          <Para>
            {APP_NAME} ("we," "our," or "us") operates as a WhatsApp Business Platform Tech Provider. This Privacy Policy
            explains how we collect, use, disclose, and safeguard your information when you use our platform at{' '}
            <Box component="span" sx={{ color: '#25d366' }}>{WEBSITE}</Box> (the "Service").
          </Para>
          <Para>
            Our Service integrates with Meta's WhatsApp Business Platform APIs to enable businesses to send and receive
            WhatsApp messages, manage WhatsApp Business Accounts (WABAs), and onboard onto the WhatsApp Business Platform
            via Meta's Embedded Signup flow.
          </Para>
          <Para>
            By using the Service, you agree to the collection and use of information as described in this policy.
          </Para>
        </Section>

        <Section title="2. Information We Collect">
          <Para>We collect the following categories of information:</Para>

          <Typography fontWeight={600} mb={1} sx={{ color: '#e2e8f0' }}>2.1 Account Information</Typography>
          <Ul items={[
            'Username, mobile phone number, and password (hashed) when you register',
            'Business name and organization details',
            'Email address (if provided)',
          ]} />

          <Typography fontWeight={600} mb={1} sx={{ color: '#e2e8f0' }}>2.2 WhatsApp Business Data (via Meta APIs)</Typography>
          <Ul items={[
            'WhatsApp Business Account (WABA) IDs and associated phone number IDs',
            'WhatsApp phone number display names, verification status, and quality ratings',
            'Access tokens obtained through Meta\'s OAuth / Embedded Signup flow (stored encrypted)',
            'Message content sent or received through the platform for delivery and logging purposes',
            'Message templates created or used in the Service',
            'Webhook payloads delivered by Meta (containing message events, status updates, etc.)',
            'Contact information you import or create (phone numbers, names)',
          ]} />

          <Typography fontWeight={600} mb={1} sx={{ color: '#e2e8f0' }}>2.3 Usage and Technical Data</Typography>
          <Ul items={[
            'IP addresses and browser/device information',
            'Log data including pages visited, features used, timestamps',
            'API request logs for debugging and rate-limit enforcement',
          ]} />

          <Typography fontWeight={600} mb={1} sx={{ color: '#e2e8f0' }}>2.4 Data from Meta Platform</Typography>
          <Para>
            When you connect your Meta / Facebook account through our Embedded Signup flow, we receive data
            from Meta as permitted by your authorization. This may include business asset information such as
            Facebook Pages, Ad Accounts, Product Catalogs, Datasets, and Instagram accounts linked to your
            Business Manager.
          </Para>
        </Section>

        <Section title="3. How We Use Your Information">
          <Para>We use the collected information to:</Para>
          <Ul items={[
            'Provide, operate, and improve the Service',
            'Authenticate and authorize your access to the platform',
            'Connect and manage your WhatsApp Business Accounts via the Meta Graph API',
            'Facilitate message sending and receiving through the WhatsApp Business Platform',
            'Store and display webhook events for debugging purposes',
            'Send OTP verification codes via WhatsApp during account registration and password reset',
            'Generate analytics and usage statistics for your account',
            'Detect and prevent fraud, abuse, or violations of our terms',
            'Comply with legal obligations',
          ]} />
        </Section>

        <Section title="4. Meta Platform Data Policy">
          <Para>
            {APP_NAME} is built on Meta Platform APIs. Our use of data obtained via Meta Platform APIs
            (including the WhatsApp Business API and Graph API) is governed by:
          </Para>
          <Ul items={[
            'Meta\'s Platform Terms (https://developers.facebook.com/terms)',
            'WhatsApp Business Platform Terms of Service',
            'Meta\'s Data Policy (https://www.facebook.com/privacy/policy)',
          ]} />
          <Para>
            We only request the permissions necessary to provide our Service and do not sell Meta Platform
            data to third parties. Access tokens obtained via Meta OAuth flows are stored encrypted in our
            database and are used exclusively to make authorized API calls on your behalf.
          </Para>
          <Para>
            We comply with Meta's Platform Policy requirements, including restrictions on data use, data
            minimization, and user data deletion upon request.
          </Para>
        </Section>

        <Section title="5. Data Sharing and Disclosure">
          <Para>We do not sell your personal information. We may share information in the following circumstances:</Para>

          <Typography fontWeight={600} mb={1} sx={{ color: '#e2e8f0' }}>5.1 Service Providers</Typography>
          <Para>
            We use third-party service providers to operate our infrastructure, including:
          </Para>
          <Ul items={[
            'Cloud hosting and database services (MongoDB Atlas, Vercel, Render)',
            'Media storage (Cloudinary) for uploaded files',
            'Analytics services for platform usage monitoring',
          ]} />

          <Typography fontWeight={600} mb={1} sx={{ color: '#e2e8f0' }}>5.2 Legal Requirements</Typography>
          <Para>
            We may disclose information if required by law, regulation, legal process, or governmental request,
            or to protect the rights, property, or safety of {APP_NAME}, our users, or the public.
          </Para>

          <Typography fontWeight={600} mb={1} sx={{ color: '#e2e8f0' }}>5.3 Business Transfers</Typography>
          <Para>
            In the event of a merger, acquisition, or sale of assets, your information may be transferred
            to the acquiring entity.
          </Para>
        </Section>

        <Section title="6. Data Retention">
          <Para>
            We retain your account data for as long as your account is active or as needed to provide the Service.
            WhatsApp message logs are retained for up to 90 days by default. Webhook event payloads are retained
            for 30 days. You may request deletion of your data at any time (see Section 9).
          </Para>
          <Para>
            Access tokens are stored encrypted and are revoked/deleted when you disconnect your WhatsApp account
            or delete your account.
          </Para>
        </Section>

        <Section title="7. Data Security">
          <Para>
            We implement industry-standard security measures including:
          </Para>
          <Ul items={[
            'AES-256 encryption for sensitive values (access tokens, credentials)',
            'Bcrypt hashing for passwords',
            'HTTPS/TLS encryption for all data in transit',
            'JWT-based authentication with short-lived tokens',
            'HMAC-SHA256 signature verification for all incoming Meta webhooks',
            'Rate limiting on authentication and messaging endpoints',
          ]} />
          <Para>
            No method of transmission over the Internet or electronic storage is 100% secure. While we strive
            to use commercially acceptable means to protect your information, we cannot guarantee absolute security.
          </Para>
        </Section>

        <Section title="8. Cookies and Tracking">
          <Para>
            Our Service uses browser localStorage to store authentication tokens on your device. We do not
            use third-party advertising cookies. We may use minimal analytics tools to understand aggregate
            platform usage.
          </Para>
        </Section>

        <Section title="9. Your Rights and Choices">
          <Para>Depending on your location, you may have the following rights:</Para>
          <Ul items={[
            'Access — Request a copy of the personal data we hold about you',
            'Rectification — Request correction of inaccurate data',
            'Erasure — Request deletion of your account and associated data',
            'Portability — Request an export of your data in a machine-readable format',
            'Objection — Object to certain processing of your data',
            'Withdraw consent — Disconnect your WhatsApp account and revoke access tokens at any time from within the platform',
          ]} />
          <Para>
            To exercise any of these rights, contact us at{' '}
            <Box component="span" sx={{ color: '#25d366' }}>{CONTACT_EMAIL}</Box>. We will respond within 30 days.
          </Para>
        </Section>

        <Section title="10. Children's Privacy">
          <Para>
            The Service is not directed to individuals under the age of 18. We do not knowingly collect personal
            information from children. If you believe we have inadvertently collected such information, please
            contact us immediately.
          </Para>
        </Section>

        <Section title="11. International Data Transfers">
          <Para>
            Your information may be transferred to and processed in countries other than your country of residence.
            These countries may have data protection laws different from your country. By using the Service, you
            consent to such transfers.
          </Para>
        </Section>

        <Section title="12. Changes to This Privacy Policy">
          <Para>
            We may update this Privacy Policy from time to time. We will notify you of any material changes by
            updating the "Last updated" date at the top of this page. Continued use of the Service after any
            changes constitutes your acceptance of the updated policy.
          </Para>
        </Section>

        <Section title="13. Contact Us">
          <Para>
            If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices,
            please contact us:
          </Para>
          <Box
            sx={{
              p: 3,
              borderRadius: 2,
              bgcolor: 'rgba(37,211,102,0.06)',
              border: '1px solid rgba(37,211,102,0.2)',
            }}
          >
            <Typography fontWeight={700} mb={1} sx={{ color: '#25d366' }}>{APP_NAME}</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.9rem', lineHeight: 2 }}>
              Email: {CONTACT_EMAIL}
              <br />
              Website: {WEBSITE}
              <br />
              For Meta Platform data requests, include "Meta Data Request" in your subject line.
            </Typography>
          </Box>
        </Section>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 5 }} />

        <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', textAlign: 'center' }}>
          © {new Date().getFullYear()} {APP_NAME} · Built on Meta Platform APIs ·{' '}
          <Box component={Link} to="/" sx={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'underline' }}>
            Home
          </Box>
        </Typography>
      </Container>
    </Box>
  );
}
