const axios = require('axios');
const logger = require('../utils/logger');

// Keeps the sibling Render free-tier services (which receive this hub's
// forwarded WhatsApp webhooks) warm by pinging their public health-check GET
// endpoints well inside Render's ~15-minute spin-down window. Pure HTTP, no
// WhatsApp/Meta involvement at all. A GitHub Actions workflow
// (.github/workflows/render-keep-alive.yml) does the same ping independently
// on its own schedule — this is a redundant second layer in case that run is
// ever delayed, not the primary mechanism.
const DEFAULT_TARGETS = [
  { name: 'printmart-api', url: 'https://print-mart-dv0h.onrender.com/api/whatsapp/webhook-metabsp' },
  { name: 'hostel-backend', url: 'https://hostel-dpqg.onrender.com/api/whatsapp/webhook-metabsp' },
  { name: 'mis-both-backend', url: 'https://mis-both.onrender.com/webhook/metabsp' },
];

const INTERVAL_MS = 10 * 60 * 1000;

function getTargets() {
  const configured = String(process.env.RENDER_KEEP_ALIVE_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  if (!configured.length) return DEFAULT_TARGETS;
  return configured.map((url) => ({ name: url, url }));
}

async function pingTargets() {
  const targets = getTargets();
  await Promise.allSettled(
    targets.map(async ({ name, url }) => {
      try {
        const res = await axios.get(url, { timeout: 15000, validateStatus: () => true });
        logger.debug(`[render-keep-alive] ${name} -> HTTP ${res.status}`);
      } catch (err) {
        logger.debug(`[render-keep-alive] ${name} ping failed: ${err.message}`);
      }
    })
  );
}

// Opt-out only — defaults on since it's a harmless, idempotent GET.
function startRenderKeepAlive() {
  if (String(process.env.ENABLE_RENDER_KEEP_ALIVE).toLowerCase() === 'false') return;
  setInterval(() => {
    pingTargets().catch(() => {});
  }, INTERVAL_MS).unref();
}

module.exports = { startRenderKeepAlive, pingTargets };
