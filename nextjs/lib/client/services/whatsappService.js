import apiClient from '@/lib/api/client';

const whatsappService = {
  // ── Official Cloud API ────────────────────────────────────────────────────
  getConnections:      ()           => apiClient.get('/whatsapp/connections'),
  getTemplates:        ()           => apiClient.get('/whatsapp/templates'),
  getMessages:         ()           => apiClient.get('/whatsapp/messages'),
  getRecipients:       ()           => apiClient.get('/whatsapp/recipients'),
  getInbox:            ()           => apiClient.get('/whatsapp/inbox'),
  getConversation:     (key)        => apiClient.get(`/whatsapp/conversation/${key}`),
  markConversationRead:(key)        => apiClient.post(`/whatsapp/conversation/${key}/read`),
  getRules:            ()           => apiClient.get('/whatsapp/auto-reply-rules'),
  saveRule:            (payload, id)=> id
    ? apiClient.put(`/whatsapp/auto-reply-rules/${id}`, payload)
    : apiClient.post('/whatsapp/auto-reply-rules', payload),
  sendText:            (payload)    => apiClient.post('/whatsapp/send-text', payload),
  sendInvitation:      (payload)    => apiClient.post('/whatsapp/send-invitation', payload),







  // ── Blast campaigns ───────────────────────────────────────────────────────
  getBlasts:           ()           => apiClient.get('/blasts'),
  getBlast:            (id)         => apiClient.get(`/blasts/${id}`),
  createBlast:         (payload)    => apiClient.post('/blasts', payload),
  updateBlast:         (id, payload)=> apiClient.patch(`/blasts/${id}`, payload),

  // ── Saved campaigns (with per-recipient tracking + scheduler) ─────────────
  listCampaigns:       ()           => apiClient.get('/campaigns'),
  saveCampaign:        (payload)    => apiClient.post('/campaigns', payload),
  getCampaign:         (id)         => apiClient.get(`/campaigns/${id}`),
  updateCampaign:      (id, payload)=> apiClient.patch(`/campaigns/${id}`, payload),
  deleteCampaign:      (id)         => apiClient.delete(`/campaigns/${id}`),
  sendCampaignNow:     (id)         => apiClient.post(`/campaigns/${id}/send`),
};

export default whatsappService;