import { useMemo, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import {
  Box,
  Button,
  FormControl,
  Grid,
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

// Meta rejects templates with {{n}} variables unless an example value is
// supplied for each one (example.body_text / example.header_text) — without
// this, reviewers/automation have no real content to evaluate against.
const countVariables = (text) => {
  const matches = String(text || '').match(/\{\{\d+\}\}/g) || [];
  const numbers = matches.map((token) => Number(token.replace(/\D/g, ''))).filter(Number.isFinite);
  return numbers.length ? Math.max(...numbers) : 0;
};

export default function CreateTemplateForm() {
  const [form, setForm] = useState(initialForm);
  const [bodyExamples, setBodyExamples] = useState([]);
  const [headerExample, setHeaderExample] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { refetchTemplates } = useTemplates();

  const bodyVariableCount = useMemo(() => countVariables(form.body), [form.body]);
  const headerHasVariable = useMemo(() => countVariables(form.header) > 0, [form.header]);

  const updateField = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  const updateBodyExample = (index) => (event) =>
    setBodyExamples((prev) => {
      const next = [...prev];
      next[index] = event.target.value;
      return next;
    });

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.body.trim()) {
      toast.error('Template name and body are required.');
      return;
    }

    if (bodyVariableCount > 0 && Array.from({ length: bodyVariableCount }).some((_, i) => !bodyExamples[i]?.trim())) {
      toast.error('Provide an example value for every {{variable}} in the body.');
      return;
    }
    if (headerHasVariable && !headerExample.trim()) {
      toast.error('Provide an example value for the {{variable}} in the header.');
      return;
    }

    try {
      setIsSubmitting(true);
      await whatsappCloudService.createTemplate({
        name: form.name.trim(),
        category: form.category,
        language: form.language,
        header: form.header.trim(),
        headerExample: headerExample.trim(),
        body: form.body.trim(),
        bodyExamples: bodyExamples.slice(0, bodyVariableCount).map((v) => v.trim()),
        footer: form.footer.trim(),
      });
      toast.success('Template submitted to Meta for approval.');
      setForm(initialForm);
      setBodyExamples([]);
      setHeaderExample('');
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

        {headerHasVariable && (
          <TextField
            label="Example value for header {{1}}"
            value={headerExample}
            onChange={(event) => setHeaderExample(event.target.value)}
            placeholder="Order #12345"
            helperText="Meta requires a realistic example for every variable — templates without one are auto-rejected"
            disabled={isSubmitting}
            required
          />
        )}

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

        {bodyVariableCount > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Meta requires a realistic example value for every body variable — templates without one are auto-rejected.
            </Typography>
            <Grid container spacing={1.5}>
              {Array.from({ length: bodyVariableCount }).map((_, index) => (
                <Grid item xs={12} sm={6} key={index}>
                  <TextField
                    fullWidth
                    size="small"
                    label={`Example for {{${index + 1}}}`}
                    value={bodyExamples[index] || ''}
                    onChange={updateBodyExample(index)}
                    disabled={isSubmitting}
                    required
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

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
