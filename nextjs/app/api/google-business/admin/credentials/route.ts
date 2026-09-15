import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAdmin, requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import { AuditLog, GoogleBusinessAccount, PlatformCredential } from '@/lib/models';
import { encryptSensitiveValue } from '@/lib/utils/crypto';
import {
  GOOGLE_BUSINESS_PROVIDER,
  getGoogleBusinessConfig,
  loadStoredGoogleCredential,
} from '@/lib/googleBusiness/google';

/**
 * The platform's own Google OAuth client, managed from the admin screen.
 *
 * This is deliberately admin-only and deliberately not per-tenant. The client
 * here is the equivalent of META_APP_ID/META_APP_SECRET: one per deployment,
 * shared by every merchant, who each authorise it through Google's consent
 * screen and never see it. Exposing it to a merchant would mean asking every
 * shop to run its own Google Cloud project and win its own Business Profile
 * API approval, which is weeks of waiting for something they cannot use alone.
 *
 * The secret is never returned by any method here, including to the admin who
 * set it. A write-only field with a "last four" confirmation is enough to tell
 * whether the right value is in place, and means a compromised admin session
 * cannot read the platform's credential back out.
 */

const lastFour = (value: string) => (value.length > 4 ? value.slice(-4) : '••••');

/**
 * Connections that were authorised against some *other* client and therefore
 * cannot be refreshed any more.
 *
 * Spelled out clause by clause rather than as a single `$nin: ['', null, id]`.
 * Whether `$nin` matches a document that lacks the field altogether is a corner
 * of MongoDB's null handling that reasonable references describe in opposite
 * ways, and the answer decides whether every connection made before
 * `issuedByClientId` existed gets counted as broken. A filter whose correctness
 * turns on that is a filter waiting to be misread, so each condition is stated:
 * the field is present, it is not empty, and it is not the client in force.
 * An absent or empty issuer means unknown, which the refresh path also treats
 * as "leave alone".
 */
function staleIssuerFilter(currentClientId: string) {
  return {
    isActive: true,
    $and: [
      { issuedByClientId: { $exists: true } },
      { issuedByClientId: { $ne: null } },
      { issuedByClientId: { $ne: '' } },
      { issuedByClientId: { $ne: currentClientId } },
    ],
  };
}

function auditIp(req: NextRequest) {
  return String(req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    requireAdmin(authed);

    const stored = await loadStoredGoogleCredential();
    const row: any = await PlatformCredential.findOne({ provider: GOOGLE_BUSINESS_PROVIDER })
      .populate('updatedBy', 'Display_name User_name')
      .lean();

    // Resolved rather than reported straight from the row, so the screen says
    // what the OAuth flow will actually use — including the environment
    // fallback, and including "nothing is configured".
    let resolved: any = null;
    try {
      resolved = getGoogleBusinessConfig(stored);
    } catch (_error) {
      resolved = null;
    }

    // What a client change would cost, in merchants. A refresh token only works
    // for the client that issued it, so this is the number of people who would
    // have to reconnect.
    const [connectedCount, mismatchedCount] = await Promise.all([
      GoogleBusinessAccount.countDocuments({ isActive: true }),
      resolved?.clientId
        ? GoogleBusinessAccount.countDocuments(staleIssuerFilter(resolved.clientId))
        : Promise.resolve(0),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        configured: Boolean(resolved),
        source: resolved?.source || 'none',
        connections: { total: connectedCount, needingReconnect: mismatchedCount },
        clientId: resolved?.clientId || '',
        clientSecretLastFour: resolved ? lastFour(resolved.clientSecret) : '',
        redirectUri: resolved?.redirectUri || '',
        // What the environment holds, so an admin can see why "environment" is
        // winning or why nothing is. Never the secret itself.
        environment: {
          hasClientId: Boolean(
            String(process.env.GOOGLE_BUSINESS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '').trim()
          ),
          hasClientSecret: Boolean(
            String(process.env.GOOGLE_BUSINESS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '').trim()
          ),
        },
        saved: row
          ? {
              clientId: row.clientId || '',
              redirectUri: row.redirectUri || '',
              isActive: row.isActive !== false,
              updatedAt: row.updatedAt,
              updatedBy: row.updatedBy?.Display_name || row.updatedBy?.User_name || '',
              note: row.note || '',
            }
          : null,
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load the Google client configuration');
  }
}

export async function PUT(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    requireAdmin(authed);

    const body = await req.json();
    const clientId = String(body?.clientId || '').trim();
    const clientSecret = String(body?.clientSecret || '').trim();
    const redirectUri = String(body?.redirectUri || '').trim();

    const existing: any = await PlatformCredential.findOne({ provider: GOOGLE_BUSINESS_PROVIDER }).lean();

    if (!clientId) throw new AppError('The client ID is required', 400);
    // The secret is write-only, so the screen cannot pre-fill it and an admin
    // correcting a typo in the client ID or the redirect URI has no way to
    // supply it again. An omitted secret therefore means "keep the stored one",
    // and is only an error when there is nothing stored to keep.
    if (!clientSecret && !existing?.clientSecretEncrypted) {
      throw new AppError('The client secret is required the first time a client is saved', 400);
    }
    // Keeping the stored secret is only safe while the client ID it belongs to
    // is unchanged. Carrying it across a rotation would save a mismatched pair
    // that fails every code exchange and every refresh — the precise breakage
    // this endpoint exists to make visible.
    if (!clientSecret && existing?.clientId && existing.clientId !== clientId) {
      throw new AppError(
        'Changing the client ID needs that client’s own secret. A secret belongs to one client ID, so keeping the stored one would save a pair Google rejects.',
        400
      );
    }
    // Google web-application client IDs always carry this suffix. Catching it
    // here turns the commonest paste error — the project number, or an API key
    // — into a message now rather than an opaque 401 from Google later.
    if (!/\.apps\.googleusercontent\.com$/.test(clientId)) {
      throw new AppError('That does not look like a Google OAuth client ID — it should end in .apps.googleusercontent.com', 400);
    }
    if (redirectUri && !/^https:\/\//i.test(redirectUri)) {
      throw new AppError('The redirect URI must be an https URL', 400);
    }

    await PlatformCredential.findOneAndUpdate(
      { provider: GOOGLE_BUSINESS_PROVIDER },
      {
        $set: {
          clientId,
          ...(clientSecret ? { clientSecretEncrypted: encryptSensitiveValue(clientSecret) } : {}),
          redirectUri,
          isActive: true,
          updatedBy: authed.id,
          note: String(body?.note || '').slice(0, 300),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Saving a different client invalidates every authorization issued to the
    // previous one. The count is reported back so the confirmation says how
    // many merchants have to reconnect rather than leaving it to be discovered.
    const strandedConnections = await GoogleBusinessAccount.countDocuments(staleIssuerFilter(clientId));

    await AuditLog.create({
      userId: authed.id,
      tenantId: authed.tenantId || null,
      action: 'platform_credential.update',
      resource: 'PlatformCredential',
      resourceId: GOOGLE_BUSINESS_PROVIDER,
      outcome: 'success',
      ipAddress: auditIp(req),
      userAgent: String(req.headers.get('user-agent') || ''),
      // The client ID is public; the secret is not recorded anywhere but the
      // encrypted column.
      metadata: { clientId, redirectUri, secretChanged: Boolean(clientSecret), strandedConnections },
    });

    return NextResponse.json({
      success: true,
      message: strandedConnections
        ? `Google client saved. ${strandedConnections} connected ${strandedConnections === 1 ? 'profile was' : 'profiles were'} authorised against a different client and must reconnect.`
        : 'Google client saved. Merchants can now connect their profiles.',
      data: { strandedConnections },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to save the Google client configuration');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    requireAdmin(authed);

    await PlatformCredential.deleteOne({ provider: GOOGLE_BUSINESS_PROVIDER });

    await AuditLog.create({
      userId: authed.id,
      tenantId: authed.tenantId || null,
      action: 'platform_credential.delete',
      resource: 'PlatformCredential',
      resourceId: GOOGLE_BUSINESS_PROVIDER,
      outcome: 'success',
      ipAddress: auditIp(req),
      userAgent: String(req.headers.get('user-agent') || ''),
    });

    // Removing the stored client does not disconnect anybody: existing merchant
    // refresh tokens were issued by whichever client authorised them, so they
    // keep working only while that same client is still resolvable — from the
    // environment, in this case. The panel says so.
    return NextResponse.json({ success: true, message: 'Stored Google client removed. The environment configuration applies again.' });
  } catch (error) {
    return errorResponse(error, 'Failed to remove the Google client configuration');
  }
}
