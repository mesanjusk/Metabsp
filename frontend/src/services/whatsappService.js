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

  // ── Baileys (unofficial) ──────────────────────────────────────────────────
  baileysGetStatus:    ()           => api.get('/baileys/status'),
  baileysConnect:      ()           => api.post('/baileys/connect'),
  baileysDisconnect:   ()           => api.post('/baileys/disconnect'),

  baileysGetInbox:     ()           => api.get('/baileys/inbox'),
  baileysGetConversation: (key)     => api.get(`/baileys/conversation/${key}`),
  baileysMarkRead:     (key)        => api.post(`/baileys/conversation/${key}/read`),

  baileysSendText:     (payload)    => api.post('/baileys/send-text', payload),
  baileysSendInvitation:(payload)   => api.post('/baileys/send-invite', payload),

  baileysGetRules:     ()           => api.get('/baileys/rules'),
  baileysSaveRule:     (payload, id)=> id
    ? api.put(`/baileys/rules/${id}`, payload)
    : api.post('/baileys/rules', payload),

  baileysGetLogs:      ()           => api.get('/baileys/logs'),

  baileysGetGroupsWithMembers: ()          => api.get('/baileys/groups'),
  baileysImportGroupContacts:  (payload)   => api.post('/baileys/groups/import', payload),

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