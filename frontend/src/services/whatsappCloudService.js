import apiClient from '../apiClient';

export const buildTemplatePayload = ({ to, template }) => {
  const parameters = Array.isArray(template?.parameters) ? template.parameters : [];

  return {
    to,
    template_name: template?.name,
    language: template?.language,
    components: [
      {
        type: 'body',
        parameters: parameters.map((value) => ({
          type: 'text',
          text: String(value ?? ''),
        })),
      },
    ],
  };
};

const getCloudinaryResourceType = ({ type, fileType }) => {
  const normalizedType = String(type || '').toLowerCase();
  const normalizedFileType = String(fileType || '').toLowerCase();

  if (
    normalizedType === 'image' ||
    normalizedType.startsWith('image/') ||
    normalizedFileType.startsWith('image/')
  ) {
    return 'image';
  }

  if (
    normalizedType === 'video' ||
    normalizedType.startsWith('video/') ||
    normalizedFileType.startsWith('video/')
  ) {
    return 'video';
  }

  return 'raw';
};

const AUTO_REPLY_ENDPOINTS = [
  '/api/whatsapp/auto-reply',
  '/api/whatsapp/auto-replies',
  '/api/whatsapp/auto-reply-rules',
];

const WHATSAPP_ACCOUNT_ENDPOINTS = {
  current: ['/api/whatsapp/account', '/api/whatsapp/accounts/active'],
  list: ['/api/whatsapp/accounts'],
  connectConfig: ['/api/whatsapp/connect/config'],
  connectComplete: ['/api/whatsapp/connect/complete'],
  connectManual: ['/api/whatsapp/connect/manual'],
  activate: ['/api/whatsapp/accounts/:id/activate'],
  disconnect: ['/api/whatsapp/account/:id/disconnect', '/api/whatsapp/accounts/:id/disconnect'],
  remove: ['/api/whatsapp/account/:id', '/api/whatsapp/accounts/:id'],
  revalidate: ['/api/whatsapp/account/:id/revalidate', '/api/whatsapp/accounts/:id/revalidate'],
};

const tryAutoReplyEndpoints = async (requestFactory) => {
  let lastError = null;

  for (const endpoint of AUTO_REPLY_ENDPOINTS) {
    try {
      const response = await requestFactory(endpoint);
      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

const tryEndpoints = async (endpoints, requestFactory) => {
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      return await requestFactory(endpoint);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

export const fetchWhatsAppStatus = () => apiClient.get('/api/whatsapp/status');
export const fetchWhatsAppAccount = () =>
  tryEndpoints(WHATSAPP_ACCOUNT_ENDPOINTS.current, (endpoint) => apiClient.get(endpoint));
export const fetchWhatsAppAccounts = () =>
  tryEndpoints(WHATSAPP_ACCOUNT_ENDPOINTS.list, (endpoint) => apiClient.get(endpoint));
export const fetchWhatsAppConnectConfig = () =>
  tryEndpoints(WHATSAPP_ACCOUNT_ENDPOINTS.connectConfig, (endpoint) => apiClient.get(endpoint));
export const completeWhatsAppConnect = (payload) =>
  tryEndpoints(WHATSAPP_ACCOUNT_ENDPOINTS.connectComplete, (endpoint) =>
    apiClient.post(endpoint, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  );
export const connectWhatsAppManual = (payload) =>
  tryEndpoints(WHATSAPP_ACCOUNT_ENDPOINTS.connectManual, (endpoint) =>
    apiClient.post(endpoint, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  );
export const activateWhatsAppAccount = (accountId) =>
  tryEndpoints(
    WHATSAPP_ACCOUNT_ENDPOINTS.activate.map((endpoint) => endpoint.replace(':id', accountId)),
    (endpoint) => apiClient.post(endpoint)
  );
export const disconnectWhatsAppAccount = (accountId) =>
  tryEndpoints(
    [
      ...WHATSAPP_ACCOUNT_ENDPOINTS.disconnect.map((endpoint) => ({
        endpoint: endpoint.replace(':id', accountId),
        method: 'post',
      })),
      ...WHATSAPP_ACCOUNT_ENDPOINTS.remove.map((endpoint) => ({
        endpoint: endpoint.replace(':id', accountId),
        method: 'delete',
      })),
    ],
    ({ endpoint, method }) => apiClient[method](endpoint)
  );
export const deleteWhatsAppAccount = (accountId) =>
  tryEndpoints(
    WHATSAPP_ACCOUNT_ENDPOINTS.remove.map((endpoint) => endpoint.replace(':id', accountId)),
    (endpoint) => apiClient.delete(endpoint)
  );
export const revalidateWhatsAppAccount = (accountId) =>
  tryEndpoints(
    WHATSAPP_ACCOUNT_ENDPOINTS.revalidate.map((endpoint) => endpoint.replace(':id', accountId)),
    (endpoint) => apiClient.post(endpoint)
  );

export const fetchWhatsAppMessages = () => apiClient.get('/api/whatsapp/messages');


export const fetchContacts = (params = {}) => apiClient.get('/api/whatsapp/contacts', { params });
export const createContact = (payload) => apiClient.post('/api/whatsapp/contacts', payload, { headers: { 'Content-Type': 'application/json' } });
export const updateContact = (id, payload) => apiClient.put(`/api/whatsapp/contacts/${id}`, payload, { headers: { 'Content-Type': 'application/json' } });
export const importContacts = (contacts) => apiClient.post('/api/whatsapp/contacts/import', { contacts }, { headers: { 'Content-Type': 'application/json' } });
export const sendWhatsAppBroadcast = (payload) => apiClient.post('/api/whatsapp/broadcast', payload, { headers: { 'Content-Type': 'application/json' } });


export const fetchWhatsAppTemplates = () => apiClient.get('/api/whatsapp/templates');

export const sendWhatsAppTextMessage = (payload) =>
  apiClient.post('/api/whatsapp/send-text', payload);

export const sendWhatsAppTemplateMessage = (payload) =>
  apiClient.post('/api/whatsapp/send-template', payload);

export const sendWhatsAppFlowMessage = (payload) =>
  apiClient.post('/api/whatsapp/send-flow', payload);

export const sendWhatsAppMediaMessage = (payload) => {
  const isFormData =
    typeof FormData !== 'undefined' && payload instanceof FormData;

  return apiClient.post(
    '/api/whatsapp/send-media',
    payload,
    isFormData
      ? {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      : undefined
  );
};

export const getAutoReplyRules = () =>
  tryAutoReplyEndpoints((endpoint) => apiClient.get(endpoint));

export const createAutoReplyRule = (payload) =>
  tryAutoReplyEndpoints((endpoint) =>
    apiClient.post(endpoint, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  );

export const updateAutoReplyRule = (id, payload) =>
  apiClient.put(`/api/whatsapp/auto-reply/${id}`, payload, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

export const deleteAutoReplyRule = (id) =>
  apiClient.delete(`/api/whatsapp/auto-reply/${id}`);

export const toggleAutoReplyRule = (id) =>
  apiClient.patch(`/api/whatsapp/auto-reply/${id}/toggle`);


export const fetchManagedUsers = () => apiClient.get('/api/users/manage');
export const createManagedUser = (payload) =>
  apiClient.post('/api/users/manage', payload, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
export const updateManagedUser = (id, payload) =>
  apiClient.put(`/api/users/manage/${id}`, payload, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

export const uploadToCloudinary = async ({ file, type, cloudName, uploadPreset }) => {
  const resolvedCloudName =
    cloudName || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dadcprflr';
  const resolvedUploadPreset =
    uploadPreset ||
    import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ||
    'mern-images';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', resolvedUploadPreset);

  const resourceType = getCloudinaryResourceType({
    type,
    fileType: file?.type,
  });

  const endpoint = `https://api.cloudinary.com/v1_1/${resolvedCloudName}/${resourceType}/upload`;

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  let data = {};
  try {
    data = await response.json();
  } catch (parseError) {
    data = { error: { message: 'Invalid Cloudinary response payload' } };
    console.error('Cloudinary response parse failed:', parseError);
  }

  if (!response.ok) {
    console.error('Cloudinary upload failed:', {
      status: response.status,
      statusText: response.statusText,
      endpoint,
      resourceType,
      fileType: file?.type,
      uploadPreset: resolvedUploadPreset,
      response: data,
    });
    throw new Error(data?.error?.message || 'Cloudinary upload failed.');
  }

  return data?.secure_url || '';
};

export const whatsappCloudService = {
  sendTextMessage: sendWhatsAppTextMessage,
  sendTemplateMessage: sendWhatsAppTemplateMessage,
  sendFlowMessage: sendWhatsAppFlowMessage,
  sendMediaMessage: sendWhatsAppMediaMessage,
  getMessages: fetchWhatsAppMessages,
  getContacts: fetchContacts,
  createContact,
  updateContact,
  importContacts,
  sendBroadcast: sendWhatsAppBroadcast,
  getTemplates: fetchWhatsAppTemplates,
  getStatus: fetchWhatsAppStatus,
  getAccount: fetchWhatsAppAccount,
  getAccounts: fetchWhatsAppAccounts,
  getConnectConfig: fetchWhatsAppConnectConfig,
  completeConnect: completeWhatsAppConnect,
  connectManual: connectWhatsAppManual,
  fetchManagedUsers,
  createManagedUser,
  updateManagedUser,
  activateAccount: activateWhatsAppAccount,
  disconnectAccount: disconnectWhatsAppAccount,
  deleteAccount: deleteWhatsAppAccount,
  revalidateAccount: revalidateWhatsAppAccount,
  getAutoReplyRules,
  createAutoReplyRule,
  updateAutoReplyRule,
  deleteAutoReplyRule,
  toggleAutoReplyRule,
  uploadToCloudinary,
};

export default whatsappCloudService;
