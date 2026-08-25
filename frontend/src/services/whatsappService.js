import api from '../api';

const whatsappService = {
  // ── Official Cloud API ────────────────────────────────────────────────────
  getConnections:      ()           => api.get('/whatsapp/connections'),
  getTemplates:        ()           => api.get('/whatsapp/templates'),
  getMessages:         ()           => api.get('/whatsapp/messages'),
  getRecipients:       ()           => api.get('/whatsapp/recipients'),
  getInbox:            ()           => api.get('/whatsapp/inbox'),
  getConversation:     (key)        => api.get(`/whatsapp/conversation/${key}`),
  markConversationRead:(key)        => api.post(`/whatsapp/conversation/${key}/read`),
  getRules:            ()           => api.get('/whatsapp/auto-reply-rules'),
  saveRule:            (payload, id)=> id
    ? api.put(`/whatsapp/auto-reply-rules/${id}`, payload)
    : api.post('/whatsapp/auto-reply-rules', payload),
  sendText:            (payload)    => api.post('/whatsapp/send-text', payload),
  sendInvitation:      (payload)    => api.post('/whatsapp/send-invitation', payload),







  // ── Blast campaigns ───────────────────────────────────────────────────────
  getBlasts:           ()           => api.get('/blasts'),
  getBlast:            (id)         => api.get(`/blasts/${id}`),
  createBlast:         (payload)    => api.post('/blasts', payload),
  updateBlast:         (id, payload)=> api.patch(`/blasts/${id}`, payload),

  // ── Saved campaigns (with per-recipient tracking + scheduler) ─────────────
  listCampaigns:       ()           => api.get('/campaigns'),
  saveCampaign:        (payload)    => api.post('/campaigns', payload),
  getCampaign:         (id)         => api.get(`/campaigns/${id}`),
  updateCampaign:      (id, payload)=> api.patch(`/campaigns/${id}`, payload),
  deleteCampaign:      (id)         => api.delete(`/campaigns/${id}`),
  sendCampaignNow:     (id)         => api.post(`/campaigns/${id}/send`),
};

export default whatsappService;