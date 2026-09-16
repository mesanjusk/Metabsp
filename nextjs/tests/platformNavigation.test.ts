import { describe, expect, it } from 'vitest';
import { SERVICES } from '@/lib/ui/app/serviceRegistry';
import {
  HUB_NAV_SECTIONS,
  findNavItem,
  getMobileNavHrefs,
  getNavSections,
  getNavigationItems,
} from '@/lib/ui/app/navigation';
import { SMB_KINDS, SMB_SERVICE_SLUGS, getSmbService, smbRecordHref } from '@/lib/smb/workspaceRegistry';

/**
 * The hub is the front door to a platform, not to WhatsApp.
 *
 * `/home`'s sidebar used to list All services, Inbox and Contacts — two of which are WhatsApp
 * screens. Every other service was reachable only from the switcher strip above the content.
 */
describe('hub navigation', () => {
  it('lists every service in the hub menu', () => {
    const hrefs = new Set(getNavigationItems('/home').map((item: any) => item.href));
    for (const service of SERVICES as { slug: string; href: string }[]) {
      expect(hrefs.has(service.href), `${service.slug} is missing from the hub menu`).toBe(true);
    }
  });

  it('keeps the shared workspace screens, under their own heading', () => {
    const workspace = HUB_NAV_SECTIONS.find((section: any) => section.id === 'hub')!;
    const hrefs = workspace.items.map((item: any) => item.href);
    expect(hrefs).toContain('/inbox');
    expect(hrefs).toContain('/contacts');
    // …and they are not the only thing the hub offers any more.
    const services = HUB_NAV_SECTIONS.find((section: any) => section.id === 'hub-services')!;
    expect(services.items.length).toBe(SERVICES.length);
  });
});

/**
 * Every service's own screens are in its sidebar.
 *
 * CRM, Store, Staff and Payments kept their record kinds as tabs inside the landing page: not
 * linkable, not in the menu, and leaving no room on the main screen for an overview.
 */
describe('small-business service navigation', () => {
  it.each(SMB_SERVICE_SLUGS)('puts every %s record screen in the sidebar', (slug) => {
    const service = getSmbService(slug)!;
    const hrefs = new Set(getNavigationItems(`/services/${slug}`).map((item: any) => item.href));
    for (const kind of service.kinds) {
      expect(hrefs.has(smbRecordHref(slug, kind)), `${slug}/${kind} is missing from the menu`).toBe(true);
    }
  });

  it.each(SMB_SERVICE_SLUGS)('names every %s kind it lists', (slug) => {
    for (const kind of getSmbService(slug)!.kinds) {
      expect(SMB_KINDS[kind], `${kind} has no label or icon`).toBeTruthy();
    }
  });

  it('gives the record screens an address that cannot shadow shared contacts', () => {
    // `/services/crm/[kind]` would outrank `services/[service]/contacts` for /services/crm/contacts
    // and resolve it to a record kind called "contacts". The extra segment keeps them apart.
    for (const slug of SMB_SERVICE_SLUGS) {
      expect(smbRecordHref(slug, 'lead')).toBe(`/services/${slug}/records/lead`);
    }
  });

  it('does not let the overview claim its own tool screens', () => {
    expect(findNavItem('/services/crm')?.label).toBe('Overview');
    expect(findNavItem('/services/crm/records/lead')?.label).toBe('Leads');
    expect(findNavItem('/services/staff/attendance')?.label).toBe('Attendance');
    expect(findNavItem('/services/payments/documents')?.label).toBe('Documents');
  });
});

describe('every service menu', () => {
  it.each((SERVICES as { slug: string; href: string }[]).map((s) => [s.slug, s.href]))(
    '%s offers its own overview and no duplicate destinations',
    (slug, href) => {
      const items = getNavigationItems(href);
      expect(items.some((item: any) => item.href === href), `${slug} cannot reach its own landing page`).toBe(true);
      expect(items.some((item: any) => item.href === '/home'), `${slug} has no way back to the hub`).toBe(true);

      const hrefs = items.map((item: any) => item.href);
      expect(new Set(hrefs).size, `${slug} lists a destination twice`).toBe(hrefs.length);

      for (const item of items as any[]) {
        expect(item.icon, `${slug} has a menu item with no icon: ${item.href}`).toBeTruthy();
        expect(item.label, `${slug} has a menu item with no label: ${item.href}`).toBeTruthy();
      }
    }
  );

  it.each((SERVICES as { slug: string; href: string }[]).map((s) => [s.slug, s.href]))(
    '%s gets phone tabs that resolve to real menu items',
    (slug, href) => {
      const items = getNavigationItems(href);
      const tabs = getMobileNavHrefs(href);
      expect(tabs.length, `${slug} has more tabs than the shell can fit`).toBeLessThanOrEqual(4);
      expect(new Set(tabs).size, `${slug} repeats a tab`).toBe(tabs.length);
      for (const tab of tabs) {
        expect(items.some((item: any) => item.href === tab), `${slug} tab ${tab} has no menu item`).toBe(true);
      }
    }
  );

  it('still gives the hub and the two messaging services their own menus', () => {
    expect(getNavSections('/home')).toBe(HUB_NAV_SECTIONS);
    expect(getNavigationItems('/whatsapp').some((item: any) => item.href === '/broadcasts')).toBe(true);
    expect(getNavigationItems('/instagram').some((item: any) => item.href === '/instagram')).toBe(true);
  });
});
