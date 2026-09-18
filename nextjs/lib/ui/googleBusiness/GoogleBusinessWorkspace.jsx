'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Rating,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import PageBody from '@/lib/ui/app/PageBody';
import {
  disconnectGoogleBusiness,
  draftGoogleContent,
  fetchGoogleBusinessAccount,
  fetchGoogleBusinessLocations,
  fetchGoogleBusinessOAuthUrl,
  fetchGoogleBusinessPerformance,
  fetchGooglePosts,
  fetchGoogleReviews,
  fetchGoogleReviewSettings,
  publishGooglePost,
  syncGoogleReviews,
  updateGoogleReviewSettings,
  replyToGoogleReview,
  selectGoogleBusinessLocation,
  sendGoogleReviewRequest,
} from '@/lib/client/services/googleBusinessService';

const payload = (response) => response?.data?.data ?? null;
const errorText = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const CALL_TO_ACTIONS = [
  { value: 'LEARN_MORE', label: 'Learn more' },
  { value: 'BOOK', label: 'Book' },
  { value: 'ORDER', label: 'Order online' },
  { value: 'SHOP', label: 'Shop' },
  { value: 'SIGN_UP', label: 'Sign up' },
  { value: 'CALL', label: 'Call now' },
  { value: 'NONE', label: 'No button' },
];

/** A KPI that says what it is, not just what it equals. */
function Metric({ label, value, hint }) {
  return (
    <Card variant="outlined" sx={{ flex: '1 1 160px', minWidth: 150 }}>
      <CardContent sx={{ py: 2 }}>
        <Typography variant="h5" fontWeight={750}>{value}</Typography>
        <Typography variant="body2" fontWeight={600}>{label}</Typography>
        {hint ? (
          <Typography variant="caption" color="text.secondary">{hint}</Typography>
        ) : null}
      </CardContent>
    </Card>
  );
}


/**
 * Google Business Profile, one screen at a time.
 *
 * The four screens below used to be tabs inside this page: a single URL for all of them, nothing
 * linkable, and none of them in the sidebar where the rest of the product keeps its navigation.
 * They are routes now, and `tab` says which one the route asked for. Everything else — the OAuth
 * state, the account and location pickers, the loaders — is shared, so it stays one component
 * rather than four that each have to re-establish a connection.
 */
const SCREENS = {
  overview: {
    title: 'Google Business Profile',
    description: 'How your profile is doing on Google Search and Maps over the last 30 days.',
  },
  reviews: {
    title: 'Reviews',
    description: 'What customers wrote, with AI drafts, approval controls and optional automatic replies for higher ratings.',
  },
  posts: {
    title: 'Posts',
    description: 'Updates published to your profile on Search and Maps.',
  },
  requests: {
    title: 'Ask for reviews',
    description: 'Send a customer the link that opens your profile\u2019s review form.',
  },
};

export default function GoogleBusinessWorkspace({ tab = 'overview' }) {
  const screen = SCREENS[tab] || SCREENS.overview;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [account, setAccount] = useState(null);
  const [configured, setConfigured] = useState(true);
  const [aiConfigured, setAiConfigured] = useState(false);

  const [locationOptions, setLocationOptions] = useState({ accounts: [], locations: [], activeAccount: '' });
  const [performance, setPerformance] = useState(null);
  const [reviews, setReviews] = useState({ reviews: [], summary: null, newReviewUri: '' });
  const [replyDrafts, setReplyDrafts] = useState({});
  const [reviewSettings, setReviewSettings] = useState({
    autoReplyEnabled: false,
    autoReplyMinRating: 4,
    customToneRules: '',
    allowReviewReplyEmojis: false,
    reviewSupportContact: '',
  });
  const [posts, setPosts] = useState([]);

  const [postTopic, setPostTopic] = useState('');
  const [postText, setPostText] = useState('');
  const [postAction, setPostAction] = useState('LEARN_MORE');
  const [postActionUrl, setPostActionUrl] = useState('');
  const [postImageUrl, setPostImageUrl] = useState('');

  const [requestPhone, setRequestPhone] = useState('');
  const [requestName, setRequestName] = useState('');
  const [requestMessage, setRequestMessage] = useState('');

  const connected = Boolean(account && account.status === 'active');
  const locationSelected = Boolean(account?.locationName);

  const loadAccount = useCallback(async () => {
    setLoading(true);
    try {
      const data = payload(await fetchGoogleBusinessAccount());
      setAccount(data?.account || null);
      setConfigured(data?.configured !== false);
      setAiConfigured(Boolean(data?.aiConfigured));
      if (data?.account?.locationWebsite && !postActionUrl) setPostActionUrl(data.account.locationWebsite);
    } catch (requestError) {
      setError(errorText(requestError, 'Could not load the Google Business connection.'));
    } finally {
      setLoading(false);
    }
  }, [postActionUrl]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) setError(params.get('error'));
    if (params.get('connected') === '1') setNotice('Google Business Profile connected.');
    loadAccount();
    // loadAccount is recreated whenever postActionUrl changes; this effect is
    // the one-time mount load, so it deliberately does not follow it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Everything the workspace shows once a location is chosen. */
  const loadWorkspace = useCallback(async () => {
    setBusy(true);
    setError('');
    const [performanceResult, reviewsResult, postsResult] = await Promise.allSettled([
      fetchGoogleBusinessPerformance(30),
      fetchGoogleReviews(),
      fetchGooglePosts(),
    ]);

    if (performanceResult.status === 'fulfilled') setPerformance(payload(performanceResult.value));
    if (reviewsResult.status === 'fulfilled') {
      const reviewData = payload(reviewsResult.value) || { reviews: [], summary: null };
      setReviews(reviewData);
      const drafts = {};
      for (const record of reviewData.records || []) {
        if (record?.reviewId && record?.replyStatus !== 'PUBLISHED' && record?.reviewReplyText) {
          drafts[record.reviewId] = record.reviewReplyText;
        }
      }
      setReplyDrafts((current) => ({ ...current, ...drafts }));
    }
    if (postsResult.status === 'fulfilled') setPosts(payload(postsResult.value) || []);

    const failure = [performanceResult, reviewsResult, postsResult].find((item) => item.status === 'rejected');
    if (failure) setError(errorText(failure.reason, 'Some Google Business data could not be loaded.'));
    setBusy(false);
  }, []);

  useEffect(() => {
    if (connected && locationSelected) loadWorkspace();
  }, [connected, locationSelected, loadWorkspace]);

  useEffect(() => {
    if (!connected) return;
    fetchGoogleReviewSettings()
      .then((response) => setReviewSettings((current) => ({ ...current, ...(payload(response) || {}) })))
      .catch(() => {});
  }, [connected]);

  /**
   * `accountName` is optional and omitted on the first load, where the server
   * falls back to the account stored at connect time. It is passed when the
   * merchant picks a different one: a Google identity can manage several
   * Business accounts (an agency, or a brand split across entities), and the
   * profile they want is not always under the first.
   */
  const loadLocations = useCallback(async (accountName) => {
    setBusy(true);
    try {
      const data = payload(await fetchGoogleBusinessLocations(accountName)) || { accounts: [], locations: [] };
      setLocationOptions(data);
    } catch (requestError) {
      setError(errorText(requestError, 'Could not load Google Business locations.'));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (connected && !locationSelected) loadLocations();
  }, [connected, locationSelected, loadLocations]);

  const connect = async () => {
    setBusy(true);
    setError('');
    try {
      const url = payload(await fetchGoogleBusinessOAuthUrl())?.authorizationUrl;
      if (!url) throw new Error('Authorization URL was not returned.');
      window.location.assign(url);
    } catch (requestError) {
      setError(errorText(requestError, 'Could not start Google authorization.'));
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await disconnectGoogleBusiness();
      setAccount(null);
      setPerformance(null);
      setReviews({ reviews: [], summary: null, newReviewUri: '' });
      setPosts([]);
      setNotice('Google Business Profile disconnected and the access revoked at Google.');
    } catch (requestError) {
      setError(errorText(requestError, 'Could not disconnect the profile.'));
    } finally {
      setBusy(false);
    }
  };

  const chooseLocation = async (accountName, locationName) => {
    setBusy(true);
    setError('');
    try {
      setAccount(payload(await selectGoogleBusinessLocation(accountName, locationName)));
      setNotice('Location selected.');
    } catch (requestError) {
      setError(errorText(requestError, 'Could not select that location.'));
    } finally {
      setBusy(false);
    }
  };

  const saveReviewSettings = async () => {
    setBusy(true);
    setError('');
    try {
      const saved = payload(await updateGoogleReviewSettings(reviewSettings));
      setReviewSettings((current) => ({ ...current, ...(saved || {}) }));
      setNotice(
        saved?.autoReplyEnabled
          ? `Automatic replies enabled for ${saved.autoReplyMinRating}★ and above. Lower ratings still require approval.`
          : 'Automatic replies are off. AI drafts will wait for approval.'
      );
    } catch (requestError) {
      setError(errorText(requestError, 'Could not save review automation settings.'));
    } finally {
      setBusy(false);
    }
  };

  const syncReviewsNow = async () => {
    setBusy(true);
    setError('');
    try {
      await syncGoogleReviews();
      setNotice('Google reviews synced and the reply queue updated.');
      await loadWorkspace();
    } catch (requestError) {
      setError(errorText(requestError, 'Could not sync Google reviews.'));
      setBusy(false);
    }
  };

  const draftReply = async (reviewId) => {
    setBusy(true);
    setError('');
    try {
      const draft = payload(await draftGoogleContent({ kind: 'review-reply', reviewId }))?.draft || '';
      setReplyDrafts((current) => ({ ...current, [reviewId]: draft }));
    } catch (requestError) {
      setError(errorText(requestError, 'Could not draft a reply.'));
    } finally {
      setBusy(false);
    }
  };

  const publishReply = async (reviewId) => {
    const comment = String(replyDrafts[reviewId] || '').trim();
    if (!comment) return;
    setBusy(true);
    setError('');
    try {
      await replyToGoogleReview(reviewId, comment);
      setReplyDrafts((current) => ({ ...current, [reviewId]: '' }));
      setNotice('Reply published on Google.');
      const refreshed = payload(await fetchGoogleReviews());
      if (refreshed) setReviews(refreshed);
    } catch (requestError) {
      setError(errorText(requestError, 'Could not publish the reply.'));
    } finally {
      setBusy(false);
    }
  };

  const draftPost = async () => {
    setBusy(true);
    setError('');
    try {
      const draft = payload(await draftGoogleContent({ kind: 'post', topic: postTopic }))?.draft || '';
      setPostText(draft);
    } catch (requestError) {
      setError(errorText(requestError, 'Could not draft a post.'));
    } finally {
      setBusy(false);
    }
  };

  const publishPost = async () => {
    setBusy(true);
    setError('');
    try {
      await publishGooglePost({
        summary: postText,
        actionType: postAction,
        actionUrl: postActionUrl,
        mediaUrl: postImageUrl,
      });
      setPostText('');
      setPostTopic('');
      setPostImageUrl('');
      setNotice('Post published to the Google Business Profile.');
      setPosts(payload(await fetchGooglePosts()) || []);
    } catch (requestError) {
      setError(errorText(requestError, 'Could not publish the post.'));
    } finally {
      setBusy(false);
    }
  };

  const draftRequest = async () => {
    setBusy(true);
    setError('');
    try {
      const draft = payload(await draftGoogleContent({ kind: 'review-request', customerName: requestName }))?.draft || '';
      setRequestMessage(draft);
    } catch (requestError) {
      setError(errorText(requestError, 'Could not draft the request.'));
    } finally {
      setBusy(false);
    }
  };

  const sendRequest = async () => {
    setBusy(true);
    setError('');
    try {
      await sendGoogleReviewRequest(requestPhone, requestMessage);
      setNotice('Review request sent on WhatsApp.');
      setRequestPhone('');
      setRequestName('');
    } catch (requestError) {
      setError(errorText(requestError, 'Could not send the review request.'));
    } finally {
      setBusy(false);
    }
  };

  const unanswered = useMemo(
    () => (reviews.reviews || []).filter((review) => !review.reply),
    [reviews]
  );

  if (loading) {
    return (
      <PageBody title={screen.title} description={screen.description}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
      </PageBody>
    );
  }

  return (
    <PageBody
      title={screen.title}
      description={screen.description}
      actions={connected && locationSelected ? (
        <Button size="small" startIcon={<RefreshRoundedIcon />} onClick={loadWorkspace} disabled={busy}>
          Refresh
        </Button>
      ) : null}
    >
      <Stack spacing={2.5}>
        {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}
        {notice ? <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert> : null}

        {!connected ? (
          <Card variant="outlined" sx={{ minWidth: 0, overflow: 'hidden' }}>
            <CardContent sx={{ minWidth: 0, p: { xs: 2, sm: 3 } }}>
              <Stack spacing={2} alignItems="flex-start" sx={{ minWidth: 0 }}>
                <Avatar sx={{ width: 52, height: 52 }}><StorefrontRoundedIcon /></Avatar>
                <Box sx={{ minWidth: 0, width: '100%' }}>
                  <Typography variant="h6" fontWeight={700}>Connect your Google Business Profile</Typography>
                  <Typography
                    color="text.secondary"
                    sx={{ mt: 0.5, maxWidth: 720, overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                  >
                    Sign in with the Google account that manages the business. This workspace then reads your
                    reviews and Search/Maps performance, and can publish replies and posts you approve. Your
                    customers, contacts and orders stay in the same shared workspace as WhatsApp and the CRM.
                  </Typography>
                </Box>
                {configured ? (
                  <Button variant="contained" onClick={connect} disabled={busy} startIcon={<StorefrontRoundedIcon />}>
                    Connect with Google
                  </Button>
                ) : (
                  <Alert
                    severity="warning"
                    sx={{
                      width: '100%',
                      minWidth: 0,
                      alignItems: 'flex-start',
                      '& .MuiAlert-message': {
                        minWidth: 0,
                        width: '100%',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                      },
                    }}
                  >
                    <Stack spacing={1.25} sx={{ minWidth: 0 }}>
                      <Typography variant="body2">
                        Google Business Profile is not configured for this platform yet.
                      </Typography>
                      <Typography variant="body2">
                        Open Administration → Google configuration and save the platform Google OAuth client.
                        You only configure this once; individual businesses then connect their own Google account.
                      </Typography>
                      <Button
                        href="/admin"
                        variant="outlined"
                        size="small"
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        Configure Google
                      </Button>
                    </Stack>
                  </Alert>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                  Google Business Profile API access is granted per Google Cloud project. If the project has not
                  been approved yet, Google can return zero quota even after the OAuth client is configured.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card variant="outlined">
              <CardContent>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar><StorefrontRoundedIcon /></Avatar>
                    <Box>
                      <Typography fontWeight={700}>
                        {account.locationTitle || account.accountDisplayName || 'Google Business Profile'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {account.locationAddress || account.googleEmail || 'Connected'}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {account.mapsUri ? (
                      <Button size="small" component={MuiLink} href={account.mapsUri} target="_blank" rel="noopener">
                        View on Maps
                      </Button>
                    ) : null}
                    <Button size="small" variant="outlined" startIcon={<LinkOffRoundedIcon />} onClick={disconnect} disabled={busy}>
                      Disconnect
                    </Button>
                  </Stack>
                </Stack>
                {!aiConfigured ? (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    AI drafting is off because this server has no <code>ANTHROPIC_API_KEY</code>. Replies and posts
                    can still be written and published by hand.
                  </Alert>
                ) : null}
              </CardContent>
            </Card>

            {!locationSelected ? (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" fontWeight={700} gutterBottom>Choose the location to manage</Typography>
                  <Typography color="text.secondary" sx={{ mb: 2 }}>
                    Reviews, posts and performance all belong to a single location.
                  </Typography>

                  {(locationOptions.accounts || []).length > 1 ? (
                    <FormControl size="small" fullWidth sx={{ mb: 2, maxWidth: 420 }}>
                      <InputLabel id="google-account-picker">Google account</InputLabel>
                      <Select
                        labelId="google-account-picker"
                        label="Google account"
                        value={locationOptions.activeAccount || ''}
                        onChange={(event) => loadLocations(event.target.value)}
                        disabled={busy}
                      >
                        {(locationOptions.accounts || []).map((googleAccount) => (
                          <MenuItem key={googleAccount.name} value={googleAccount.name}>
                            {googleAccount.accountName || googleAccount.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : null}

                  {busy ? <CircularProgress size={22} /> : null}
                  <Stack spacing={1.25}>
                    {(locationOptions.locations || []).map((location) => (
                      <Card key={location.name} variant="outlined" sx={{ p: 1.75 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography fontWeight={650}>{location.title || location.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {location.address || location.primaryCategory || '—'}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {!location.hasVoiceOfMerchant ? (
                              <Chip size="small" color="warning" label="Not verified" />
                            ) : null}
                            <Button
                              size="small"
                              variant="contained"
                              disabled={busy}
                              onClick={() => chooseLocation(locationOptions.activeAccount, location.name)}
                            >
                              Manage this
                            </Button>
                          </Stack>
                        </Stack>
                      </Card>
                    ))}
                    {!busy && !(locationOptions.locations || []).length ? (
                      <Alert severity="warning">
                        No locations were returned for this Google account.
                        {(locationOptions.accounts || []).length > 1
                          ? ' Try another account above.'
                          : ' Check that the account you signed in with owns or manages the business profile.'}
                      </Alert>
                    ) : null}
                  </Stack>
                </CardContent>
              </Card>
            ) : (
              <Card variant="outlined">
                <CardContent>
                  {busy ? <CircularProgress size={20} sx={{ mb: 2 }} /> : null}

                  {tab === 'overview' ? (
                    <Stack spacing={2.5}>
                      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                        <Metric
                          label="Profile views"
                          value={performance?.totals?.impressions ?? '—'}
                          hint="Search + Maps, last 30 days"
                        />
                        <Metric
                          label="Customer actions"
                          value={performance?.totals?.actions ?? '—'}
                          hint={performance ? `${performance.totals.actionRate}% of views` : 'calls, directions, clicks'}
                        />
                        <Metric label="Calls" value={performance?.totals?.calls ?? '—'} hint="tapped call" />
                        <Metric label="Direction requests" value={performance?.totals?.directions ?? '—'} hint="asked for the route" />
                      </Stack>

                      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                        <Metric
                          label="Average rating"
                          value={reviews.summary?.averageRating ? reviews.summary.averageRating.toFixed(1) : '—'}
                          hint={reviews.summary ? `${reviews.summary.totalReviewCount} reviews on Google` : ''}
                        />
                        <Metric
                          label="Unanswered reviews"
                          value={reviews.summary?.unanswered ?? '—'}
                          hint={reviews.summary?.unansweredNegative ? `${reviews.summary.unansweredNegative} are 3 stars or below` : 'nothing waiting'}
                        />
                        <Metric
                          label="Reply rate"
                          value={reviews.summary ? `${reviews.summary.replyRate}%` : '—'}
                          hint="of the reviews loaded here"
                        />
                        <Metric label="Website clicks" value={performance?.totals?.websiteClicks ?? '—'} hint="from the profile" />
                      </Stack>

                      {performance && performance.totals.impressions === 0 ? (
                        <Alert severity="info">
                          Google has not reported any views for this location in the last 30 days. New and
                          recently verified profiles can take a few days to start reporting.
                        </Alert>
                      ) : null}
                    </Stack>
                  ) : null}

                  {tab === 'reviews' ? (
                    <Stack spacing={2}>
                      <Card variant="outlined" sx={{ p: 2 }}>
                        <Stack spacing={1.5}>
                          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
                            <Box>
                              <Typography fontWeight={750}>AI review automation</Typography>
                              <Typography variant="body2" color="text.secondary">
                                New reviews are synced every 15 minutes. Auto-reply is opt-in; lower ratings always stay for approval.
                              </Typography>
                            </Box>
                            <Button size="small" startIcon={<RefreshRoundedIcon />} onClick={syncReviewsNow} disabled={busy}>
                              Sync now
                            </Button>
                          </Stack>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={Boolean(reviewSettings.autoReplyEnabled)}
                                onChange={(event) => setReviewSettings((current) => ({ ...current, autoReplyEnabled: event.target.checked }))}
                              />
                            }
                            label="Automatically publish eligible AI replies"
                          />
                          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                            <FormControl size="small" sx={{ minWidth: 220 }}>
                              <InputLabel id="google-review-threshold">Auto-reply minimum rating</InputLabel>
                              <Select
                                labelId="google-review-threshold"
                                label="Auto-reply minimum rating"
                                value={reviewSettings.autoReplyMinRating}
                                onChange={(event) => setReviewSettings((current) => ({ ...current, autoReplyMinRating: Number(event.target.value) }))}
                              >
                                {[5, 4, 3, 2, 1].map((rating) => (
                                  <MenuItem key={rating} value={rating}>{rating}★ and above</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={Boolean(reviewSettings.allowReviewReplyEmojis)}
                                  onChange={(event) => setReviewSettings((current) => ({ ...current, allowReviewReplyEmojis: event.target.checked }))}
                                />
                              }
                              label="Allow emoji"
                            />
                          </Stack>
                          <TextField
                            size="small"
                            label="Tone rules"
                            placeholder="Example: friendly, local, concise; avoid sales language"
                            value={reviewSettings.customToneRules}
                            onChange={(event) => setReviewSettings((current) => ({ ...current, customToneRules: event.target.value }))}
                            inputProps={{ maxLength: 1000 }}
                          />
                          <TextField
                            size="small"
                            label="Offline contact for complaints"
                            placeholder="Example: Call 07182-xxxxxx or email manager@example.com"
                            value={reviewSettings.reviewSupportContact}
                            onChange={(event) => setReviewSettings((current) => ({ ...current, reviewSupportContact: event.target.value }))}
                            inputProps={{ maxLength: 300 }}
                            helperText="Used only for 1–3 star drafts. Leave blank to avoid inventing contact details."
                          />
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Button variant="contained" size="small" onClick={saveReviewSettings} disabled={busy}>
                              Save automation settings
                            </Button>
                            <Typography variant="caption" color="text.secondary">
                              AI replies are plain text and capped at 250 characters.
                            </Typography>
                          </Stack>
                        </Stack>
                      </Card>

                      {!(reviews.reviews || []).length ? (
                        <Typography color="text.secondary">No reviews have been left on this profile yet.</Typography>
                      ) : null}
                      {(reviews.reviews || []).map((review) => (
                        <Card key={review.reviewId} variant="outlined" sx={{ p: 2 }}>
                          <Stack direction="row" spacing={1.5} alignItems="flex-start">
                            <Avatar src={review.reviewerPhoto || undefined}>{review.reviewer?.[0] || '?'}</Avatar>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                <Typography fontWeight={650}>{review.reviewer}</Typography>
                                <Rating value={review.rating} readOnly size="small" />
                                {review.reply ? <Chip size="small" color="success" label="Replied" /> : null}
                              </Stack>
                              <Typography variant="body2" sx={{ mt: 0.75, whiteSpace: 'pre-wrap' }}>
                                {review.comment || <em>Rating only, no written review.</em>}
                              </Typography>

                              {review.reply ? (
                                <Alert severity="success" sx={{ mt: 1.5 }}>
                                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{review.reply}</Typography>
                                </Alert>
                              ) : (
                                <Stack spacing={1} sx={{ mt: 1.5 }}>
                                  <TextField
                                    multiline
                                    minRows={2}
                                    size="small"
                                    placeholder="Write a public reply…"
                                    value={replyDrafts[review.reviewId] || ''}
                                    onChange={(event) =>
                                      setReplyDrafts((current) => ({ ...current, [review.reviewId]: event.target.value }))
                                    }
                                  />
                                  <Stack direction="row" spacing={1}>
                                    <Button
                                      size="small"
                                      startIcon={<AutoAwesomeRoundedIcon />}
                                      onClick={() => draftReply(review.reviewId)}
                                      disabled={busy || !aiConfigured}
                                    >
                                      Draft with AI
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="contained"
                                      onClick={() => publishReply(review.reviewId)}
                                      disabled={busy || !String(replyDrafts[review.reviewId] || '').trim()}
                                    >
                                      Publish reply
                                    </Button>
                                  </Stack>
                                </Stack>
                              )}
                            </Box>
                          </Stack>
                        </Card>
                      ))}
                    </Stack>
                  ) : null}

                  {tab === 'posts' ? (
                    <Stack spacing={2.5}>
                      <Stack spacing={1.5}>
                        <Typography variant="subtitle1" fontWeight={700}>New post</Typography>
                        <TextField
                          size="small"
                          label="What is this post about?"
                          placeholder="Diwali offer on full service, this week only"
                          value={postTopic}
                          onChange={(event) => setPostTopic(event.target.value)}
                          helperText="The AI draft uses only this and your profile details — it never invents an offer."
                        />
                        <Button
                          size="small"
                          sx={{ alignSelf: 'flex-start' }}
                          startIcon={<AutoAwesomeRoundedIcon />}
                          onClick={draftPost}
                          disabled={busy || !aiConfigured || !postTopic.trim()}
                        >
                          Draft with AI
                        </Button>
                        <TextField
                          multiline
                          minRows={4}
                          label="Post text"
                          value={postText}
                          onChange={(event) => setPostText(event.target.value)}
                          helperText={`${postText.length}/1500 characters`}
                        />
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                          <FormControl size="small" sx={{ minWidth: 170 }}>
                            <InputLabel id="google-post-cta">Button</InputLabel>
                            <Select
                              labelId="google-post-cta"
                              label="Button"
                              value={postAction}
                              onChange={(event) => setPostAction(event.target.value)}
                            >
                              {CALL_TO_ACTIONS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <TextField
                            size="small"
                            fullWidth
                            label="Button link"
                            placeholder="https://"
                            value={postActionUrl}
                            onChange={(event) => setPostActionUrl(event.target.value)}
                            disabled={postAction === 'CALL' || postAction === 'NONE'}
                            helperText={postAction === 'CALL' ? 'Google uses the phone number on the profile.' : ' '}
                          />
                        </Stack>
                        <TextField
                          size="small"
                          label="Image URL (optional)"
                          placeholder="https://…/photo.jpg"
                          value={postImageUrl}
                          onChange={(event) => setPostImageUrl(event.target.value)}
                          helperText="Must be a public link Google can download."
                        />
                        <Button
                          variant="contained"
                          sx={{ alignSelf: 'flex-start' }}
                          onClick={publishPost}
                          disabled={busy || !postText.trim()}
                        >
                          Publish to Google
                        </Button>
                      </Stack>

                      <Divider />

                      <Stack spacing={1.25}>
                        <Typography variant="subtitle1" fontWeight={700}>Recent posts</Typography>
                        {!posts.length ? (
                          <Typography color="text.secondary">Nothing posted to this profile yet.</Typography>
                        ) : null}
                        {posts.map((post) => (
                          <Card key={post.name} variant="outlined" sx={{ p: 1.75 }}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                              <Chip size="small" label={post.state || 'LIVE'} />
                              <Typography variant="caption" color="text.secondary">
                                {post.createTime ? new Date(post.createTime).toLocaleDateString() : ''}
                              </Typography>
                            </Stack>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{post.summary}</Typography>
                          </Card>
                        ))}
                      </Stack>
                    </Stack>
                  ) : null}

                  {tab === 'requests' ? (
                    <Stack spacing={1.75}>
                      <Typography variant="subtitle1" fontWeight={700}>Ask a customer for a review</Typography>
                      <Typography color="text.secondary" variant="body2">
                        Sends from your connected WhatsApp number with your Google review link. WhatsApp only allows
                        a free-form message within 24 hours of the customer&apos;s last message — outside that
                        window, use an approved template from Broadcasts.
                      </Typography>
                      {!reviews.newReviewUri && !account.newReviewUri ? (
                        <Alert severity="warning">
                          Google has not published a review link for this location yet. It appears once the profile
                          is verified.
                        </Alert>
                      ) : null}
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                        <TextField
                          size="small"
                          fullWidth
                          label="Customer WhatsApp number"
                          placeholder="919812345678"
                          value={requestPhone}
                          onChange={(event) => setRequestPhone(event.target.value)}
                        />
                        <TextField
                          size="small"
                          fullWidth
                          label="Customer name (optional)"
                          value={requestName}
                          onChange={(event) => setRequestName(event.target.value)}
                        />
                      </Stack>
                      <Button
                        size="small"
                        sx={{ alignSelf: 'flex-start' }}
                        startIcon={<AutoAwesomeRoundedIcon />}
                        onClick={draftRequest}
                        disabled={busy || !aiConfigured}
                      >
                        Draft with AI
                      </Button>
                      <TextField
                        multiline
                        minRows={3}
                        label="Message"
                        value={requestMessage}
                        onChange={(event) => setRequestMessage(event.target.value)}
                        helperText="Put {{link}} where the Google review link should go, or leave it out and it is added at the end."
                      />
                      <Button
                        variant="contained"
                        sx={{ alignSelf: 'flex-start' }}
                        startIcon={<SendRoundedIcon />}
                        onClick={sendRequest}
                        disabled={busy || !requestPhone.trim() || !requestMessage.trim()}
                      >
                        Send on WhatsApp
                      </Button>
                      <Typography variant="caption" color="text.secondary">
                        Google prohibits offering anything in exchange for a review, or asking only happy customers.
                        The drafts here follow that; edits are yours to check.
                      </Typography>
                    </Stack>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Stack>
    </PageBody>
  );
}
