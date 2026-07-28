import { NextRequest } from 'next/server';
import { User } from '../models';
import { verifyToken } from './jwt';
import AppError from '../utils/AppError';

// Ported from backend/bulk/middleware/auth.js's `protect` — re-verifies the
// DB user on every request (no claims-only trust), same as the Express
// version. Route Handlers call this directly instead of an Express
// middleware chain; throws AppError on failure so callers can catch it and
// map to the same {success:false, message} JSON shape the frontend already
// expects.
export interface AuthedUser {
  id: string;
  isAdmin: boolean;
  tenantId: string | null;
  doc: any;
}

export function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length);
}

export async function requireAuth(req: NextRequest): Promise<AuthedUser> {
  const token = getBearerToken(req);
  if (!token) throw new AppError('No token provided', 401);

  let decoded: { id: string };
  try {
    decoded = verifyToken(token);
  } catch (_error) {
    throw new AppError('Invalid token', 401);
  }

  const user: any = await User.findById(decoded.id).populate('roleId');
  if (!user) throw new AppError('Invalid token user', 401);
  if (!user.isActive) throw new AppError('Account is inactive', 403);

  const permissions: string[] = user.roleId?.permissions || [];

  return {
    id: String(user._id),
    isAdmin: permissions.includes('*'),
    tenantId: user.tenantId || null,
    doc: user,
  };
}

export function requireAdmin(authed: AuthedUser): void {
  if (!authed.isAdmin) throw new AppError('Admin access required', 403);
}
