const axios = require('axios');
const WebhookDestination = require('../models/WebhookDestination');
const logger = require('../utils/logger');

// Keeps every registered sibling destination (whatever is currently in the
// WebhookDestination collection — not a fixed list, so a newly added project
// is covered automatically) warm on Render's free tier by pinging each
// destination's own URL, well inside Render's ~15-minute spin-down window.
// Pure HTTP, no WhatsApp/Meta involvement. A GitHub Actions workflow
// (.github/workflows/render-keep-alive.yml) pings the same destinations
// (plus Metabsp itself) independently on its own schedule — this is a
// redundant second layer in case that run is ever delayed, not the primary
// mechanism.
const INTERVAL_MS = 10 * 60 * 1000;

async function getTargets() {
  const overrides = String(process.env.RENDER_KEEP_ALIVE_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  if (overrides.length) return overrides.map((url) => ({ name: url, url }));

  const destinations = await WebhookDestination.find({ isActive: true }).select('label url').lean();
  return destinations.map((dest) => ({ name: dest.label || dest.url, url: dest.url }));
}

async function pingTargets() {
  const targets = await getTargets();
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
    pingTargets().catch((err) => logger.debug(`[render-keep-alive] cycle failed: ${err.message}`));
  }, INTERVAL_MS).unref();
}

module.exports = { startRenderKeepAlive, pingTargets, getTargets };
