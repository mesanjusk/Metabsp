import { NextResponse } from 'next/server';
import { User } from '@/lib/models';
import { getGlobalRoles } from '@/lib/auth/globalRoles';
import { signTokenForUser } from '@/lib/auth/jwt';
import { sanitizeUser } from '@/lib/http/sanitizeUser';
import { recordAuditEvent } from '@/lib/services/auditLogService';
import { resolveUserForSocialProfile } from '@/lib/services/socialAuthService';

/**
 * Ported from the completeSocialLogin helper in backend/src/routes/Users.js.
 *
 * Social sign-in deliberately ends at the SAME token and the SAME response
 * envelope as password login — {success, token, user} signed by
 * signTokenForUser — so there is exactly one notion of "logged in" for every
 * downstream check (requireAuth, roles, tenancy) to agree about.
 */
export async function completeSocialLogin({
  req,
  profile,
  provider,
}: {
  req: Request;
  profile: any;
  provider: 'google' | 'facebook';
}) {
  const { user, outcome } = await resolveUserForSocialProfile({
    profile,
    User,
    getGlobalRoles,
  });

  const token = signTokenForUser(user._id);

  recordAuditEvent({
    req: req as any,
    userId: user._id,
    action: 'login',
    resource: 'user',
    resourceId: user._id,
    metadata: { provider, result: outcome },
  });

  return NextResponse.json({ success: true, token, user: sanitizeUser(user) });
}
