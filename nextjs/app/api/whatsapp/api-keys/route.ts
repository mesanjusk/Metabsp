import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { recordAuditEvent } from '@/lib/services/auditLogService';
import ApiKey from '@/lib/models/ApiKey';

// Keys are hashed at rest (see lib/models/ApiKey.ts), so listing can only ever
// show the prefix. The previous version returned every key in full on every
// list call, which meant one XSS or one leaked support screenshot handed over
// live sending credentials for the account.
const maskKey = (record: any) => {
  if (record.keyPrefix) return `${record.keyPrefix}${'•'.repeat(8)}`;
  // A legacy plaintext row that has not been used since the hashing change.
  if (record.key) return `${String(record.key).slice(0, 12)}${'•'.repeat(8)}`;
  return '';
};

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);

    const keys: any[] = await ApiKey.find({ userId: authed.id }).sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      keys: keys.map((record) => ({
        id: record._id,
        name: record.name,
        maskedKey: maskKey(record),
        isActive: record.isActive,
        lastUsedAt: record.lastUsedAt,
        createdAt: record.createdAt,
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

    const { doc, rawKey } = await (ApiKey as any).generate(authed.id, name || 'Default');

    recordAuditEvent({
      req: req as any,
      userId: authed.id,
      action: 'api_key.create',
      resource: 'api_key',
      resourceId: doc._id,
      metadata: { name: doc.name },
    });

    return NextResponse.json(
      {
        success: true,
        id: doc._id,
        name: doc.name,
        // The only response that will ever contain the secret.
        key: rawKey,
        maskedKey: maskKey(doc),
        warning: 'Store this key now — it cannot be shown again.',
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error, 'Failed to create API key');
  }
}
