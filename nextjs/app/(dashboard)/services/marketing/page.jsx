'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import InstagramIcon from '@mui/icons-material/Instagram';
import FacebookRoundedIcon from '@mui/icons-material/FacebookRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import PageBody from '@/lib/ui/app/PageBody';
import apiClient from '@/lib/api/client';

export default function MarketingPublisherPage() {
  const [access, setAccess] = useState({});
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [instagramSelected, setInstagramSelected] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([
      apiClient.get('/api/services/access'),
      apiClient.get('/api/instagram/account'),
    ]).then(([accessResult, instagramResult]) => {
      if (!mounted) return;
      if (accessResult.status === 'fulfilled') {
        setAccess(accessResult.value?.data?.data || {});
      }
      if (instagramResult.status === 'fulfilled') {
        setInstagramConnected(Boolean(instagramResult.value?.data?.data));
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const instagramAvailable = useMemo(
    () => access?.instagram?.enabled === true && instagramConnected,
    [access, instagramConnected]
  );

  const publish = async () => {
    if (!instagramSelected || !instagramAvailable || !imageUrl.trim()) return;
    setPublishing(true);
    setResult('');
    try {
      const response = await apiClient.post('/api/instagram/publish', {
        imageUrl: imageUrl.trim(),
        caption: caption.trim(),
      });
      const mediaId = response?.data?.data?.mediaId;
      setResult(mediaId ? `Published to Instagram · ${mediaId}` : 'Published to Instagram.');
    } catch (error) {
      setResult(error?.response?.data?.message || 'Publishing failed.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <PageBody
      title="Marketing & Publisher"
      description="Create content once and publish it to the business channels connected to this workspace."
    >
      <Stack spacing={2.5}>
        <Alert severity="info">
          Instagram image publishing is available now. Facebook Pages and Google Business Profile are already represented in the publisher, but stay locked until their API permissions and OAuth connections are added.
        </Alert>

        <Card variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
          <Stack spacing={2.25}>
            <Typography variant="h6" fontWeight={700}>Channels</Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 1.5, py: 0.75 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={instagramSelected && instagramAvailable}
                      onChange={(event) => setInstagramSelected(event.target.checked)}
                      disabled={!instagramAvailable}
                    />
                  }
                  label={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <InstagramIcon fontSize="small" />
                      <Typography variant="body2">Instagram</Typography>
                      <Chip size="small" label={instagramAvailable ? 'Ready' : access?.instagram?.enabled ? 'Connect account' : 'Not included'} color={instagramAvailable ? 'success' : 'default'} />
                    </Stack>
                  }
                />
              </Box>

              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 1.5, py: 0.75, opacity: 0.7 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <FacebookRoundedIcon fontSize="small" />
                  <Typography variant="body2">Facebook Page</Typography>
                  <Chip size="small" label="Permission needed" variant="outlined" />
                </Stack>
              </Box>

              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 1.5, py: 0.75, opacity: 0.7 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <StorefrontRoundedIcon fontSize="small" />
                  <Typography variant="body2">Google Business Profile</Typography>
                  <Chip size="small" label="API access needed" variant="outlined" />
                </Stack>
              </Box>
            </Stack>

            <TextField
              label="Public HTTPS image URL"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://.../post-image.jpg"
              fullWidth
            />
            <TextField
              label="Caption"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              multiline
              minRows={4}
              fullWidth
              helperText={`${caption.length}/2200 characters for Instagram`}
            />

            <Stack direction="row" spacing={1.5} alignItems="center">
              <Button
                variant="contained"
                startIcon={publishing ? <CircularProgress size={16} color="inherit" /> : <SendRoundedIcon />}
                onClick={publish}
                disabled={publishing || !instagramAvailable || !instagramSelected || !imageUrl.trim()}
              >
                {publishing ? 'Publishing…' : 'Publish now'}
              </Button>
              {result ? <Typography variant="body2" color="text.secondary">{result}</Typography> : null}
            </Stack>
          </Stack>
        </Card>
      </Stack>
    </PageBody>
  );
}
