'use client';

import { Chip, Divider, Stack, Typography } from '@mui/material';
import FileMessage from './FileMessage';
import ImageMessage from './ImageMessage';
import PropTypes from 'prop-types';

const getTextFromMessage = (msg) => {
  if (typeof msg?.body === 'string' && msg.body.trim()) return msg.body;
  if (typeof msg?.text === 'string' && msg.text.trim()) return msg.text;
  if (typeof msg?.text?.body === 'string' && msg.text.body.trim()) return msg.text.body;
  if (typeof msg?.message === 'string' && msg.message.trim()) return msg.message;
  return '';
};

// A template is not one blob of text: WhatsApp shows its header in bold above
// the body and its footer small and muted below, and the bubble should read the
// same way the recipient's did.
function TemplateMessage({ parts, fallbackText }) {
  const header = String(parts?.header || '').trim();
  const body = String(parts?.body || '').trim() || fallbackText;
  const footer = String(parts?.footer || '').trim();
  const buttons = Array.isArray(parts?.buttons) ? parts.buttons.filter(Boolean) : [];

  return (
    <Stack spacing={0.5}>
      {header ? (
        <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {header}
        </Typography>
      ) : null}
      {body ? (
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {body}
        </Typography>
      ) : null}
      {footer ? (
        <Typography variant="caption" sx={{ opacity: 0.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {footer}
        </Typography>
      ) : null}
      {buttons.length ? (
        <>
          <Divider sx={{ my: 0.5 }} />
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {buttons.map((label) => (
              <Chip key={label} label={label} size="small" variant="outlined" sx={{ height: 22, fontSize: 11 }} />
            ))}
          </Stack>
        </>
      ) : null}
    </Stack>
  );
}

TemplateMessage.propTypes = {
  parts: PropTypes.object,
  fallbackText: PropTypes.string,
};

TemplateMessage.defaultProps = {
  parts: null,
  fallbackText: '',
};

export default function MessageRenderer({ message, type }) {
  const safeType = String(type || '').toLowerCase();
  const text = getTextFromMessage(message);

  if (safeType === 'template') {
    // No stored parts means the row predates rendered template sends and its
    // definition could not be re-read; the stored text (the template name) is
    // still the most this bubble can honestly show.
    return <TemplateMessage parts={message?.templateParts} fallbackText={text} />;
  }

  if (safeType === 'image') {
    return (
      <>
        <ImageMessage message={message} />
        {text ? <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</Typography> : null}
      </>
    );
  }

  if (safeType === 'document') {
    return (
      <>
        <FileMessage message={message} />
        {text ? <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</Typography> : null}
      </>
    );
  }

  if (safeType === 'video') {
    const mediaUrl = message?.mediaUrl || message?.video?.link || message?.url;
    return mediaUrl ? <video controls style={{ maxHeight: 320, width: '100%', borderRadius: 12, backgroundColor: '#000' }}><source src={mediaUrl} /></video> : <Typography variant="body2" sx={{ fontStyle: 'italic', opacity: 0.8 }}>Video unavailable</Typography>;
  }

  if (safeType === 'audio') {
    const mediaUrl = message?.mediaUrl || message?.audio?.link || message?.url;
    return mediaUrl ? <audio controls style={{ width: '100%' }}><source src={mediaUrl} /></audio> : <Typography variant="body2" sx={{ fontStyle: 'italic', opacity: 0.8 }}>Audio unavailable</Typography>;
  }

  return <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text || 'Unsupported message payload'}</Typography>;
}

MessageRenderer.propTypes = {
  message: PropTypes.object,
  type: PropTypes.string,
};

MessageRenderer.defaultProps = {
  message: null,
  type: 'text',
};
