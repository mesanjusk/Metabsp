import AppError from '@/lib/utils/AppError';
import { ServiceEntitlement } from '@/lib/models';
import SmbRecord from '@/lib/models/SmbRecord';
import type { AuthedUser } from '@/lib/auth/session';

export const SERVICE_SLUGS = [
  'whatsapp','instagram','google-business','lead-finder','dialer','crm','store','institute','marketing','staff','payments','video',
] as const;
export type ServiceSlug = (typeof SERVICE_SLUGS)[number];
export const BASIC_SERVICES: ServiceSlug[] = ['whatsapp','instagram','google-business','dialer','crm','store','video'];
export const PRO_SERVICES: ServiceSlug[] = ['lead-finder','institute','marketing','staff','payments'];

function isRuleActive(rule: any, now = new Date()) {
  if (!rule) return false;
  if (rule.startsAt && new Date(rule.startsAt) > now) return false;
  if (rule.endsAt && new Date(rule.endsAt) <= now) return false;
  return true;
}

export async function resolveServiceAccess(authed: AuthedUser) {
  const query: any[] = [{ userId: authed.id }];
  if (authed.tenantId) query.push({ tenantId: authed.tenantId, userId: null });
  const [rules, profile]: [any[], any] = await Promise.all([
    ServiceEntitlement.find({ $or: query }).lean(),
    SmbRecord.findOne({ userId: authed.doc._id, kind: 'business_profile' }).select('data.selectedServices').lean(),
  ]);
  const selectedServices = profile?.data?.selectedServices;
  const selected = Array.isArray(selectedServices) ? new Set(selectedServices.map(String)) : null;
  const now = new Date(); const activeRules = rules.filter((rule) => isRuleActive(rule, now));
  const result: Record<string, { enabled: boolean; source: string; reason: string; tier: 'basic' | 'pro' }> = {};

  for (const service of SERVICE_SLUGS) {
    if (BASIC_SERVICES.includes(service)) {
      result[service] = { enabled: true, source: 'basic', reason: 'Included for every account', tier: 'basic' };
      continue;
    }
    const userRule = activeRules.find((rule) => String(rule.service) === service && String(rule.userId || '') === authed.id);
    const tenantRule = activeRules.find((rule) => String(rule.service) === service && !rule.userId && String(rule.tenantId || '') === String(authed.tenantId || ''));
    const chosen = userRule || tenantRule;
    if (chosen) {
      result[service] = { enabled: Boolean(chosen.enabled), source: userRule ? 'user' : 'tenant', reason: chosen.note || (chosen.enabled ? 'Pro service enabled' : 'Pro service not enabled'), tier: 'pro' };
      continue;
    }
    result[service] = { enabled: Boolean(authed.isAdmin), source: authed.isAdmin ? 'admin' : 'default', reason: authed.isAdmin ? 'Available to platform administrator' : 'Upgrade to Pro or ask your admin for access', tier: 'pro' };
  }

  if (selected) {
    for (const service of SERVICE_SLUGS) {
      if (service !== 'lead-finder' && !selected.has(service)) {
        result[service] = { ...result[service], enabled: false, source: 'business_profile', reason: 'Hidden by your business profile. Update your workspace setup to enable it.' };
      }
    }
  }
  return result;
}

export async function requireServiceAccess(authed: AuthedUser, service: ServiceSlug) {
  if (!SERVICE_SLUGS.includes(service)) throw new AppError('Unknown service', 404);
  const access = await resolveServiceAccess(authed);
  if (!access[service]?.enabled) throw new AppError(`Your account does not have access to ${service}`, 403);
  return access[service];
}
