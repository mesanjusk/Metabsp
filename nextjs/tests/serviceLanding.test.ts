import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { SERVICES, getServiceForPath } from '@/lib/ui/app/serviceRegistry';
import { getMobileNavHrefs, getNavSections } from '@/lib/ui/app/navigation';

/**
 * Every service tile opens that service's own screen.
 *
 * WhatsApp's tile used to open /inbox — a working screen, not an overview —
 * which made the busiest channel the only one with no answer to "how is it
 * going", and made one tile behave unlike the other ten for no visible reason.
 * These tests pin the shape rather than the individual hrefs: a new service
 * added tomorrow has to satisfy them too.
 */
describe('service landing pages', () => {
  it('sends the WhatsApp tile to its dashboard rather than straight into the inbox', () => {
    const whatsapp = SERVICES.find((service: { slug: string }) => service.slug === 'whatsapp');
    expect(whatsapp?.href).toBe('/whatsapp');
  });

  it('gives every service a landing route of its own', () => {
    for (const service of SERVICES as { slug: string; href: string }[]) {
      expect(service.href, `${service.slug} has no landing route`).toBeTruthy();
      expect(service.href.startsWith('/'), `${service.slug} href is not a path`).toBe(true);
    }

    // No two services may share a landing page, or one tile would open another
    // service's screen.
    const hrefs = (SERVICES as { href: string }[]).map((service) => service.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('resolves every service landing route back to its own service', () => {
    for (const service of SERVICES as { slug: string; href: string }[]) {
      expect(getServiceForPath(service.href)?.slug, `${service.href} resolves elsewhere`).toBe(service.slug);
    }
  });

  /**
   * The inbox stays inside WhatsApp — repointing the tile must not have
   * detached the screens underneath it from the service.
   */
  it('keeps the WhatsApp working screens under the WhatsApp service', () => {
    for (const path of ['/inbox', '/templates', '/broadcasts', '/automations', '/analytics', '/numbers']) {
      expect(getServiceForPath(path)?.slug, `${path} left the WhatsApp service`).toBe('whatsapp');
    }
  });

  it('offers the dashboard in the WhatsApp menu and its phone tabs', () => {
    const items = getNavSections('/whatsapp').flatMap((section: any) => section.items);
    expect(items.some((item: any) => item.href === '/whatsapp')).toBe(true);
    expect(items.some((item: any) => item.href === '/inbox')).toBe(true);

    const tabs = getMobileNavHrefs('/whatsapp');
    expect(tabs[0]).toBe('/whatsapp');
    // The inbox is what most people open the app to do; it keeps a tab.
    expect(tabs).toContain('/inbox');
    // The shell adds its own "More", so four is the ceiling.
    expect(tabs.length).toBeLessThanOrEqual(4);
  });

  it('still routes the hub and Instagram where they belong', () => {
    expect(getServiceForPath('/home')).toBeNull();
    expect(getServiceForPath('/instagram')?.slug).toBe('instagram');
  });
});

// Use the same matcher as Next: a configured redirect wins over the page file.
it('serves the WhatsApp overview while retaining legacy nested redirects', async () => {
  const require = createRequire(import.meta.url);
  const config = require('../next.config.js');
  const { getPathMatch } = require('next/dist/shared/lib/router/utils/path-match');
  const redirects = await config.redirects();
  const matches = (path: string) => redirects.filter((rule: { source: string }) => getPathMatch(rule.source)(path));
  expect(matches('/whatsapp')).toHaveLength(0);
  expect(matches('/whatsapp/messages')[0]?.destination).toBe('/inbox');
});
