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

const storageData = [
  { name: 'auth_token (localStorage)', type: 'Strictly necessary', purpose: 'Keeps you signed in across page loads', duration: 'Until logout or cleared', thirdParty: 'No' },
  { name: 'user profile (localStorage)', type: 'Strictly necessary', purpose: 'Remembers your name, role, and selected WhatsApp provider', duration: 'Until logout or cleared', thirdParty: 'No' },
  { name: 'consent banner dismissal (localStorage)', type: 'Strictly necessary', purpose: 'Remembers that you have seen the data-use consent notice', duration: 'Until cleared', thirdParty: 'No' },
];

export default function CookiePolicyPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <Box sx={{ py: 8, bgcolor: 'background.default', minHeight: '100vh' }}>
        <Container maxWidth="md">
          <Box sx={{ mb: 6, textAlign: 'center' }}>
            <Typography variant="h3" fontWeight={800} sx={{ mb: 2 }}>Cookie Policy</Typography>
            <Typography variant="body1" color="text.secondary">Last updated: July 2026</Typography>
          </Box>

          <Paper elevation={0} sx={{ p: { xs: 3, md: 6 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Para>
              This Cookie Policy explains what cookies and similar browser storage technologies the MetaBSP web application actually uses. It is written to match this application's real behavior, not a generic template — if a section below says a technology isn't used, that has been verified against the running code.
            </Para>

            <Divider sx={{ my: 4 }} />

            <Section title="1. We don't use cookies for login or tracking">
              <Para>
                MetaBSP does not set a traditional session cookie. Authentication and session state (your sign-in token, name, role, and selected WhatsApp provider) are stored in your browser's <code>localStorage</code> instead of a cookie. Clearing your browser's site data for this application will sign you out, the same way clearing a session cookie would on another site.
              </Para>
              <Para>
                We do not currently load Google Analytics, Meta Pixel, or any other third-party analytics or advertising tracking script on this site. If that changes in a future release, this page will be updated first, and your consent will be requested where required by law before any such technology goes live.
              </Para>
            </Section>

            <Section title="2. What we actually store in your browser">
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Storage key</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Purpose</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Duration</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Third party</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {storageData.map((row) => (
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
              <Para sx={{ mt: 2 }}>
                None of the above are cookies in the strict sense — they are browser <code>localStorage</code> entries, which are not sent to our servers automatically on every request the way a cookie is, and are not readable by other websites.
              </Para>
            </Section>

            <Section title="3. Third-party embeds">
              <Para>
                When you connect a WhatsApp Business Account, this application loads Meta's own Embedded Signup JavaScript SDK, which runs in your browser during that connection flow. Any cookies or storage Meta's SDK sets during that process are controlled by Meta under Meta's own privacy and cookie policies, not by us — see{' '}
                <a href="https://www.facebook.com/privacy/policy" target="_blank" rel="noreferrer">Meta's Privacy Policy</a> for details on that flow specifically.
              </Para>
            </Section>

            <Section title="4. Your choices">
              <Para>
                Because sign-in relies on <code>localStorage</code> rather than cookies, browser cookie-blocking settings do not affect your ability to log in. You can view and clear this application's stored data at any time through your browser's developer tools or site-settings page; doing so will sign you out and reset any remembered preferences.
              </Para>
            </Section>

            <Section title="5. Do Not Track">
              <Para>
                Because this application does not deploy cross-site tracking technology, there is currently no tracking behavior for a browser's "Do Not Track" signal to disable. This section will be updated if that changes.
              </Para>
            </Section>

            <Section title="6. Changes to this policy">
              <Para>
                We will update this Cookie Policy before introducing any cookie, analytics, or advertising technology beyond the strictly necessary local storage described above, and will seek any consent required by applicable law before doing so.
              </Para>
            </Section>

            <Section title="7. Contact us">
              <Para>
                Questions about this Cookie Policy can be directed to privacy@metabsp.com.
              </Para>
            </Section>
          </Paper>
        </Container>
      </Box>
    </motion.div>
  );
}
