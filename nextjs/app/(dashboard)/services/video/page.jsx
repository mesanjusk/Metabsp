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
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';

/**
 * The Video Studio's home inside Metabsp.
 *
 * Every project this lists comes from the ported studio: `/api/video/projects` is the studio's own
 * route handler, running its own service layer against this app's Mongo connection, authenticated
 * by this app's session token. Nothing here reimplements it — the page is a thin client over an API
 * that already existed, which is the whole point of porting the server half first.
 */

/** The pipeline's own words for where a project is. Colour follows meaning, not the enum's order. */
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

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/api/video/projects');
      setProjects(response?.data?.projects || []);
    } catch (err) {
      // 401 means the session did not reach the studio's routes — worth saying plainly, because it
      // is the one failure whose cause is this port rather than the pipeline.
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

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageBody
      title="Video Studio"
      description="One idea becomes a finished short: script, characters, scene stills, clips, voice-over and the final cut."
    >
      <Stack spacing={2}>
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
              <Typography variant="subtitle1" gutterBottom>
                No videos yet
              </Typography>
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
                    <Typography variant="subtitle1" noWrap>
                      {project.title}
                    </Typography>
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
    </PageBody>
  );
}
