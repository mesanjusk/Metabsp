import apiClient from '@/lib/api/client';

export const fetchGoogleBusinessAccount = () => apiClient.get('/api/google-business/account');
export const fetchGoogleBusinessOAuthUrl = () => apiClient.get('/api/google-business/oauth/url');
export const disconnectGoogleBusiness = () => apiClient.delete('/api/google-business/account');

export const fetchGoogleBusinessLocations = (accountName) =>
  apiClient.get('/api/google-business/locations', { params: accountName ? { accountName } : undefined });
export const selectGoogleBusinessLocation = (accountName, locationName) =>
  apiClient.patch('/api/google-business/account', { accountName, locationName });

export const fetchGoogleBusinessPerformance = (days = 30) =>
  apiClient.get('/api/google-business/performance', { params: { days } });

export const fetchGoogleReviews = () => apiClient.get('/api/google-business/reviews');
export const replyToGoogleReview = (reviewId, comment) =>
  apiClient.post('/api/google-business/reviews', { reviewId, comment });
export const removeGoogleReviewReply = (reviewId) =>
  apiClient.delete('/api/google-business/reviews', { params: { reviewId } });

export const fetchGooglePosts = () => apiClient.get('/api/google-business/posts');
export const publishGooglePost = (post) => apiClient.post('/api/google-business/posts', post);

export const draftGoogleContent = (payload) => apiClient.post('/api/google-business/ai/draft', payload);

export const sendGoogleReviewRequest = (to, message) =>
  apiClient.post('/api/google-business/review-requests', { to, message });
