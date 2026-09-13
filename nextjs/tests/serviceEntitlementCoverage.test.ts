import { describe, it, expect } from 'vitest';
import { SERVICE_SLUGS, BASIC_SERVICES, PRO_SERVICES } from '@/lib/services/serviceAccess';
import { SERVICES } from '@/lib/ui/app/serviceRegistry';

/**
 * The nav bar and the entitlement resolver have to agree on what a service is.
 *
 * They did not, and the failure was silent in the worst way. `serviceRegistry`
 * listed the Video Studio as `tier: 'basic'`; `serviceAccess` had never heard
 * of the slug at all. `resolveServiceAccess` returns a map keyed by the slugs
 * it knows, so the lookup came back `undefined`, and `ServiceAccessGate` reads
 * `entitlement?.enabled === true` — which is false for undefined exactly as it
 * is for a denied entitlement. An unknown service and a forbidden one produced
 * the same lock screen, with a reason ("not included in your current access")
 * that pointed at billing for what was actually a missing array entry.
 *
 * Nothing in the type system could catch it: one list is a `.js` registry of
 * nav cards, the other a `.ts` const tuple, and neither imports the other.
 * This test is the seam.
 */
describe('service slugs are known to both the nav and the entitlement resolver', () => {
  const registrySlugs = SERVICES.map((service: { slug: string }) => service.slug);

  it.each(registrySlugs)('%s is resolvable server-side', (slug: string) => {
    expect(SERVICE_SLUGS as readonly string[]).toContain(slug);
  });

  it('gives every service exactly one tier', () => {
    for (const slug of SERVICE_SLUGS) {
      const basic = BASIC_SERVICES.includes(slug);
      const pro = PRO_SERVICES.includes(slug);
      expect(basic || pro, `${slug} belongs to neither tier, so it can never be enabled`).toBe(true);
      expect(basic && pro, `${slug} is in both tiers`).toBe(false);
    }
  });

  it('agrees with the nav card on which tier each service is', () => {
    for (const service of SERVICES as { slug: string; tier: string }[]) {
      if (!(SERVICE_SLUGS as readonly string[]).includes(service.slug)) continue;
      const serverTier = BASIC_SERVICES.includes(service.slug as never) ? 'basic' : 'pro';
      expect(service.tier, `${service.slug}: nav says ${service.tier}, server says ${serverTier}`).toBe(serverTier);
    }
  });
});
