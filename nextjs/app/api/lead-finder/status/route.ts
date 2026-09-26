import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { getRemoteLeadScraperStatus } from '@/lib/leadFinder/scraperClient';
import {
  getLeadFinderAgentAuthHash,
  getLeadFinderAgentHeartbeat,
} from '@/lib/leadFinder/agentState';

function mode() {
  const configured = String(process.env.LEAD_FINDER_MODE || '').trim().toLowerCase();
  if (configured) return configured;
  return String(process.env.LEAD_SCRAPER_URL || '').trim() ? 'remote' : 'local_agent';
}

function canManageLocalAgent(authed: any) {
  if (authed?.isAdmin) return true;
  const code = String(authed?.doc?.roleId?.code || '').trim().toLowerCase();
  const name = String(authed?.doc?.roleId?.name || '').trim().toLowerCase();
  const privileged = new Set(['admin', 'administrator', 'superadmin', 'super-admin', 'super_admin', 'owner']);
  return privileged.has(code) || privileged.has(name);
}

export async function GET(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    const canSetup = canManageLocalAgent(authed);
    const currentMode = mode();
    if (currentMode === 'remote') {
      const remote = await getRemoteLeadScraperStatus();
      return NextResponse.json({ success: true, data: { mode: 'remote', ...remote, canSetup: false } });
    }

    const [authHash, heartbeat] = await Promise.all([
      getLeadFinderAgentAuthHash(),
      getLeadFinderAgentHeartbeat(),
    ]);
    const configured = Boolean(String(process.env.LEAD_FINDER_AGENT_TOKEN || '').trim() || authHash);
    const lastSeenAt = heartbeat?.lastSeenAt ? new Date(heartbeat.lastSeenAt) : null;
    const online = Boolean(lastSeenAt && !Number.isNaN(lastSeenAt.getTime()) && Date.now() - lastSeenAt.getTime() < 45000);

    return NextResponse.json({ success: true, data: {
      mode: 'local_agent',
      configured,
      online,
      message: online
        ? `Office PC online${heartbeat?.hostname ? ` (${heartbeat.hostname})` : ''}`
        : configured ? 'Office PC agent is offline' : 'Local PC agent is not configured yet',
      lastSeenAt,
      canSetup,
    } });
  } catch (error) {
    return errorResponse(error, 'Failed to check lead finder status');
  }
}
