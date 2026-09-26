import apiClient from '@/lib/api/client';
export const startLeadSearch = (payload) => apiClient.post('/api/lead-finder/search', payload);
export const fetchLeadSearches = () => apiClient.get('/api/lead-finder/search');
export const fetchLeadFinderStatus = () => apiClient.get('/api/lead-finder/status');
export const fetchLeadFinderSetup = () => apiClient.get('/api/lead-finder/setup');
export const fetchProspectLeads = (jobId) => apiClient.get('/api/lead-finder/leads', { params: jobId ? { jobId } : undefined });
export const convertProspectLeads = (leadIds) => apiClient.post('/api/lead-finder/leads', { leadIds });
export const leadExportUrl = (jobId) => `/api/lead-finder/export${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ''}`;
