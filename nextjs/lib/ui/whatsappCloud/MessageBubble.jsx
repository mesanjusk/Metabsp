'use client';

import { alpha } from '@mui/material/styles';
import { Box, Button, Stack, Typography } from '@mui/material';
import MessageRenderer from './MessageRenderer';

/**
 * Rewritten off Tailwind.
 *
 * This component was written for the Vite app, which had Tailwind. The Next.js
 * app never did, so every class here — the bubble shape, its colour, the
 * alignment, the timestamp row — resolved to nothing, and the chat thread
 * rendered as a column of unstyled text. That is the screen a Meta reviewer
 * spends most of their walkthrough looking at.
 *
 * It now uses the theme, so bubbles follow the design tokens and work in dark
 * mode, which the hardcoded `bg-white text-gray-900` never could.
 */

const getStatusLabel = (status) => {
  if (!status) return 'sent';
  return String(status).toLowerCase();
};

const formatMessageTime = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getMessageType = (message) => {
  const candidates = [
    message?.messageType,
    message?.type,
    message?.payloadType,
    message?.contentType,
  ].filter(Boolean);

  const resolved = String(candidates[0] || 'text').toLowerCase();

  if (['image', 'video', 'audio', 'document', 'sticker', 'text', 'template'].includes(resolved)) {
    return resolved;
  }

  if (resolved.includes('image')) return 'image';
  if (resolved.includes('video')) return 'video';
  if (resolved.includes('audio')) return 'audio';
  if (resolved.includes('document') || resolved.includes('file')) return 'document';
  if (resolved.includes('sticker')) return 'sticker';

  return 'text';
};

const isMediaType = (type) => ['image', 'video', 'audio', 'document', 'sticker'].includes(type);

export default function MessageBubble({ message, isOutgoing, timestamp, onRetry }) {
  const status = getStatusLabel(message?.status);
  const canRetry = isOutgoing && ['failed', 'error', 'undelivered'].includes(status);
  const messageType = getMessageType(message);
  const isUploading = Boolean(message?.isUploading);
  const isFailed = ['failed', 'error', 'undelivered'].includes(status);

  return (
    <Box sx={{ display: 'flex', justifyContent: isOutgoing ? 'flex-end' : 'flex-start', mb: 1 }}>
      <Box
        component="article"
        sx={(theme) => ({
          maxWidth: { xs: '85%', sm: '72%' },
          px: 1.5,
          py: 1,
          borderRadius: 3,
          // The squared-off corner on the sender's side is what makes a thread
          // scannable without reading it.
          borderBottomRightRadius: isOutgoing ? 6 : undefined,
          borderBottomLeftRadius: isOutgoing ? undefined : 6,
          boxShadow: theme.shadows[1],
          bgcolor: isOutgoing ? 'primary.main' : 'background.paper',
          color: isOutgoing ? 'primary.contrastText' : 'text.primary',
          border: isOutgoing ? 'none' : `1px solid ${theme.palette.divider}`,
          wordBreak: 'break-word',
        })}
      >
        {isUploading ? (
          <Typography variant="caption" sx={{ display: 'block', mb: 0.75, opacity: 0.85, fontWeight: 600 }}>
            Uploading media…
          </Typography>
        ) : null}

        <MessageRenderer message={message} type={messageType} />

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="flex-end"
          sx={{
            mt: 0.75,
            fontSize: 11,
            opacity: isOutgoing ? 0.85 : 1,
            color: isOutgoing ? 'inherit' : 'text.secondary',
          }}
        >
          <Typography variant="caption" component="span" sx={{ fontSize: 'inherit', color: 'inherit' }}>
            {formatMessageTime(timestamp)}
          </Typography>
          <Typography
            variant="caption"
            component="span"
            sx={{
              fontSize: 'inherit',
              color: 'inherit',
              textTransform: 'capitalize',
              // Failure is the one status worth reading at a glance; the rest
              // are ambient detail and should not compete with the message.
              fontWeight: isFailed ? 700 : 400,
            }}
          >
            {status}
          </Typography>
          {isMediaType(messageType) ? (
            <Typography
              variant="caption"
              component="span"
              sx={{ fontSize: 'inherit', color: 'inherit', textTransform: 'uppercase', letterSpacing: '0.04em' }}
            >
              {messageType}
            </Typography>
          ) : null}
        </Stack>

        {canRetry ? (
          <Button
            size="small"
            onClick={() => onRetry?.(message)}
            sx={(theme) => ({
              mt: 1,
              py: 0.25,
              minHeight: 0,
              fontSize: '0.75rem',
              color: theme.palette.error.main,
              bgcolor: alpha(theme.palette.common.white, 0.95),
              '&:hover': { bgcolor: theme.palette.common.white },
            })}
          >
            Retry
          </Button>
        ) : null}
      </Box>
    </Box>
  );
}
