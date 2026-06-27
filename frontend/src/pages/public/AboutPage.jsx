import React from 'react';
import {
  Container, Typography, Box, Paper, Grid, Chip, Avatar, Divider, Stack
} from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import ApiIcon from '@mui/icons-material/Api';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import SecurityIcon from '@mui/icons-material/Security';
import AutomationIcon from '@mui/icons-material/AutoFixHigh';
import GroupIcon from '@mui/icons-material/Group';
import VerifiedIcon from '@mui/icons-material/Verified';
import SpeedIcon from '@mui/icons-material/Speed';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { motion } from 'framer-motion';

const FeatureCard = ({ icon, title, description }) => (
  <Paper
    elevation={0}
    sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}
    component={motion.div}
    whileHover={{ y: -4 }}
    transition={{ duration: 0.2 }}
  >
    <Box sx={{ color: 'primary.main', mb: 1.5 }}>{icon}</Box>
    <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>{title}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>{description}</Typography>
  </Paper>
);

const TeamMember = ({ name, role, initials }) => (
  <Box sx={{ textAlign: 'center' }}>
    <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 1.5, bgcolor: 'primary.main', fontSize: 24, fontWeight: 700 }}>
      {initials}
    </Avatar>
    <Typography variant="subtitle1" fontWeight={700}>{name}</Typography>
    <Typography variant="body2" color="text.secondary">{role}</Typography>
  </Box>
);

export default function AboutPage() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
        <Box
          sx={{
            background: 'linear-gradient(135deg, #111b21 0%, #1a2e38 50%, #0b3d2e 100%)',
            color: 'white',
            py: { xs: 10, md: 16 },
            textAlign: 'center',
          }}
        >
          <Container maxWidth="md">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <WhatsAppIcon sx={{ color: '#25d366', fontSize: 40 }} />
                <Typography variant="h3" fontWeight={900} sx={{ color: 'white' }}>MetaBSP</Typography>
              </Box>
              <Typography variant="h4" fontWeight={700} sx={{ mb: 2, color: 'rgba(255,255,255,0.95)' }}>
                Empowering Businesses Through WhatsApp
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.75)', maxWidth: 560, mx: 'auto', lineHeight: 1.8 }}>
                MetaBSP is a Meta-authorized WhatsApp Business Solution Provider, helping businesses of all sizes communicate with their customers at scale through the world's most popular messaging platform.
              </Typography>
              <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ mt: 3 }} flexWrap="wrap" useFlexGap>
                <Chip label="Meta Technology Partner" icon={<VerifiedIcon />} sx={{ bgcolor: '#25d366', color: '#05260f', fontWeight: 700 }} />
                <Chip label="Founded 2024" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'white' }} />
              </Stack>
            </motion.div>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ py: 10 }}>
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography variant="h4" fontWeight={800} sx={{ mb: 2 }}>Our Mission</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 700, mx: 'auto', lineHeight: 1.9, fontSize: '1.05rem' }}>
              We believe every business deserves access to world-class messaging infrastructure. Our mission is to democratize the WhatsApp Business API — making it accessible, affordable, and powerful for startups, SMBs, and enterprises alike. We handle the complexity of Meta's platform so you can focus on building meaningful customer relationships.
            </Typography>
          </Box>

          <Divider sx={{ mb: 8 }} />

          <Box sx={{ mb: 8 }}>
            <Typography variant="h4" fontWeight={800} sx={{ mb: 1, textAlign: 'center' }}>What We Do</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mb: 5 }}>
              MetaBSP is your complete WhatsApp Business Platform solution
            </Typography>
            <Grid container spacing={3}>
              {[
                {
                  icon: <ApiIcon sx={{ fontSize: 32 }} />,
                  title: 'WhatsApp Cloud API',
                  description: 'Direct access to Meta\'s WhatsApp Cloud API with simplified authentication, embedded signup, and intelligent rate limit management.',
                },
                {
                  icon: <AutomationIcon sx={{ fontSize: 32 }} />,
                  title: 'Template Management',
                  description: 'Create, submit, and manage WhatsApp message templates. Track approval status, iterate on rejected templates, and organize by category.',
                },
                {
                  icon: <WhatsAppIcon sx={{ fontSize: 32 }} />,
                  title: 'Webhook Infrastructure',
                  description: 'Reliable webhook delivery with retry logic, signature verification, payload logging, and real-time event streaming to your endpoints.',
                },
                {
                  icon: <AnalyticsIcon sx={{ fontSize: 32 }} />,
                  title: 'Message Analytics',
                  description: 'Comprehensive dashboards for delivery rates, read receipts, campaign performance, and contact engagement metrics.',
                },
                {
                  icon: <SecurityIcon sx={{ fontSize: 32 }} />,
                  title: 'Enterprise Security',
                  description: 'AES-256 encryption, TLS 1.3, webhook signature verification, MFA, IP allowlisting, and SOC 2 compliance in progress.',
                },
                {
                  icon: <GroupIcon sx={{ fontSize: 32 }} />,
                  title: 'Team Collaboration',
                  description: 'Multi-user access with role-based permissions, audit logs, API key management, and team workspace isolation.',
                },
                {
                  icon: <SpeedIcon sx={{ fontSize: 32 }} />,
                  title: 'High Throughput',
                  description: 'Built to handle millions of messages per day with horizontal scaling, queue-based message processing, and smart rate limiting.',
                },
                {
                  icon: <SupportAgentIcon sx={{ fontSize: 32 }} />,
                  title: 'Dedicated Support',
                  description: 'Technical support from WhatsApp API experts, onboarding assistance, and priority support for Business and Enterprise plans.',
                },
              ].map((feature, i) => (
                <Grid item xs={12} sm={6} md={3} key={i}>
                  <FeatureCard {...feature} />
                </Grid>
              ))}
            </Grid>
          </Box>

          <Divider sx={{ mb: 8 }} />

          <Box sx={{ mb: 8 }}>
            <Typography variant="h4" fontWeight={800} sx={{ mb: 1, textAlign: 'center' }}>Meta Technology Partner</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mb: 5, maxWidth: 600, mx: 'auto' }}>
              MetaBSP is an authorized WhatsApp Business Solution Provider, recognized by Meta for our adherence to their platform policies and technical standards.
            </Typography>
            <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '2px solid', borderColor: 'primary.main', textAlign: 'center', maxWidth: 600, mx: 'auto' }}>
              <VerifiedIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1.5 }} />
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Authorized WhatsApp Business Solution Provider</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                As an authorized BSP, MetaBSP has direct access to Meta's WhatsApp Business API infrastructure and is bound by Meta's Business Solution Provider Agreement to maintain the highest standards of platform usage.
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap>
                <Chip label="Official BSP" color="primary" size="small" />
                <Chip label="Policy Compliant" color="success" size="small" />
                <Chip label="Verified Business" color="primary" size="small" variant="outlined" />
              </Stack>
            </Paper>
          </Box>

          <Divider sx={{ mb: 8 }} />

          <Box sx={{ mb: 8 }}>
            <Typography variant="h4" fontWeight={800} sx={{ mb: 1, textAlign: 'center' }}>The Team</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mb: 6 }}>
              Built by developers who understand enterprise messaging
            </Typography>
            <Grid container spacing={4} justifyContent="center">
              {[
                { name: 'Alex Rivera', role: 'Co-Founder & CEO', initials: 'AR' },
                { name: 'Priya Nair', role: 'Co-Founder & CTO', initials: 'PN' },
                { name: 'James Chen', role: 'Head of Platform', initials: 'JC' },
                { name: 'Sofia Mendez', role: 'Head of Partnerships', initials: 'SM' },
                { name: 'Omar Hassan', role: 'Lead Engineer', initials: 'OH' },
                { name: 'Aisha Patel', role: 'Head of Customer Success', initials: 'AP' },
              ].map((member, i) => (
                <Grid item xs={6} sm={4} md={2} key={i}>
                  <TeamMember {...member} />
                </Grid>
              ))}
            </Grid>
          </Box>

          <Box
            sx={{
              textAlign: 'center',
              py: 6,
              px: 4,
              borderRadius: 4,
              background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)',
              color: 'white',
            }}
          >
            <Typography variant="h4" fontWeight={800} sx={{ mb: 1.5, color: 'white' }}>
              Ready to Get Started?
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)', mb: 3 }}>
              Join hundreds of businesses already messaging their customers through MetaBSP.
            </Typography>
            <Chip
              label="Start Free Trial"
              sx={{ bgcolor: 'white', color: '#128c7e', fontWeight: 700, fontSize: '1rem', px: 2, py: 2.5, borderRadius: 2, cursor: 'pointer' }}
              clickable
            />
          </Box>
        </Container>
      </Box>
    </motion.div>
  );
}
