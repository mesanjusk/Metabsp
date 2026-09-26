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

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    const currentMode = mode();
    if (currentMode === 'remote') {
      const remote = await getRemoteLeadScraperStatus();
      return NextResponse.json({ success: true, data: { mode: 'remote', ...remote } });
    }

    const configured = Boolean(String(process.env.LEAD_FINDER_AGENT_TOKEN || '').trim());
    if (!configured) {
      return NextResponse.json({ success: true, data: { mode: 'local_agent', configured: false, online: false, message: 'Local PC agent is not configured yet' } });
    }
    await connectDB();
    const agent: any = await LeadFinderAgent.findOne({ agentId: 'default' }).lean();
    const lastSeenAt = agent?.lastSeenAt ? new Date(agent.lastSeenAt) : null;
    const online = Boolean(lastSeenAt && Date.now() - lastSeenAt.getTime() < 45000);
    return NextResponse.json({ success: true, data: {
      mode: 'local_agent', configured: true, online,
      message: online ? `Office PC online${agent?.hostname ? ` (${agent.hostname})` : ''}` : 'Office PC agent is offline',
      lastSeenAt,
    } });
  } catch (error) {
    return errorResponse(error, 'Failed to check lead finder status');
  }
}
