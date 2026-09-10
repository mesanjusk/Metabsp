import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/session';

/**
 * Instagram routes call the shared auth helper. requireAuth itself maps
 * /api/instagram/* to the Instagram entitlement, so there is no second DB
 * entitlement lookup here.
 */
export async function requireInstagramService(req: NextRequest) {
  return requireAuth(req);
}
