'use client';

import React from 'react';
import {
  Container, Typography, Box, Paper, Grid, Chip, Divider, Stack
} from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import HubRoundedIcon from '@mui/icons-material/HubRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
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
                <HubRoundedIcon sx={{ fontSize: 40 }} />
                <Typography variant="h3" fontWeight={900} sx={{ color: 'white' }}>SanjuSK</Typography>
              </Box>
              <Typography variant="h4" fontWeight={700} sx={{ mb: 2, color: 'rgba(255,255,255,0.95)' }}>
                One workspace for the whole business
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.75)', maxWidth: 620, mx: 'auto', lineHeight: 1.8 }}>
                SanjuSK brings WhatsApp, Instagram and your Google Business Profile together with the CRM,
                catalogue, invoices and staff tools behind them — one customer record across every channel.
                Messaging runs on Meta&apos;s official WhatsApp Business Platform.
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
              A small business does not have a messaging problem, a CRM problem and an invoicing problem — it has one customer, reached in several places. Most tools sell it back as separate subscriptions with separate customer lists. Our mission is to keep the whole thing in one workspace, on one shared customer record, at a price a small business can actually pay — and to handle the complexity of Meta's and Google's platforms so the owner does not have to.
            </Typography>
          </Box>

          <Divider sx={{ mb: 8 }} />

          <Box sx={{ mb: 8 }}>
            <Typography variant="h4" fontWeight={800} sx={{ mb: 1, textAlign: 'center' }}>What We Do</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mb: 5 }}>
              Eleven services on one shared workspace, not eleven subscriptions
            </Typography>
            <Grid container spacing={3}>
              {[
                {
                  icon: <WhatsAppIcon sx={{ fontSize: 32 }} />,
                  title: 'Shared inbox',
                  description: 'WhatsApp on Meta\'s Cloud API, Instagram DMs and comments, and one contact record behind both — with templates, broadcasts and assignment so two people never answer the same customer.',
                },
                {
                  icon: <StorefrontRoundedIcon sx={{ fontSize: 32 }} />,
                  title: 'Google Business Profile',
                  description: 'Reviews, AI-drafted replies you approve, profile posts, and the Search and Maps performance behind your listing.',
                },
                {
                  icon: <PeopleAltRoundedIcon sx={{ fontSize: 32 }} />,
                  title: 'CRM, store and payments',
                  description: 'Leads and follow-ups, a product catalogue and stock, quotations that become orders, invoices, collections and expenses — all against the same customer.',
                },
                {
                  icon: <AutomationIcon sx={{ fontSize: 32 }} />,
                  title: 'Automations and workflows',
                  description: 'Keyword auto-replies for a single question, multi-step workflows with delays for anything longer, and staff tasks that come out of a conversation.',
                },
                {
                  icon: <ApiIcon sx={{ fontSize: 32 }} />,
                  title: 'REST API and webhooks',
                  description: 'Send from your own backend with an API key, and fan one Meta webhook out to as many of your own endpoints as you need, each with its own signing secret.',
                },
                {
                  icon: <AnalyticsIcon sx={{ fontSize: 32 }} />,
                  title: 'Analytics',
                  description: 'Delivery and read rates, campaign performance, contact engagement, and local performance from your Google listing.',
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
              WhatsApp messaging sends and receives entirely through Meta's official WhatsApp Business Platform. There is no unofficial transport anywhere in the product.
            </Typography>
            <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '2px solid', borderColor: 'primary.main', textAlign: 'center', maxWidth: 600, mx: 'auto' }}>
              <VerifiedIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1.5 }} />
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Built on the WhatsApp Business Platform</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Every message in and out goes through Meta's Cloud API. Businesses connect their own WhatsApp Business Account — through Meta&apos;s Embedded Signup, or with their own access token — and keep ownership of it, including full access in WhatsApp Manager, and can revoke our access at any time.
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap>
                <Chip label="Cloud API only" color="primary" size="small" />
                <Chip label="You own your WABA" color="primary" size="small" variant="outlined" />
                <Chip label="Verified Business" color="primary" size="small" variant="outlined" />
              </Stack>
            </Paper>
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
              Create an account, connect your first channel, and bring the rest across when you are ready.
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
