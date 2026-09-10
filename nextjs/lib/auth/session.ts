import { NextRequest } from 'next/server';
import { User } from '../models';
import { verifyToken } from './jwt';
import { requireServiceAccess, type ServiceSlug } from '../services/serviceAccess';
import AppError from '../utils/AppError';

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

/**
 * Service access is enforced for authenticated provider APIs in one place.
 * Shared CRM contacts are intentionally exempt: their legacy URL still lives
 * below /api/whatsapp, but the Contact collection is now a platform-core
 * resource used from every entitled service dashboard.
 */
function serviceForApiPath(pathname: string): ServiceSlug | null {
  const path = String(pathname || '');
  if (path.startsWith('/api/instagram/')) return 'instagram';
  if (path.startsWith('/api/whatsapp/contacts')) return null;
  if (path.startsWith('/api/whatsapp/')) return 'whatsapp';
  return null;
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
  const authed: AuthedUser = {
    id: String(user._id),
    isAdmin: permissions.includes('*'),
    tenantId: user.tenantId || null,
    doc: user,
  };

  const service = serviceForApiPath(req.nextUrl.pathname);
  if (service) await requireServiceAccess(authed, service);

  return authed;
}

export function requireAdmin(authed: AuthedUser): void {
  if (!authed.isAdmin) throw new AppError('Admin access required', 403);
}
