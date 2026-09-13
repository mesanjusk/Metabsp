'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NextLink from 'next/link';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';

/**
 * Starting a video.
 *
 * The studio's own wizard is four animated steps over React Hook Form and shadcn; this is one
 * screen of MUI, because the four steps only ever collected nine fields and Metabsp has no
 * animation layer to borrow. What it does keep is the part that matters: the field names and the
 * validation are the ones `createProjectSchema` enforces server-side, so a form that passes here
 * passes there, and the two cannot drift into disagreeing about what a project is.
 *
 * Every new project is `pipelineMode: 'full'`. The alternative modes exist for an operator who
 * wants to approve each stage, and nothing in this deployment can serve that: the clips come back
 * through a browser extension on someone's desktop, not from a console someone is watching. One
 * sentence in, a finished short out, is the only shape that works here.
 */

const STYLES = ['Pixar', 'Disney', 'Anime', 'Realistic', '3D', 'Custom'];
const PLATFORMS = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
];
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'mr', label: 'Marathi' },
];

export default function NewVideoPage() {
  const router = useRouter();
  const [values, setValues] = useState({
    title: '',
    language: 'en',
    videoType: 'short',
    durationSeconds: 60,
    targetPlatform: 'youtube',
    style: 'Pixar',
    customStyleDescription: '',
    storyInputMode: 'idea',
    premise: '',
    pastedScript: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (field) => (event) => setValues((v) => ({ ...v, [field]: event.target.value }));

  // Mirrors createProjectSchema's superRefine. Checking here is a courtesy — the server checks
  // again regardless, and its answer is the one that counts.
  const problem = useMemo(() => {
    if (values.title.trim().length < 2) return 'Give your project a name.';
    if (values.style === 'Custom' && !values.customStyleDescription.trim()) return 'Describe your custom style.';
    if (values.storyInputMode === 'idea' && !values.premise.trim()) return 'Tell us your idea.';
    if (values.storyInputMode === 'script' && !values.pastedScript.trim()) return 'Paste your script.';
    const seconds = Number(values.durationSeconds);
    if (!Number.isFinite(seconds) || seconds < 15 || seconds > 600) return 'Length must be between 15 and 600 seconds.';
    return '';
  }, [values]);

  async function submit(event) {
    event.preventDefault();
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...values,
        durationSeconds: Number(values.durationSeconds),
        // Sent only when they mean something, so an unused textarea does not become an empty string
        // the schema has to carry.
        customStyleDescription: values.style === 'Custom' ? values.customStyleDescription : undefined,
        premise: values.storyInputMode === 'idea' ? values.premise : undefined,
        pastedScript: values.storyInputMode === 'script' ? values.pastedScript : undefined,
      };
      const created = await apiClient.post('/api/video/projects', payload);
      const project = created?.data?.project;
      if (!project?._id) throw new Error('The studio did not return a project.');

      // Best-effort, exactly like the original wizard's character assignment: the project exists
      // either way, and the studio page can set the mode itself if this did not land.
      await apiClient.patch(`/api/video/projects/${project._id}`, { pipelineMode: 'full' }).catch(() => {});

      router.push(`/services/video/${project._id}`);
    } catch (err) {
      const issues = err?.response?.data?.issues?.fieldErrors;
      const first = issues ? Object.values(issues).flat()[0] : null;
      setError(first || err?.response?.data?.error || 'Could not create your project. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <PageBody title="New video" description="Describe it in one sentence. The studio does the rest." maxWidth={720}>
      <Box component="form" onSubmit={submit}>
        <Stack spacing={2.5}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2.5}>
                <TextField
                  label="Project name"
                  placeholder="e.g. Ravi's Big Ice Cream Adventure"
                  value={values.title}
                  onChange={set('title')}
                  fullWidth
                  autoFocus
                  required
                />

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField select label="Language" value={values.language} onChange={set('language')} fullWidth>
                    {LANGUAGES.map((l) => (
                      <MenuItem key={l.value} value={l.value}>{l.label}</MenuItem>
                    ))}
                  </TextField>
                  <TextField select label="Platform" value={values.targetPlatform} onChange={set('targetPlatform')} fullWidth>
                    {PLATFORMS.map((p) => (
                      <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Length"
                    type="number"
                    value={values.durationSeconds}
                    onChange={set('durationSeconds')}
                    fullWidth
                    inputProps={{ min: 15, max: 600, step: 15 }}
                    helperText="Seconds"
                  />
                </Stack>

                <TextField select label="Style" value={values.style} onChange={set('style')} fullWidth>
                  {STYLES.map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </TextField>

                {values.style === 'Custom' ? (
                  <TextField
                    label="Describe your style"
                    value={values.customStyleDescription}
                    onChange={set('customStyleDescription')}
                    fullWidth
                    multiline
                    minRows={2}
                    inputProps={{ maxLength: 500 }}
                  />
                ) : null}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Your story</Typography>
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={values.storyInputMode}
                    onChange={(_e, mode) => mode && setValues((v) => ({ ...v, storyInputMode: mode }))}
                  >
                    <ToggleButton value="idea">Just an idea</ToggleButton>
                    <ToggleButton value="script">I have a script</ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                {values.storyInputMode === 'idea' ? (
                  <TextField
                    label="What should the video be about?"
                    placeholder="A shy boy finally works up the courage to order an ice cream, and makes a friend doing it."
                    value={values.premise}
                    onChange={set('premise')}
                    fullWidth
                    multiline
                    minRows={4}
                    inputProps={{ maxLength: 2000 }}
                    helperText="Plain words. No prompt writing needed — the studio turns this into a scene-by-scene script."
                  />
                ) : (
                  <TextField
                    label="Paste your script"
                    value={values.pastedScript}
                    onChange={set('pastedScript')}
                    fullWidth
                    multiline
                    minRows={8}
                    inputProps={{ maxLength: 20000 }}
                  />
                )}
              </Stack>
            </CardContent>
          </Card>

          <Stack direction="row" spacing={1.5} justifyContent="flex-end">
            <Button component={NextLink} href="/services/video" disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {submitting ? 'Creating…' : 'Create project'}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </PageBody>
  );
}
