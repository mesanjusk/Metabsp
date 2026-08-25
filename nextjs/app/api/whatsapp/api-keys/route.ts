import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { recordAuditEvent } from '@/lib/services/auditLogService';
import ApiKey from '@/lib/models/ApiKey';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);

    const keys: any[] = await ApiKey.find({ userId: authed.id }).sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      keys: keys.map((k) => ({
        id: k._id,
        name: k.name,
        key: k.key,
        isActive: k.isActive,
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt,
      })),
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load API keys');
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const { name } = (await req.json().catch(() => ({}))) as any;

    const apiKey: any = await (ApiKey as any).generate(authed.id, name || 'Default');

    recordAuditEvent({
      req: req as any,
      userId: authed.id,
      action: 'api_key.create',
      resource: 'api_key',
      resourceId: apiKey._id,
      metadata: { name: apiKey.name },
    });

    return NextResponse.json(
      { success: true, key: apiKey.key, name: apiKey.name, id: apiKey._id },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error, 'Failed to create API key');
  }
}
