import React from 'react';
import { Container, Typography, Box, Paper, Divider, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
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

const cookieData = [
  { name: 'session_id', type: 'Essential', purpose: 'Maintains your login session', duration: 'Session', thirdParty: 'No' },
  { name: 'csrf_token', type: 'Essential', purpose: 'Protects against cross-site request forgery', duration: 'Session', thirdParty: 'No' },
  { name: 'auth_token', type: 'Essential', purpose: 'Keeps you authenticated across page loads', duration: '30 days', thirdParty: 'No' },
  { name: 'cookie_consent', type: 'Essential', purpose: 'Stores your cookie preferences', duration: '1 year', thirdParty: 'No' },
  { name: '_ga', type: 'Analytics', purpose: 'Google Analytics – distinguishes users', duration: '2 years', thirdParty: 'Google' },
  { name: '_gid', type: 'Analytics', purpose: 'Google Analytics – distinguishes users (24h)', duration: '24 hours', thirdParty: 'Google' },
  { name: '_gat', type: 'Analytics', purpose: 'Google Analytics – throttle request rate', duration: '1 minute', thirdParty: 'Google' },
  { name: '_fbp', type: 'Marketing', purpose: 'Meta Pixel – tracks conversions and ad performance', duration: '90 days', thirdParty: 'Meta' },
  { name: 'fr', type: 'Marketing', purpose: 'Meta – delivers and measures ad relevance', duration: '90 days', thirdParty: 'Meta' },
];

export default function CookiePolicyPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <Box sx={{ py: 8, bgcolor: 'background.default', minHeight: '100vh' }}>
        <Container maxWidth="md">
          <Box sx={{ mb: 6, textAlign: 'center' }}>
            <Typography variant="h3" fontWeight={800} sx={{ mb: 2 }}>Cookie Policy</Typography>
            <Typography variant="body1" color="text.secondary">Last updated: June 2025</Typography>
          </Box>

          <Paper elevation={0} sx={{ p: { xs: 3, md: 6 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Para>
              MetaBSP uses cookies and similar tracking technologies to provide, improve, and protect our services. This Cookie Policy explains what cookies are, what types we use, and how you can control them.
            </Para>

            <Divider sx={{ my: 4 }} />

            <Section title="1. What Are Cookies?">
              <Para>
                Cookies are small text files that are placed on your device when you visit a website. They are widely used to make websites work efficiently and to provide information to the website owner. Cookies do not contain personally identifiable information by themselves, but they can be linked to information you provide to us.
              </Para>
              <Para>
                We also use similar technologies such as local storage, session storage, and web beacons which function similarly to cookies. References to "cookies" in this policy include these similar technologies unless stated otherwise.
              </Para>
            </Section>

            <Section title="2. Types of Cookies We Use">
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5, color: 'primary.main' }}>Essential Cookies</Typography>
              <Para>
                These cookies are strictly necessary for the website to function and cannot be switched off in our systems. They are usually only set in response to actions you take such as logging in or filling out forms.
              </Para>
              <BulletList items={[
                'Authentication cookies that keep you logged in during your session',
                'Security cookies that protect against CSRF attacks and session hijacking',
                'Load balancing cookies that ensure requests are served efficiently',
                'Cookie consent cookies that remember your preferences',
              ]} />

              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5, color: 'primary.main' }}>Analytics Cookies</Typography>
              <Para>
                These cookies allow us to count visits and traffic sources so we can measure and improve the performance of our site. They help us to know which pages are the most and least popular.
              </Para>
              <Para>We use Google Analytics to collect anonymized usage statistics. Data collected includes:</Para>
              <BulletList items={[
                'Pages visited and time spent on each page',
                'Referring websites and search terms',
                'Browser type, operating system, and screen resolution',
                'General geographic location (country/city level)',
                'User flow through our application',
              ]} />
              <Para>IP addresses are anonymized before being sent to Google Analytics. We have signed a Data Processing Agreement with Google in accordance with GDPR requirements.</Para>

              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5, color: 'primary.main' }}>Marketing Cookies</Typography>
              <Para>
                These cookies may be set through our site by our advertising partners. They may be used to build a profile of your interests and show you relevant advertisements on other sites.
              </Para>
              <Para>We use the Meta Pixel to measure the effectiveness of our advertising campaigns and to build audiences for retargeting. The Meta Pixel may track:</Para>
              <BulletList items={[
                'Page views on our public website',
                'Sign-up and conversion events',
                'Content viewed (page categories, not personal content)',
              ]} />
              <Para>If you have a Facebook account and are logged in, Meta may be able to associate these interactions with your profile. We do not share your MetaBSP account data with Meta for advertising purposes.</Para>
            </Section>

            <Section title="3. Cookie Reference Table">
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Cookie Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Purpose</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Duration</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Third Party</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cookieData.map((row) => (
                      <TableRow key={row.name} hover>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{row.name}</TableCell>
                        <TableCell>{row.type}</TableCell>
                        <TableCell>{row.purpose}</TableCell>
                        <TableCell>{row.duration}</TableCell>
                        <TableCell>{row.thirdParty}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Section>

            <Section title="4. Third-Party Cookies">
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Meta Pixel</Typography>
              <Para>
                We use the Meta Pixel (formerly Facebook Pixel) to measure the effectiveness of our advertising on Facebook and Instagram. The Meta Pixel is a piece of JavaScript code that loads on our website and sends data to Meta. You can opt out of Meta's use of your data for advertising by visiting your Facebook Ad Settings or by visiting the Digital Advertising Alliance's opt-out tool at optout.aboutads.info.
              </Para>
              <Para>Meta's privacy policy is available at: https://www.facebook.com/privacy/policy</Para>

              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Google Analytics</Typography>
              <Para>
                We use Google Analytics 4 (GA4) to understand how visitors interact with our website. Google Analytics sets cookies to collect information about website usage. You can opt out of Google Analytics tracking by installing the Google Analytics Opt-out Browser Add-on available at https://tools.google.com/dlpage/gaoptout.
              </Para>
              <Para>Google's privacy policy is available at: https://policies.google.com/privacy</Para>
            </Section>

            <Section title="5. How to Control Cookies">
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Cookie Consent Banner</Typography>
              <Para>
                When you first visit our website, you will see a cookie consent banner that allows you to accept all cookies, reject non-essential cookies, or customize your preferences. Your choices are stored in the cookie_consent cookie for one year. You can change your preferences at any time by clicking the "Cookie Settings" link in our website footer.
              </Para>

              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Browser Controls</Typography>
              <Para>Most web browsers allow you to control cookies through their settings. You can:</Para>
              <BulletList items={[
                'View cookies currently stored in your browser',
                'Delete all cookies or specific cookies',
                'Block all cookies or cookies from specific websites',
                'Set your browser to notify you when cookies are set',
              ]} />
              <Para>Please note that blocking essential cookies will impair the functionality of our platform and you may not be able to log in or use key features.</Para>
              <Para>Browser cookie settings can typically be found in:</Para>
              <BulletList items={[
                'Chrome: Settings → Privacy and Security → Cookies and other site data',
                'Firefox: Settings → Privacy & Security → Cookies and Site Data',
                'Safari: Preferences → Privacy → Manage Website Data',
                'Edge: Settings → Cookies and site permissions → Cookies and site data',
              ]} />

              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Do Not Track</Typography>
              <Para>
                Some browsers offer a "Do Not Track" (DNT) setting. We honor DNT signals by disabling analytics and marketing cookies when a DNT signal is detected.
              </Para>
            </Section>

            <Section title="6. Cookie Policy Updates">
              <Para>
                We may update this Cookie Policy from time to time to reflect changes in our practices or for operational, legal, or regulatory reasons. We will notify you of any material changes by updating the "Last updated" date and, where appropriate, by showing a new consent banner.
              </Para>
            </Section>

            <Section title="7. Contact Us">
              <Para>
                If you have questions about our use of cookies, please contact us at privacy@metabsp.com. We aim to respond to all inquiries within 72 hours.
              </Para>
            </Section>
          </Paper>
        </Container>
      </Box>
    </motion.div>
  );
}
