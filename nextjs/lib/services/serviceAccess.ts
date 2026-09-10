import AppError from '@/lib/utils/AppError';
import { ServiceEntitlement } from '@/lib/models';
import type { AuthedUser } from '@/lib/auth/session';

export const SERVICE_SLUGS = [
  'whatsapp',
  'instagram',
  'google-business',
  'dialer',
  'crm',
  'store',
  'institute',
  'marketing',
  'staff',
  'payments',
] as const;

export type ServiceSlug = (typeof SERVICE_SLUGS)[number];

// Basic products are included for every account. They are never blocked by an
// entitlement row; release status is still controlled by the UI/feature itself.
export const BASIC_SERVICES: ServiceSlug[] = [
  'whatsapp',
  'instagram',
  'google-business',
  'dialer',
  'crm',
  'store',
];

// Pro products are the only services controlled by tenant/user entitlements.
export const PRO_SERVICES: ServiceSlug[] = ['institute', 'marketing', 'staff', 'payments'];

function isRuleActive(rule: any, now = new Date()) {
  if (!rule) return false;
  if (rule.startsAt && new Date(rule.startsAt) > now) return false;
  if (rule.endsAt && new Date(rule.endsAt) <= now) return false;
  return true;
}

/**
 * Resolve service access without changing the shared User schema.
 * Basic services are always enabled.
 * Pro precedence: user-specific rule > tenant rule > admin default > disabled.
 */
export async function resolveServiceAccess(authed: AuthedUser) {
  const query: any[] = [{ userId: authed.id }];
  if (authed.tenantId) query.push({ tenantId: authed.tenantId, userId: null });

  const rules: any[] = await ServiceEntitlement.find({ $or: query }).lean();
  const now = new Date();
  const activeRules = rules.filter((rule) => isRuleActive(rule, now));

  const result: Record<string, { enabled: boolean; source: string; reason: string; tier: 'basic' | 'pro' }> = {};

  for (const service of SERVICE_SLUGS) {
    if (BASIC_SERVICES.includes(service)) {
      result[service] = {
        enabled: true,
        source: 'basic',
        reason: 'Included for every account',
        tier: 'basic',
      };
      continue;
    }

    const userRule = activeRules.find(
      (rule) => String(rule.service) === service && String(rule.userId || '') === authed.id
    );
    const tenantRule = activeRules.find(
      (rule) => String(rule.service) === service && !rule.userId && String(rule.tenantId || '') === String(authed.tenantId || '')
    );
    const chosen = userRule || tenantRule;

    if (chosen) {
      result[service] = {
        enabled: Boolean(chosen.enabled),
        source: userRule ? 'user' : 'tenant',
        reason: chosen.note || (chosen.enabled ? 'Pro service enabled' : 'Pro service not enabled'),
        tier: 'pro',
      };
      continue;
    }

    result[service] = {
      enabled: Boolean(authed.isAdmin),
      source: authed.isAdmin ? 'admin' : 'default',
      reason: authed.isAdmin ? 'Available to platform administrator' : 'Upgrade to Pro or ask your admin for access',
      tier: 'pro',
    };
  }

  return result;
}

export async function requireServiceAccess(authed: AuthedUser, service: ServiceSlug) {
  if (!SERVICE_SLUGS.includes(service)) throw new AppError('Unknown service', 404);
  const access = await resolveServiceAccess(authed);
  if (!access[service]?.enabled) {
    throw new AppError(`Your account does not have access to ${service}`, 403);
  }
  return access[service];
}
