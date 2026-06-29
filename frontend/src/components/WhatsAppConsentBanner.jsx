import { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Button, IconButton, Stack, Link,
  Collapse, List, ListItem, ListItemIcon, ListItemText, Chip, alpha,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

// Icons
import WhatsAppIcon        from '@mui/icons-material/WhatsApp';
import CloseIcon           from '@mui/icons-material/Close';
import ShieldIcon          from '@mui/icons-material/Shield';
import InfoOutlinedIcon    from '@mui/icons-material/InfoOutlined';
import MessageIcon         from '@mui/icons-material/Message';
import StorageIcon         from '@mui/icons-material/Storage';
import PersonIcon          from '@mui/icons-material/Person';
import VerifiedUserIcon    from '@mui/icons-material/VerifiedUser';
import OpenInNewIcon       from '@mui/icons-material/OpenInNew';
import ExpandMoreIcon      from '@mui/icons-material/ExpandMore';
import ExpandLessIcon      from '@mui/icons-material/ExpandLess';

const STORAGE_KEY = 'metabsp_consent_banner_dismissed';

const DATA_POINTS = [
  { icon: <MessageIcon fontSize="small" />,   text: 'Message content you send and receive via this platform' },
  { icon: <PersonIcon fontSize="small" />,    text: 'Contact phone numbers and display names' },
  { icon: <StorageIcon fontSize="small" />,   text: 'Message delivery status and read receipts from Meta' },
  { icon: <VerifiedUserIcon fontSize="small" />, text: 'WhatsApp Business Account identifiers (WABA ID)' },
];

const USER_RIGHTS = [
  'Request a copy of your data at any time via Account Settings → Export Data',
  'Request deletion of your data within 30 days by contacting support',
  'Opt out of non-essential communications at any time',
  'Revoke MetaBSP\'s access to your WhatsApp account from Settings → Connected Accounts',
];

/**
 * WhatsAppConsentBanner
 *
 * Shows a dismissible banner explaining what data is shared with MetaBSP.
 * Dismissed state is persisted in localStorage.
 *
 * Props:
 *   storageKey?: string  — override the localStorage key (useful for per-account instances)
 *   onLearnMore?: fn     — called when user clicks "Learn More"
 */
export default function WhatsAppConsentBanner({ storageKey = STORAGE_KEY, onLearnMore }) {
  const [visible,  setVisible]  = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) setVisible(true);
  }, [storageKey]);

  const dismiss = () => {
    localStorage.setItem(storageKey, '1');
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16, height: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        >
          <Paper
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: alpha('#25D366', 0.4),
              borderRadius: 2,
              overflow: 'hidden',
              mb: 2,
            }}
          >
            {/* Top accent bar */}
            <Box
              sx={{
                height: 4,
                background: 'linear-gradient(90deg, #075E54, #25D366)',
              }}
            />

            <Box sx={{ p: 2 }}>
              {/* Header row */}
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
                <Stack direction="row" alignItems="center" gap={1.5}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      bgcolor: alpha('#25D366', 0.12),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <WhatsAppIcon sx={{ color: '#25D366', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                      <Typography variant="body1" fontWeight={700}>
                        Data Sharing Notice
                      </Typography>
                      <Chip
                        icon={<ShieldIcon sx={{ fontSize: '14px !important' }} />}
                        label="Privacy"
                        size="small"
                        sx={{
                          bgcolor: alpha('#25D366', 0.1),
                          color: '#075E54',
                          fontWeight: 600,
                          fontSize: 11,
                          height: 20,
                        }}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      By connecting your WhatsApp Business account, you agree to share certain data with MetaBSP.
                    </Typography>
                  </Box>
                </Stack>

                <IconButton size="small" onClick={dismiss} sx={{ mt: -0.5, flexShrink: 0 }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>

              {/* Summary line */}
              <Stack direction="row" alignItems="center" gap={0.5} mt={1.5} mb={1}>
                <InfoOutlinedIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  MetaBSP processes message data to provide bulk messaging, analytics, and automation services on your behalf.
                  We do <strong>not</strong> sell your data.
                </Typography>
              </Stack>

              {/* Expandable details */}
              <Collapse in={expanded}>
                <Box sx={{ mt: 1.5, pl: 1 }}>
                  <Typography variant="body2" fontWeight={700} mb={1}>
                    What data is shared with MetaBSP
                  </Typography>
                  <List disablePadding dense>
                    {DATA_POINTS.map((item, i) => (
                      <ListItem key={i} disablePadding sx={{ mb: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 30, color: 'text.secondary' }}>{item.icon}</ListItemIcon>
                        <ListItemText primary={<Typography variant="caption">{item.text}</Typography>} />
                      </ListItem>
                    ))}
                  </List>

                  <Typography variant="body2" fontWeight={700} mt={2} mb={1}>
                    Your rights
                  </Typography>
                  <List disablePadding dense>
                    {USER_RIGHTS.map((right, i) => (
                      <ListItem key={i} disablePadding sx={{ mb: 0.5, alignItems: 'flex-start' }}>
                        <ListItemIcon sx={{ minWidth: 20, mt: 0.3 }}>
                          <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: 'primary.main', mt: 0.5 }} />
                        </ListItemIcon>
                        <ListItemText primary={<Typography variant="caption">{right}</Typography>} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </Collapse>

              {/* Actions */}
              <Stack direction="row" alignItems="center" justifyContent="space-between" mt={1.5} flexWrap="wrap" gap={1}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Button
                    size="small"
                    onClick={() => setExpanded(v => !v)}
                    endIcon={expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    sx={{ color: 'text.secondary', fontSize: 12, textTransform: 'none', minWidth: 'auto', px: 1 }}
                  >
                    {expanded ? 'Show less' : 'Learn more'}
                  </Button>

                  <Link
                    href="/privacy"
                    target="_blank"
                    rel="noopener"
                    underline="hover"
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}
                  >
                    Privacy Policy
                    <OpenInNewIcon sx={{ fontSize: 10 }} />
                  </Link>

                  <Typography variant="caption" color="text.disabled">·</Typography>

                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noopener"
                    underline="hover"
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}
                  >
                    Terms of Service
                    <OpenInNewIcon sx={{ fontSize: 10 }} />
                  </Link>
                </Stack>

                <Button
                  size="small"
                  variant="outlined"
                  onClick={dismiss}
                  sx={{ fontSize: 12, textTransform: 'none', borderColor: alpha('#25D366', 0.5), color: '#075E54' }}
                >
                  Got it, dismiss
                </Button>
              </Stack>
            </Box>
          </Paper>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
