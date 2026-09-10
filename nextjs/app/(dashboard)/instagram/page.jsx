'use client';

import { useEffect, useMemo, useState } from 'react';
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
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import InstagramIcon from '@mui/icons-material/Instagram';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import PublishRoundedIcon from '@mui/icons-material/PublishRounded';
import PageBody from '@/lib/ui/app/PageBody';
import {
  disconnectInstagram,
  fetchInstagramAccount,
  fetchInstagramComments,
  fetchInstagramConversations,
  fetchInstagramMedia,
  fetchInstagramMessages,
  fetchInstagramOAuthUrl,
  publishInstagramImage,
  sendInstagramCommentPrivateReply,
  sendInstagramMessage,
} from '@/lib/client/services/instagramService';

const REQUIRED_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
  'instagram_business_content_publish',
];

const payload = (response) => response?.data?.data ?? response?.data ?? null;
const graphRows = (response) => payload(response)?.data || [];

export default function InstagramPage() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('messages');

  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');

  const [media, setMedia] = useState([]);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [comments, setComments] = useState([]);
  const [selectedComment, setSelectedComment] = useState(null);
  const [commentReply, setCommentReply] = useState('');

  const [publishUrl, setPublishUrl] = useState('');
  const [publishCaption, setPublishCaption] = useState('');

  const loadAccount = async () => {
    setLoading(true);
    try {
      const response = await fetchInstagramAccount();
      setAccount(payload(response));
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Could not load Instagram connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get('error');
    if (oauthError) setError(oauthError);
    if (params.get('connected') === '1') setNotice('Instagram professional account connected successfully.');
    loadAccount();
  }, []);

  const granted = useMemo(() => new Set(account?.permissions || []), [account]);

  const connect = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetchInstagramOAuthUrl();
      const authorizationUrl = payload(response)?.authorizationUrl;
      if (!authorizationUrl) throw new Error('Authorization URL was not returned.');
      window.location.assign(authorizationUrl);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Could not start Instagram authorization.');
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError('');
    try {
      await disconnectInstagram();
      setAccount(null);
      setConversations([]);
      setMessages([]);
      setMedia([]);
      setComments([]);
      setNotice('Instagram account disconnected from this workspace.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Could not disconnect Instagram.');
    } finally {
      setBusy(false);
    }
  };

  const loadConversations = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetchInstagramConversations();
      setConversations(graphRows(response));
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Could not load Instagram conversations.');
    } finally {
      setBusy(false);
    }
  };

  const openConversation = async (conversation) => {
    setSelectedConversation(conversation);
    setBusy(true);
    setError('');
    try {
      const response = await fetchInstagramMessages(conversation.id);
      setMessages(graphRows(response));
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Could not load Instagram messages.');
    } finally {
      setBusy(false);
    }
  };

  const conversationRecipient = useMemo(() => {
    const participants = selectedConversation?.participants?.data || selectedConversation?.participants || [];
    if (!Array.isArray(participants)) return null;
    return participants.find((participant) => String(participant?.id || '') !== String(account?.instagramUserId || '')) || participants[0] || null;
  }, [selectedConversation, account]);

  const sendReply = async () => {
    if (!conversationRecipient?.id || !replyText.trim()) return;
    setBusy(true);
    setError('');
    try {
      await sendInstagramMessage(conversationRecipient.id, replyText.trim());
      setReplyText('');
      await openConversation(selectedConversation);
      setNotice('Instagram reply sent.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Could not send Instagram reply.');
      setBusy(false);
    }
  };

  const loadMedia = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetchInstagramMedia();
      setMedia(graphRows(response));
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Could not load Instagram media.');
    } finally {
      setBusy(false);
    }
  };

  const openMediaComments = async (item) => {
    setSelectedMedia(item);
    setSelectedComment(null);
    setBusy(true);
    setError('');
    try {
      const response = await fetchInstagramComments(item.id);
      setComments(graphRows(response));
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Could not load Instagram comments.');
    } finally {
      setBusy(false);
    }
  };

  const sendCommentReply = async () => {
    if (!selectedComment?.id || !commentReply.trim()) return;
    setBusy(true);
    setError('');
    try {
      await sendInstagramCommentPrivateReply(selectedComment.id, commentReply.trim());
      setCommentReply('');
      setNotice('Private reply sent to the commenter.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Could not send the private comment reply.');
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!publishUrl.trim()) return;
    setBusy(true);
    setError('');
    try {
      const response = await publishInstagramImage(publishUrl.trim(), publishCaption.trim());
      const result = payload(response);
      setPublishUrl('');
      setPublishCaption('');
      setNotice(`Published to Instagram${result?.mediaId ? ` (media ${result.mediaId})` : ''}.`);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Could not publish to Instagram.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <PageBody title="Instagram" description="Connect and manage an Instagram professional account.">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
      </PageBody>
    );
  }

  return (
    <PageBody title="Instagram" description="Messages, comments and publishing for your Instagram professional account.">
      <Stack spacing={2.5}>
        {error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : null}
        {notice ? <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert> : null}

        {!account ? (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2} alignItems="flex-start">
                <Avatar sx={{ width: 52, height: 52 }}><InstagramIcon /></Avatar>
                <Box>
                  <Typography variant="h6" fontWeight={700}>Connect Instagram</Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }}>
                    Connect an Instagram Business or Creator account to manage customer messages, comments and content from this dashboard.
                  </Typography>
                </Box>
                <Button variant="contained" startIcon={<InstagramIcon />} onClick={connect} disabled={busy}>
                  Connect Instagram account
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Only Instagram professional accounts are supported. Consumer/personal accounts are not supported by this API.
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
                    <Avatar src={account.profilePictureUrl || undefined}><InstagramIcon /></Avatar>
                    <Box>
                      <Typography fontWeight={700}>{account.name || `@${account.username}`}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        @{account.username || 'instagram'}{account.accountType ? ` · ${account.accountType}` : ''}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <Chip label={account.webhookSubscribed ? 'Webhooks subscribed' : 'Webhook subscription pending'} color={account.webhookSubscribed ? 'success' : 'warning'} size="small" />
                    <Button size="small" variant="outlined" startIcon={<LinkOffRoundedIcon />} onClick={disconnect} disabled={busy}>Disconnect</Button>
                  </Stack>
                </Stack>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Instagram permissions used by this dashboard</Typography>
                <Stack direction="row" gap={1} flexWrap="wrap">
                  {REQUIRED_SCOPES.map((scope) => (
                    <Chip key={scope} size="small" label={scope} color={granted.has(scope) ? 'success' : 'default'} variant={granted.has(scope) ? 'filled' : 'outlined'} />
                  ))}
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <Tabs value={tab} onChange={(_event, next) => setTab(next)} variant="scrollable" scrollButtons="auto">
                <Tab value="messages" label="Messages" />
                <Tab value="comments" label="Comments" />
                <Tab value="publish" label="Publish" />
              </Tabs>
              <Divider />
              <CardContent>
                {tab === 'messages' ? (
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="h6" fontWeight={700}>Instagram Inbox</Typography>
                        <Typography variant="body2" color="text.secondary">Read conversations and reply after the Instagram user has messaged your business.</Typography>
                      </Box>
                      <Button startIcon={<RefreshRoundedIcon />} onClick={loadConversations} disabled={busy}>Load conversations</Button>
                    </Stack>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(240px, 0.8fr) minmax(360px, 2fr)' }, gap: 2 }}>
                      <Stack spacing={1}>
                        {conversations.length === 0 ? <Typography variant="body2" color="text.secondary">No conversations loaded yet.</Typography> : null}
                        {conversations.map((conversation) => {
                          const participants = conversation?.participants?.data || conversation?.participants || [];
                          const other = Array.isArray(participants)
                            ? participants.find((person) => String(person?.id || '') !== String(account.instagramUserId)) || participants[0]
                            : null;
                          return (
                            <Button
                              key={conversation.id}
                              variant={selectedConversation?.id === conversation.id ? 'contained' : 'outlined'}
                              onClick={() => openConversation(conversation)}
                              sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                            >
                              {other?.username ? `@${other.username}` : other?.name || `Conversation ${String(conversation.id).slice(-8)}`}
                            </Button>
                          );
                        })}
                      </Stack>
                      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, minHeight: 280 }}>
                        {!selectedConversation ? (
                          <Typography color="text.secondary">Select a conversation.</Typography>
                        ) : (
                          <Stack spacing={1.5}>
                            <Typography fontWeight={700}>{conversationRecipient?.username ? `@${conversationRecipient.username}` : conversationRecipient?.name || 'Conversation'}</Typography>
                            <Divider />
                            <Stack spacing={1} sx={{ maxHeight: 360, overflowY: 'auto' }}>
                              {messages.map((message) => (
                                <Box key={message.id} sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'action.hover' }}>
                                  <Typography variant="caption" color="text.secondary">{message?.from?.username || message?.from?.name || 'Instagram user'}</Typography>
                                  <Typography variant="body2">{message?.message || '[Media / attachment]'}</Typography>
                                </Box>
                              ))}
                              {messages.length === 0 ? <Typography variant="body2" color="text.secondary">No messages returned.</Typography> : null}
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                              <TextField fullWidth size="small" label="Reply" value={replyText} onChange={(event) => setReplyText(event.target.value)} />
                              <Button variant="contained" startIcon={<SendRoundedIcon />} onClick={sendReply} disabled={busy || !conversationRecipient?.id || !replyText.trim()}>Send</Button>
                            </Stack>
                          </Stack>
                        )}
                      </Box>
                    </Box>
                  </Stack>
                ) : null}

                {tab === 'comments' ? (
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="h6" fontWeight={700}>Comment management</Typography>
                        <Typography variant="body2" color="text.secondary">Load your media and send a private response to a commenter.</Typography>
                      </Box>
                      <Button startIcon={<RefreshRoundedIcon />} onClick={loadMedia} disabled={busy}>Load media</Button>
                    </Stack>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(260px, 1fr) minmax(360px, 1.5fr)' }, gap: 2 }}>
                      <Stack spacing={1}>
                        {media.map((item) => (
                          <Button key={item.id} variant={selectedMedia?.id === item.id ? 'contained' : 'outlined'} onClick={() => openMediaComments(item)} sx={{ justifyContent: 'flex-start', textTransform: 'none' }}>
                            {item.caption ? String(item.caption).slice(0, 60) : `${item.media_type || 'Media'} · ${String(item.id).slice(-8)}`}
                          </Button>
                        ))}
                        {media.length === 0 ? <Typography variant="body2" color="text.secondary">No media loaded yet.</Typography> : null}
                      </Stack>
                      <Stack spacing={1.25}>
                        {!selectedMedia ? <Typography color="text.secondary">Select a post to load its comments.</Typography> : null}
                        {comments.map((comment) => (
                          <Card key={comment.id} variant={selectedComment?.id === comment.id ? 'elevation' : 'outlined'} onClick={() => setSelectedComment(comment)} sx={{ cursor: 'pointer' }}>
                            <CardContent sx={{ py: '12px !important' }}>
                              <Typography variant="caption" color="text.secondary">@{comment.username || comment?.from?.username || 'instagram_user'}</Typography>
                              <Typography variant="body2">{comment.text || '[No text]'}</Typography>
                            </CardContent>
                          </Card>
                        ))}
                        {selectedMedia && comments.length === 0 ? <Typography variant="body2" color="text.secondary">No comments returned for this post.</Typography> : null}
                        {selectedComment ? (
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ pt: 1 }}>
                            <TextField fullWidth size="small" label={`Private reply to @${selectedComment.username || 'commenter'}`} value={commentReply} onChange={(event) => setCommentReply(event.target.value)} />
                            <Button variant="contained" startIcon={<SendRoundedIcon />} onClick={sendCommentReply} disabled={busy || !commentReply.trim()}>Send private reply</Button>
                          </Stack>
                        ) : null}
                      </Stack>
                    </Box>
                  </Stack>
                ) : null}

                {tab === 'publish' ? (
                  <Stack spacing={2} sx={{ maxWidth: 760 }}>
                    <Box>
                      <Typography variant="h6" fontWeight={700}>Publish an image</Typography>
                      <Typography variant="body2" color="text.secondary">The image must be on a publicly accessible HTTPS URL so Instagram can fetch it.</Typography>
                    </Box>
                    <TextField label="Public image URL" value={publishUrl} onChange={(event) => setPublishUrl(event.target.value)} placeholder="https://example.com/image.jpg" fullWidth />
                    <TextField label="Caption" value={publishCaption} onChange={(event) => setPublishCaption(event.target.value)} multiline minRows={4} fullWidth inputProps={{ maxLength: 2200 }} />
                    <Box><Button variant="contained" startIcon={<PublishRoundedIcon />} onClick={publish} disabled={busy || !publishUrl.trim()}>Publish to Instagram</Button></Box>
                  </Stack>
                ) : null}
              </CardContent>
            </Card>
          </>
        )}

        {busy ? <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={16} /><Typography variant="caption" color="text.secondary">Working…</Typography></Stack> : null}
      </Stack>
    </PageBody>
  );
}
