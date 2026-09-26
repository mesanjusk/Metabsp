import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import AppError from '@/lib/utils/AppError';

export function requireLeadFinderAgent(req: NextRequest) {
  const expected = String(process.env.LEAD_FINDER_AGENT_TOKEN || '').trim();
  if (!expected) throw new AppError('Lead Finder local agent is not configured', 503);
  const auth = String(req.headers.get('authorization') || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const expectedBuffer = Buffer.from(expected);
  const tokenBuffer = Buffer.from(token);
  if (!token || tokenBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(tokenBuffer, expectedBuffer)) {
    throw new AppError('Unauthorized lead finder agent', 401);
  }
}
