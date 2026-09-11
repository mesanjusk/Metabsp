import AppError from '@/lib/utils/AppError';
import type { AuthedUser } from '@/lib/auth/session';
import { resolveServiceAccess, type ServiceSlug } from '@/lib/services/serviceAccess';
import { SMB_RECORD_KINDS } from '@/lib/models/SmbRecord';

const KIND_SERVICE: Record<string, ServiceSlug> = {
  lead: 'crm',
  followup: 'crm',
  quotation: 'crm',
  order: 'crm',
  note: 'crm',
  invoice: 'payments',
  payment: 'payments',
  expense: 'payments',
  task: 'staff',
  vendor: 'staff',
  product: 'store',
  inventory: 'store',
  review_request: 'store',
};

export function serviceForSmbKind(kind: string): ServiceSlug {
  return KIND_SERVICE[String(kind || '').trim().toLowerCase()] || 'crm';
}

export async function getAccessibleSmbKinds(authed: AuthedUser) {
  const access = await resolveServiceAccess(authed);
  const allowed = new Set<string>();
  for (const kind of SMB_RECORD_KINDS as readonly string[]) {
    const service = serviceForSmbKind(kind);
    if (access?.[service]?.enabled) allowed.add(kind);
  }
  return { access, allowed };
}

export async function requireSmbKindAccess(authed: AuthedUser, kind: string) {
  const normalized = String(kind || '').trim().toLowerCase();
  const service = serviceForSmbKind(normalized);
  const access = await resolveServiceAccess(authed);
  if (!access?.[service]?.enabled) {
    throw new AppError(`Your account does not have access to ${service}`, 403);
  }
  return access[service];
}
