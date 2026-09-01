import axios from 'axios';
import WebhookDestination from '../models/WebhookDestination';
import { connectDB } from '../db/mongo';
import logger from '../utils/logger';

/**
 * Keeps every registered customer webhook destination warm by pinging its own
 * URL well inside a typical free-tier spin-down window, so an inbound WhatsApp
 * event forwarded to a customer's project never hits a cold start. Pure HTTP,
 * no Meta involvement.
 *
 * This exists because destinations commonly sit on free hosting tiers. It is
 * a courtesy to customers, not a substitute for this platform itself running
 * on an always-on plan — see docs/deployment/PRODUCTION_ARCHITECTURE.md.
 */
const INTERVAL_MS = 10 * 60 * 1000;

export async function getTargets(): Promise<{ name: string; url: string }[]> {
  const overrides = String(process.env.KEEP_ALIVE_URLS || process.env.RENDER_KEEP_ALIVE_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  if (overrides.length) return overrides.map((url) => ({ name: url, url }));

  await connectDB();
  const destinations: any[] = await WebhookDestination.find({ isActive: true }).select('label url').lean();
  return destinations.map((dest) => ({ name: dest.label || dest.url, url: dest.url }));
}

export async function pingTargets() {
  const targets = await getTargets();
  await Promise.allSettled(
    targets.map(async ({ name, url }) => {
      try {
        const res = await axios.get(url, { timeout: 15000, validateStatus: () => true });
        logger.debug(`[keep-alive] ${name} -> HTTP ${res.status}`);
      } catch (error: any) {
        logger.debug(`[keep-alive] ${name} ping failed: ${error.message}`);
      }
    })
  );
}

// Opt-out only — a harmless, idempotent GET.
export function startKeepAliveScheduler() {
  if (String(process.env.ENABLE_KEEP_ALIVE ?? process.env.ENABLE_RENDER_KEEP_ALIVE).toLowerCase() === 'false') {
    return null;
  }
  return setInterval(() => {
    pingTargets().catch((error) => logger.debug(`[keep-alive] cycle failed: ${error.message}`));
  }, INTERVAL_MS).unref();
}
