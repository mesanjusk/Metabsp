import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { requireServiceAccess } from '@/lib/services/serviceAccess';

/** Authenticate the dashboard user and enforce Instagram entitlement. */
export async function requireInstagramService(req: NextRequest) {
  const authed = await requireAuth(req);
  await requireServiceAccess(authed, 'instagram');
  return authed;
}
