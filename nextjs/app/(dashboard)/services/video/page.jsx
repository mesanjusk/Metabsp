'use client';

import { useCallback, useEffect, useState } from 'react';
import NextLink from 'next/link';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ComputerRoundedIcon from '@mui/icons-material/ComputerRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';

const STATUS_TONE = {
  draft: 'default',
  story: 'info',
  characters: 'info',
  backgrounds: 'info',
  scenes: 'warning',
  rendering: 'warning',
  done: 'success',
};

export default function VideoServicePage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [localRunner, setLocalRunner] = useState({ configured: false, online: false, message: 'Checking local Video PC…' });
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [setupError, setSetupError] = useState('');
  const [copiedStep, setCopiedStep] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/video/projects');
      setProjects(response?.data?.projects || []);
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 401
          ? 'Your session was not accepted by the Video Studio API. Sign out and back in, then try again.'
          : err?.response?.data?.error || 'Could not load your video projects.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLocalRunner = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/video/local-agent/status');
      setLocalRunner(response?.data?.data || { configured: false, online: false, message: 'Local Video PC status unavailable' });
    } catch {
      // A transient status request should not make a configured runner look unconfigured.
      setLocalRunner((current) => ({ ...current, online: false, message: 'Could not refresh local Video PC status.' }));
    }
  }, []);

  const openSetup = useCallback(async () => {
    setSetupOpen(true);
    setSetupLoading(true);
    setSetupError('');
    setSetupData(null);
    setCopiedStep(null);
    try {
      const response = await apiClient.get('/api/video/local-agent/setup');
      setSetupData(response?.data?.data || null);
    } catch (err) {
      setSetupError(err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Could not prepare local Video PC setup.');
    } finally {
      setSetupLoading(false);
    }
  }, []);

  const copyCommand = async (command, index) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedStep(index);
      setTimeout(() => setCopiedStep((current) => (current === index ? null : current)), 1800);
    } catch {
      setCopiedStep(null);
    }
  };

  useEffect(() => {
    load();
    loadLocalRunner();
  }, [load, loadLocalRunner]);

  useEffect(() => {
    const timer = setInterval(loadLocalRunner, 15000);
    return () => clearInterval(timer);
  }, [loadLocalRunner]);

  return (
    <PageBody
      title="Video Studio"
      description="One idea becomes a finished short: script, characters, scene stills, clips, voice-over and the final cut."
    >
      <Stack spacing={2}>
        <Card variant="outlined">
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between">
              <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                <ComputerRoundedIcon color={localRunner.online ? 'success' : 'disabled'} />
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="subtitle2" fontWeight={800}>Local Video PC</Typography>
                    <Chip
                      size="small"
                      color={localRunner.online ? 'success' : localRunner.configured ? 'warning' : 'default'}
                      label={localRunner.online ? 'Online' : localRunner.configured ? 'Offline' : 'Not configured'}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {localRunner.message} Browser-heavy Google Flow work runs here when online; cloud automation remains the fallback.
                  </Typography>
                </Box>
              </Stack>
              <Button size="small" variant="outlined" startIcon={<ComputerRoundedIcon />} onClick={openSetup}>
                Local PC Setup
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Typography variant="body2" color="text.secondary">
            {loading ? 'Loading…' : `${projects.length} project${projects.length === 1 ? '' : 's'}`}
          </Typography>
          <Button
            component={NextLink}
            href="/services/video/new"
            variant="contained"
            size="small"
            startIcon={<AddRoundedIcon />}
          >
            New video
          </Button>
        </Stack>

        {error ? <Alert severity="error">{error}</Alert> : null}

        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress size={26} />
          </Stack>
        ) : null}

        {!loading && !error && projects.length === 0 ? (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>No videos yet</Typography>
              <Typography variant="body2" color="text.secondary">
                Start with one sentence about what the video should be about. The studio writes the script,
                draws the cast and scenes, then assembles the cut.
              </Typography>
            </CardContent>
          </Card>
        ) : null}

        {projects.map((project) => (
          <Card key={project._id} variant="outlined">
            <CardActionArea component={NextLink} href={`/services/video/${project._id}`}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" noWrap>{project.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {project.style} · {project.targetPlatform} · {project.durationSeconds}s
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={project.status}
                    color={STATUS_TONE[project.status] || 'default'}
                    variant={project.status === 'done' ? 'filled' : 'outlined'}
                  />
                </Stack>
                {typeof project.completionPercent === 'number' ? (
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, Math.max(0, project.completionPercent))}
                    sx={{ mt: 1.5, height: 6, borderRadius: 3 }}
                  />
                ) : null}
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Stack>

      <Dialog open={setupOpen} onClose={() => setSetupOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Local Video PC Setup</DialogTitle>
        <DialogContent dividers>
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            One-time setup for a trusted Windows PC. Google Flow runs in that PC's Chrome session; MetaBSP stays in the cloud.
          </Typography>
          <Typography variant="body2" fontWeight={700} sx={{ mb: 2 }}>
            No Docker or WSL required. Chrome extension setup is required once per Chrome profile.
          </Typography>
          {setupLoading ? <Stack alignItems="center" sx={{ py: 5 }}><CircularProgress /></Stack> : null}
          {setupError ? <Alert severity="error" sx={{ my: 1 }}>{setupError}</Alert> : null}
          {!setupLoading && setupData?.note ? <Alert severity="info" sx={{ mb: 2 }}>{setupData.note}</Alert> : null}
          {!setupLoading && setupData?.commands ? (
            <Stack spacing={2}>
              {setupData.commands.map((step, index) => (
                <Box key={`${step.title}-${index}`} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                    <Box>
                      <Typography fontWeight={800}>{step.title}{step.optional ? ' (optional)' : ''}</Typography>
                      <Typography variant="body2" color="text.secondary">{step.note}</Typography>
                    </Box>
                    <Button size="small" variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => copyCommand(step.command, index)}>
                      {copiedStep === index ? 'Copied' : 'Copy'}
                    </Button>
                  </Stack>
                  <Box component="pre" sx={{ mt: 1.5, mb: 0, p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover', overflowX: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 13 }}>
                    {step.command}
                  </Box>
                </Box>
              ))}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSetupOpen(false)}>Close</Button>
          <Button variant="contained" onClick={openSetup} disabled={setupLoading}>Refresh Setup</Button>
        </DialogActions>
      </Dialog>
    </PageBody>
  );
}
