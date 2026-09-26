import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { getRemoteLeadScraperStatus } from '@/lib/leadFinder/scraperClient';
import LeadFinderAgent from '@/lib/models/LeadFinderAgent';

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

    await connectDB();
    const agent: any = await LeadFinderAgent.findOne({ agentId: 'default' }).select('+authTokenHash').lean();
    const configured = Boolean(String(process.env.LEAD_FINDER_AGENT_TOKEN || '').trim() || agent?.authTokenHash);
    const lastSeenAt = agent?.lastSeenAt ? new Date(agent.lastSeenAt) : null;
    const online = Boolean(lastSeenAt && Date.now() - lastSeenAt.getTime() < 45000);
    return NextResponse.json({ success: true, data: {
      mode: 'local_agent',
      configured,
      online,
      message: online
        ? `Office PC online${agent?.hostname ? ` (${agent.hostname})` : ''}`
        : configured ? 'Office PC agent is offline' : 'Local PC agent is not configured yet',
      lastSeenAt,
      canSetup,
    } });
  } catch (error) {
    return errorResponse(error, 'Failed to check lead finder status');
  }
}
