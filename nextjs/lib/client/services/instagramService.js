import apiClient from '@/lib/api/client';

export const fetchInstagramAccount = () => apiClient.get('/api/instagram/account');
export const fetchInstagramOAuthUrl = () => apiClient.get('/api/instagram/oauth/url');
export const disconnectInstagram = () => apiClient.delete('/api/instagram/account');

export const fetchInstagramConversations = () => apiClient.get('/api/instagram/conversations');
export const fetchInstagramMessages = (conversationId) =>
  apiClient.get('/api/instagram/messages', { params: { conversationId } });
export const sendInstagramMessage = (recipientId, text) =>
  apiClient.post('/api/instagram/messages', { recipientId, text });

export const fetchInstagramMedia = () => apiClient.get('/api/instagram/media');
export const fetchInstagramComments = (mediaId) =>
  apiClient.get('/api/instagram/comments', { params: { mediaId } });
export const sendInstagramCommentPrivateReply = (commentId, text) =>
  apiClient.post('/api/instagram/comments', { commentId, text });

export const publishInstagramImage = (imageUrl, caption) =>
  apiClient.post('/api/instagram/publish', { imageUrl, caption });
