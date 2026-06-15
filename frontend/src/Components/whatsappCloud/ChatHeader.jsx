import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import PropTypes from 'prop-types';
import { Avatar, Box, IconButton, Stack, Typography } from '@mui/material';

export default function ChatHeader({ conversation, onRefresh, onBack, windowOpen }) {
  return (
    <Box sx={{ px: 1.2, py: 0.9, bgcolor: '#f0f2f5', borderBottom: '1px solid #d1d7db', position: 'sticky', top: 0, zIndex: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton size="small" sx={{ display: { xs: 'inline-flex', lg: 'none' } }} onClick={onBack}>
          <ArrowBackRoundedIcon fontSize="small" />
        </IconButton>
        <Avatar sx={{ width: 34, height: 34, bgcolor: '#25d366', fontSize: 12 }}>
          {(conversation?.displayName || conversation?.contact || 'NA').slice(0, 2).toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle2" noWrap>{conversation?.displayName || conversation?.contact}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {windowOpen ? '24h session active' : '24h session expired'}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onRefresh}>
          <RefreshRoundedIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Box>
  );
}

ChatHeader.propTypes = {
  conversation: PropTypes.object,
  onRefresh: PropTypes.func,
  onBack: PropTypes.func,
  windowOpen: PropTypes.bool,
};

ChatHeader.defaultProps = {
  conversation: null,
  onRefresh: () => {},
  onBack: () => {},
  windowOpen: false,
};
