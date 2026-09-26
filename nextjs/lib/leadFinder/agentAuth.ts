import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import AppError from '@/lib/utils/AppError';
import { connectDB } from '@/lib/db/mongo';
import LeadFinderAgent from '@/lib/models/LeadFinderAgent';

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function requireLeadFinderAgent(req: NextRequest) {
  const auth = String(req.headers.get('authorization') || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) throw new AppError('Unauthorized lead finder agent', 401);

  const legacyExpected = String(process.env.LEAD_FINDER_AGENT_TOKEN || '').trim();
  if (legacyExpected && safeEqual(token, legacyExpected)) return;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await connectDB();
  const agent: any = await LeadFinderAgent.findOne({ agentId: 'default' }).select('+authTokenHash').lean();
  if (!agent?.authTokenHash || !safeEqual(tokenHash, String(agent.authTokenHash))) {
    throw new AppError('Unauthorized lead finder agent', 401);
  }
}
