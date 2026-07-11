import { useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from '../../Components/Toast';
import { whatsappCloudService } from '../../services/whatsappCloudService';
import { parseApiError } from '../../utils/parseApiError';
import { useTemplates } from '../../hooks/useTemplates';

const CATEGORIES = ['UTILITY', 'MARKETING', 'AUTHENTICATION'];
const initialForm = { name: '', category: 'UTILITY', language: 'en_US', header: '', body: '', footer: '' };

export default function CreateTemplateForm() {
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { refetchTemplates } = useTemplates();

  const updateField = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.body.trim()) {
      toast.error('Template name and body are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      await whatsappCloudService.createTemplate({
        name: form.name.trim(),
        category: form.category,
        language: form.language,
        header: form.header.trim(),
        body: form.body.trim(),
        footer: form.footer.trim(),
      });
      toast.success('Template submitted to Meta for approval.');
      setForm(initialForm);
      refetchTemplates();
    } catch (error) {
      toast.error(parseApiError(error, 'Failed to create template.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6" fontWeight={700}>Create Template</Typography>
          <Typography variant="body2" color="text.secondary">
            Submits a new message template to Meta for approval. Newly created templates start in a
            &quot;Pending&quot; review state and can&apos;t be sent until Meta approves them.
          </Typography>
        </Box>

        <TextField
          label="Template name"
          value={form.name}
          onChange={updateField('name')}
          placeholder="order_confirmation"
          helperText="Lowercase letters, numbers, and underscores only"
          disabled={isSubmitting}
          required
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormControl fullWidth disabled={isSubmitting}>
            <InputLabel id="template-category-label">Category</InputLabel>
            <Select
              labelId="template-category-label"
              label="Category"
              value={form.category}
              onChange={updateField('category')}
            >
              {CATEGORIES.map((category) => (
                <MenuItem key={category} value={category}>{category}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Language"
            value={form.language}
            onChange={updateField('language')}
            placeholder="en_US"
            disabled={isSubmitting}
            required
          />
        </Stack>

        <TextField
          label="Header (optional)"
          value={form.header}
          onChange={updateField('header')}
          placeholder="Order Confirmed"
          disabled={isSubmitting}
        />

        <TextField
          label="Body"
          value={form.body}
          onChange={updateField('body')}
          placeholder="Hi {{1}}, your order #{{2}} has been confirmed."
          helperText="Use {{1}}, {{2}}, ... for variables"
          multiline
          minRows={3}
          disabled={isSubmitting}
          required
        />

        <TextField
          label="Footer (optional)"
          value={form.footer}
          onChange={updateField('footer')}
          placeholder="Thank you for shopping with us"
          disabled={isSubmitting}
        />

        <Button
          type="submit"
          variant="contained"
          startIcon={<AddRoundedIcon fontSize="small" />}
          disabled={isSubmitting}
          sx={{ alignSelf: 'flex-start' }}
        >
          {isSubmitting ? 'Submitting...' : 'Create Template'}
        </Button>
      </Stack>
    </Box>
  );
}
