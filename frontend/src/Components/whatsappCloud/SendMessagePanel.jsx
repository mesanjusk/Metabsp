import { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Paper, Stack, TextField, Typography } from '@mui/material';
import TemplateMessageComposer from './TemplateMessageComposer';
import BulkSender from './BulkSender';

const initialForm = { to: '' };

export default function SendMessagePanel({ search }) {
  const [form, setForm] = useState(initialForm);

  return (
    <Stack spacing={2} sx={{ p: { xs: 1, md: 2 }, height: '100%', overflow: 'auto' }}>
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6" fontWeight={700}>Template Messaging</Typography>
            <Typography variant="body2" color="text.secondary">Send approved template messages instantly.</Typography>
          </Box>

          <TextField
            value={form.to}
            onChange={(event) => setForm((prev) => ({ ...prev, to: event.target.value }))}
            label="Recipient number"
            placeholder="+14155552671"
          />

          <TemplateMessageComposer recipient={form.to} className="space-y-3" buttonLabel="Send Template Message" />
        </Stack>
      </Paper>

      <BulkSender search={search} />
    </Stack>
  );
}

SendMessagePanel.propTypes = {
  search: PropTypes.string,
};

SendMessagePanel.defaultProps = {
  search: '',
};
