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

const LEGACY_DEFAULT_SERVICES: ServiceSlug[] = ['whatsapp'];
const ADMIN_DEFAULT_SERVICES: ServiceSlug[] = ['whatsapp', 'instagram', 'marketing'];

function isRuleActive(rule: any, now = new Date()) {
  if (!rule) return false;
  if (rule.startsAt && new Date(rule.startsAt) > now) return false;
  if (rule.endsAt && new Date(rule.endsAt) <= now) return false;
  return true;
}

/**
 * Resolve access without changing the shared User schema.
 * Precedence: user-specific rule > tenant rule > backward-compatible default.
 */
export async function resolveServiceAccess(authed: AuthedUser) {
  const query: any[] = [{ userId: authed.id }];
  if (authed.tenantId) query.push({ tenantId: authed.tenantId, userId: null });

  const rules: any[] = await ServiceEntitlement.find({ $or: query }).lean();
  const now = new Date();
  const activeRules = rules.filter((rule) => isRuleActive(rule, now));

  const result: Record<string, { enabled: boolean; source: string; reason: string }> = {};

  for (const service of SERVICE_SLUGS) {
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
        reason: chosen.note || (chosen.enabled ? 'Included for this account' : 'Not enabled for this account'),
      };
      continue;
    }

    const defaults = authed.isAdmin ? ADMIN_DEFAULT_SERVICES : LEGACY_DEFAULT_SERVICES;
    result[service] = {
      enabled: defaults.includes(service),
      source: 'default',
      reason: defaults.includes(service) ? 'Included by default' : 'Not included in your current access',
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
