'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import NextLink from 'next/link';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';

/**
 * One project, one screen.
 *
 * The studio's own detail page is a six-section control panel for an operator who approves each
 * stage. This is the other view it ships — the one a `pipelineMode: 'full'` project gets — because
 * that is the only mode this deployment can serve, and because there is nothing here for a person
 * to decide. One number, one sentence, one button, exactly as `core/production/progress.ts` was
 * written to produce.
 *
 * It polls rather than streams. A video takes minutes, the payload is tiny, and a poll survives a
 * closed laptop lid and a restarted server in a way an open socket does not. The loop stops the
 * moment the pipeline does, so a finished video is not still costing a request every four seconds.
 */

const PHASE_TONE = {
  ready: 'success',
  problem: 'error',
  waiting: 'warning',
};

const POLL_BUSY_MS = 4000;
const POLL_ERROR_MS = 8000;

export default function VideoProjectPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);
  const [optimisticStart, setOptimisticStart] = useState(false);
  const timer = useRef(null);
  const cancelled = useRef(false);

  const poll = useCallback(async () => {
    try {
      const response = await apiClient.get(`/api/video/projects/${projectId}/progress`);
      if (cancelled.current) return;
      setData(response?.data || null);
      setError('');
      // Only while something is actually running. A project nobody has started also reports
      // busy: true (see `started` below), and polling that every four seconds forever asks a
      // question whose answer cannot change until someone presses a button.
      const payload = response?.data;
      if (payload?.progress?.busy && payload?.started) timer.current = setTimeout(poll, POLL_BUSY_MS);
    } catch (err) {
      if (cancelled.current) return;
      setError(err?.response?.data?.error || 'Could not check on your video.');
      // Keep trying. A dropped request during a ten-minute render should not leave this page stuck
      // on an error it would recover from by itself.
      timer.current = setTimeout(poll, POLL_ERROR_MS);
    }
  }, [projectId]);

  useEffect(() => {
    cancelled.current = false;
    apiClient
      .get(`/api/video/projects/${projectId}`)
      .then((response) => {
        if (!cancelled.current) setProject(response?.data?.project || null);
      })
      .catch((err) => {
        if (!cancelled.current) setError(err?.response?.data?.error || 'Could not load this project.');
      });
    poll();

    return () => {
      cancelled.current = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [projectId, poll]);

  // "Not started" cannot be read off `progress`. A draft project reports phase "writing" with
  // busy: true whether its story job is running or was never created, so branching on `busy` hides
  // the Start button behind a progress bar that will never move. `started` is the progress
  // endpoint's count of this project's jobs, which is the actual question; `optimisticStart` covers
  // the seconds between pressing the button and the first poll that sees the new job row.
  const hasStory = (project?.storyJson?.scenes?.length ?? 0) > 0;
  const started = data?.started === true || optimisticStart || hasStory;

  async function start() {
    setActing(true);
    setError('');
    try {
      await apiClient.post(`/api/video/projects/${projectId}/story`);
      // The job row exists now; the next poll will report started: true on its own. This just keeps
      // the button from reappearing in the meantime.
      setOptimisticStart(true);
      poll();
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not start your video.');
    } finally {
      setActing(false);
    }
  }

  async function retry() {
    if (!data?.failedJobId) return;
    setActing(true);
    setError('');
    try {
      await apiClient.post(`/api/video/jobs/${data.failedJobId}/retry`);
      poll();
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not run that step again.');
    } finally {
      setActing(false);
    }
  }

  const progress = data?.progress;
  const title = data?.title || project?.title || 'Your video';
  const done = progress?.phase === 'ready' && data?.videoUrl;

  return (
    <PageBody maxWidth={720}>
      <Stack spacing={2.5}>
        <Button
          component={NextLink}
          href="/services/video"
          startIcon={<ArrowBackRoundedIcon />}
          size="small"
          sx={{ alignSelf: 'flex-start' }}
        >
          All videos
        </Button>

        {error ? <Alert severity="error">{error}</Alert> : null}

        {!data && !error ? (
          <Stack alignItems="center" sx={{ py: 8 }}>
            <CircularProgress size={26} />
          </Stack>
        ) : null}

        {project && data && !started ? (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2} alignItems="flex-start">
                <Typography variant="h5">{project.premise || project.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  This becomes a scene-by-scene script, then the cast and the shots, then a finished cut.
                  Nothing else to fill in — press start and leave it running.
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  onClick={start}
                  disabled={acting}
                  startIcon={acting ? <CircularProgress size={16} color="inherit" /> : <PlayArrowRoundedIcon />}
                >
                  {acting ? 'Starting…' : 'Start'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        {progress && started ? (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Typography variant="h6" sx={{ minWidth: 0 }} noWrap>
                    {title}
                  </Typography>
                  <Chip
                    size="small"
                    label={progress.title}
                    color={PHASE_TONE[progress.phase] || 'primary'}
                    variant={progress.phase === 'ready' ? 'filled' : 'outlined'}
                  />
                </Stack>

                <Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, Math.max(0, progress.percent ?? 0))}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.75 }}>
                    <Typography variant="caption" color="text.secondary">
                      {progress.scenesTotal > 0
                        ? `${progress.scenesDone} of ${progress.scenesTotal} scenes`
                        : 'Getting started'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {progress.percent ?? 0}%
                    </Typography>
                  </Stack>
                </Box>

                {progress.detail ? (
                  <Typography variant="body2" color="text.secondary">
                    {progress.detail}
                  </Typography>
                ) : null}

                {data?.failure ? <Alert severity="warning">{data.failure}</Alert> : null}

                {progress.action ? (
                  <Box>
                    {progress.action.target === 'retry' ? (
                      <Button
                        variant="contained"
                        onClick={retry}
                        disabled={acting || !data?.failedJobId}
                        startIcon={acting ? <CircularProgress size={16} color="inherit" /> : <RefreshRoundedIcon />}
                      >
                        {progress.action.label}
                      </Button>
                    ) : (
                      <Button component={NextLink} href={progress.href || '/services/video'} variant="contained">
                        {progress.action.label}
                      </Button>
                    )}
                  </Box>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        {done ? (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2}>
                <Box
                  component="video"
                  src={data.videoUrl}
                  poster={data.thumbnailUrl || undefined}
                  controls
                  playsInline
                  sx={{ width: '100%', borderRadius: 2, bgcolor: 'common.black', display: 'block' }}
                />
                {/* A plain anchor with `download`, not a fetch-and-save: the file is already public
                    on the storage provider, and the browser's own download is faster, resumable and
                    works on a phone. */}
                <Button
                  component="a"
                  href={data.videoUrl}
                  download
                  variant="contained"
                  size="large"
                  startIcon={<DownloadRoundedIcon />}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Download
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ) : null}
      </Stack>
    </PageBody>
  );
}
