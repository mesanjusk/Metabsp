const axios = require('axios');

const getApiVersion = () => process.env.META_API_VERSION || 'v18.0';

const sendMessage = async (to, message, phoneNumberId, accessToken) => {
  const token = accessToken || process.env.META_API_TOKEN;
  if (!token) throw new Error('META_API_TOKEN is required');
  if (!phoneNumberId) throw new Error('phoneNumberId is required');

  const { data } = await axios.post(
    `https://graph.facebook.com/${getApiVersion()}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to: String(to),
      type: 'text',
      text: { body: String(message) },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );

  return data;
};

const verifyWebhook = (mode, token, challenge) => {
  const verifyToken =
    process.env.VERIFY_TOKEN ||
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
    process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) return challenge;
  return null;
};

module.exports = { sendMessage, verifyWebhook };
