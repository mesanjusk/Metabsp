import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import LeadFinderAgent from '@/lib/models/LeadFinderAgent';

export async function POST(req: NextRequest) {
  try {
    const mode = String(process.env.LEAD_FINDER_MODE || 'local_agent').trim().toLowerCase();
    if (mode !== 'local_agent') throw new AppError('Local PC setup is not enabled', 409);

    const body = await req.json().catch(() => ({}));
    const setupCode = String(body?.setupCode || '').trim();
    const authTokenHash = String(body?.authTokenHash || '').trim().toLowerCase();
    const hostname = String(body?.hostname || '').slice(0, 200);
    if (!setupCode || setupCode.length < 20 || setupCode.length > 200) throw new AppError('Invalid setup code', 401);
    if (!/^[a-f0-9]{64}$/.test(authTokenHash)) throw new AppError('Invalid local agent credential', 400);

    const setupCodeHash = crypto.createHash('sha256').update(setupCode).digest('hex');
    await connectDB();
    const agent = await LeadFinderAgent.findOneAndUpdate(
      {
        agentId: 'default',
        setupCodeHash,
        setupCodeExpiresAt: { $gt: new Date() },
        setupCodeUsedAt: null,
      },
      {
        $set: { authTokenHash, setupCodeUsedAt: new Date(), hostname },
      },
      { new: true, select: '+setupCodeHash +setupCodeExpiresAt +setupCodeUsedAt +authTokenHash' }
    );
    if (!agent) throw new AppError('Setup code is invalid, expired, or already used. Generate a new code from Lead Finder setup.', 401);

    return NextResponse.json({ success: true, data: { registered: true } });
  } catch (error) {
    return errorResponse(error, 'Failed to activate local Lead Finder agent');
  }
}
