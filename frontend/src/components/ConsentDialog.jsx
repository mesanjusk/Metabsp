import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography,
  Box, Stack, Checkbox, FormControlLabel, Divider, Collapse, Link,
  List, ListItem, ListItemIcon, ListItemText, IconButton, alpha,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

// Icons
import WhatsAppIcon        from '@mui/icons-material/WhatsApp';
import MessageIcon         from '@mui/icons-material/Message';
import PhoneIcon           from '@mui/icons-material/Phone';
import DescriptionIcon     from '@mui/icons-material/Description';
import BarChartIcon        from '@mui/icons-material/BarChart';
import WebhookIcon         from '@mui/icons-material/Webhook';
import ExpandMoreIcon      from '@mui/icons-material/ExpandMore';
import ExpandLessIcon      from '@mui/icons-material/ExpandLess';
import ShieldIcon          from '@mui/icons-material/Shield';
import LockIcon            from '@mui/icons-material/Lock';
import SecurityIcon        from '@mui/icons-material/Security';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import StorageIcon         from '@mui/icons-material/Storage';
import VisibilityOffIcon   from '@mui/icons-material/VisibilityOff';
import DeleteForeverIcon   from '@mui/icons-material/DeleteForever';

const PERMISSIONS_LIST = [
  {
    icon: <MessageIcon sx={{ color: '#25D366' }} />,
    primary: 'Read and send messages on your behalf',
    secondary: 'Access incoming messages and send outbound messages through your WhatsApp Business account',
  },
  {
    icon: <PhoneIcon sx={{ color: '#128C7E' }} />,
    primary: 'Access your WhatsApp Business phone numbers',
    secondary: 'View and use the phone numbers registered to your Meta Business account',
  },
  {
    icon: <DescriptionIcon sx={{ color: '#2196F3' }} />,
    primary: 'Create and manage message templates',
    secondary: 'Submit, edit, and delete message templates for approval through the Meta API',
  },
  {
    icon: <BarChartIcon sx={{ color: '#FF9800' }} />,
    primary: 'Access message delivery reports',
    secondary: 'Receive delivery receipts, read receipts, and failure notifications for sent messages',
  },
  {
    icon: <WebhookIcon sx={{ color: '#9C27B0' }} />,
    primary: 'Configure webhooks for your account',
    secondary: 'Register webhook endpoints to receive real-time notifications from Meta',
  },
];

const DATA_ACCESS_ITEMS = [
  { icon: <StorageIcon fontSize="small" />, text: 'Message content (text, media, templates) sent through our platform' },
  { icon: <PhoneIcon fontSize="small" />, text: 'Phone number IDs and display names associated with your account' },
  { icon: <BarChartIcon fontSize="small" />, text: 'Message status updates: delivered, read, failed' },
  { icon: <DescriptionIcon fontSize="small" />, text: 'Template submission status and approval outcomes' },
  { icon: <SecurityIcon fontSize="small" />, text: 'WhatsApp Business Account (WABA) ID and metadata' },
];

const DATA_USAGE_ITEMS = [
  { icon: <CheckCircleOutlineIcon fontSize="small" color="success" />, text: 'Route and deliver messages on your behalf via the WhatsApp Cloud API' },
  { icon: <CheckCircleOutlineIcon fontSize="small" color="success" />, text: 'Display analytics and delivery statistics in your MetaBSP dashboard' },
  { icon: <CheckCircleOutlineIcon fontSize="small" color="success" />, text: 'Synchronize contact lists and conversation histories' },
  { icon: <VisibilityOffIcon fontSize="small" color="error" />,        text: 'We do NOT sell your data or message content to third parties' },
  { icon: <DeleteForeverIcon fontSize="small" color="error" />,        text: 'You may request deletion of your data at any time from account settings' },
];

// Animated wrapper for the dialog paper
function SlideUp({ children, open }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          style={{ display: 'contents' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * ConsentDialog
 * Props: { open: bool, onAccept: fn, onDecline: fn }
 */
export default function ConsentDialog({ open, onAccept, onDecline }) {
  const [agreeTerms, setAgreeTerms]    = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [dataExpanded, setDataExpanded] = useState(false);
  const [usageExpanded, setUsageExpanded] = useState(false);

  const canAccept = agreeTerms && agreePrivacy;

  const handleDecline = () => {
    setAgreeTerms(false);
    setAgreePrivacy(false);
    onDecline?.();
  };

  const handleAccept = () => {
    if (!canAccept) return;
    onAccept?.();
  };

  return (
    <Dialog
      open={open}
      onClose={handleDecline}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3, overflow: 'hidden' },
        component: motion.div,
        initial: { opacity: 0, y: 60, scale: 0.97 },
        animate: open ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 40 },
        transition: { type: 'spring', stiffness: 320, damping: 30 },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #075E54 0%, #128C7E 50%, #25D366 100%)',
          px: 3,
          py: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            bgcolor: alpha('#fff', 0.15),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <WhatsAppIcon sx={{ color: '#fff', fontSize: 28 }} />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={700} color="white">
            Connect WhatsApp Business Account
          </Typography>
          <Typography variant="body2" sx={{ color: alpha('#fff', 0.8) }}>
            MetaBSP requires the following permissions
          </Typography>
        </Box>
      </Box>

      <DialogContent sx={{ px: 3, py: 2.5 }}>
        {/* Permissions List */}
        <Typography variant="subtitle2" fontWeight={700} mb={1.5} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ShieldIcon fontSize="small" color="primary" />
          Permissions Requested
        </Typography>

        <List disablePadding sx={{ mb: 2 }}>
          {PERMISSIONS_LIST.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <ListItem alignItems="flex-start" disablePadding sx={{ mb: 1 }}>
                <ListItemIcon sx={{ minWidth: 38, mt: 0.25 }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={<Typography variant="body2" fontWeight={600}>{item.primary}</Typography>}
                  secondary={<Typography variant="caption" color="text.secondary">{item.secondary}</Typography>}
                />
              </ListItem>
            </motion.div>
          ))}
        </List>

        <Divider sx={{ my: 2 }} />

        {/* What data we access */}
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            mb: 1.5,
            overflow: 'hidden',
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: 2, py: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
            onClick={() => setDataExpanded(v => !v)}
          >
            <Stack direction="row" alignItems="center" gap={1}>
              <StorageIcon fontSize="small" color="action" />
              <Typography variant="body2" fontWeight={600}>What data we access</Typography>
            </Stack>
            <IconButton size="small">
              {dataExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Stack>
          <Collapse in={dataExpanded}>
            <Box sx={{ px: 2, pb: 2, bgcolor: alpha('#1976d2', 0.03) }}>
              <List disablePadding dense>
                {DATA_ACCESS_ITEMS.map((item, i) => (
                  <ListItem key={i} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32, color: 'text.secondary' }}>{item.icon}</ListItemIcon>
                    <ListItemText primary={<Typography variant="caption">{item.text}</Typography>} />
                  </ListItem>
                ))}
              </List>
            </Box>
          </Collapse>
        </Box>

        {/* How we use your data */}
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            mb: 2,
            overflow: 'hidden',
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: 2, py: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
            onClick={() => setUsageExpanded(v => !v)}
          >
            <Stack direction="row" alignItems="center" gap={1}>
              <LockIcon fontSize="small" color="action" />
              <Typography variant="body2" fontWeight={600}>How we use your data</Typography>
            </Stack>
            <IconButton size="small">
              {usageExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Stack>
          <Collapse in={usageExpanded}>
            <Box sx={{ px: 2, pb: 2, bgcolor: alpha('#4CAF50', 0.03) }}>
              <List disablePadding dense>
                {DATA_USAGE_ITEMS.map((item, i) => (
                  <ListItem key={i} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>{item.icon}</ListItemIcon>
                    <ListItemText primary={<Typography variant="caption">{item.text}</Typography>} />
                  </ListItem>
                ))}
              </List>
            </Box>
          </Collapse>
        </Box>

        {/* Links */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          By connecting your account you agree to our{' '}
          <Link href="/terms" target="_blank" rel="noopener" underline="always">Terms of Service</Link>
          {' '}and{' '}
          <Link href="/privacy" target="_blank" rel="noopener" underline="always">Privacy Policy</Link>.
          MetaBSP is an independent service provider and is not affiliated with Meta Platforms, Inc.
        </Typography>

        <Divider sx={{ mb: 2 }} />

        {/* Checkboxes */}
        <Stack spacing={1}>
          <FormControlLabel
            control={
              <Checkbox
                checked={agreeTerms}
                onChange={e => setAgreeTerms(e.target.checked)}
                size="small"
                color="primary"
              />
            }
            label={
              <Typography variant="body2">
                I agree to the{' '}
                <Link href="/terms" target="_blank" rel="noopener" underline="always">Terms of Service</Link>
              </Typography>
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={agreePrivacy}
                onChange={e => setAgreePrivacy(e.target.checked)}
                size="small"
                color="primary"
              />
            }
            label={
              <Typography variant="body2">
                I agree to the{' '}
                <Link href="/privacy" target="_blank" rel="noopener" underline="always">Privacy Policy</Link>
              </Typography>
            }
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button variant="outlined" color="inherit" onClick={handleDecline} sx={{ flex: 1 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleAccept}
          disabled={!canAccept}
          startIcon={<WhatsAppIcon />}
          sx={{
            flex: 2,
            background: canAccept
              ? 'linear-gradient(135deg, #075E54, #25D366)'
              : undefined,
            '&:not(:disabled)': { color: '#fff' },
          }}
        >
          Connect WhatsApp
        </Button>
      </DialogActions>
    </Dialog>
  );
}
