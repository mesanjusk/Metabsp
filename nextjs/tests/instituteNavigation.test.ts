import { describe, expect, it } from 'vitest';
import {
  INSTITUTE_NAV_SECTIONS,
  findNavItem,
  getMobileNavHrefs,
  getNavSections,
  getNavigationItems,
} from '@/lib/ui/app/navigation';
import { INSTITUTE_FEATURES, instituteFeatureHref } from '@/lib/institute/featureRegistry';

/**
 * Institute Management keeps its tools in the sidebar.
 *
 * They used to be a wall of cards filling the service's main screen, which left no room on it for
 * the overview and made "open the next tool" a trip back to a menu page. These tests pin the shape
 * that replaced it: every tool in the registry is reachable from the menu, and the main screen is
 * free for analytics.
 */
describe('institute navigation', () => {
  it('uses the institute menu for every institute route', () => {
    for (const path of ['/services/institute', '/services/institute/students', '/services/institute/fees']) {
      expect(getNavSections(path)).toBe(INSTITUTE_NAV_SECTIONS);
    }
  });

  it('puts every institute tool in the sidebar', () => {
    const hrefs = new Set(getNavigationItems('/services/institute').map((item: any) => item.href));
    for (const feature of INSTITUTE_FEATURES as any[]) {
      expect(hrefs.has(instituteFeatureHref(feature)), `${feature.slug} is missing from the menu`).toBe(true);
    }
  });

  it('groups the tools so sixty items are not one flat list', () => {
    const collapsible = INSTITUTE_NAV_SECTIONS.filter((section: any) => section.collapsible);
    expect(collapsible.length).toBeGreaterThan(1);
    for (const section of collapsible as any[]) {
      expect(section.items.length, `${section.id} is empty`).toBeGreaterThan(0);
    }
  });

  it('leads with the overview, and reaches contacts and settings', () => {
    const hrefs = getNavigationItems('/services/institute').map((item: any) => item.href);
    expect(hrefs[0]).toBe('/home');
    expect(hrefs[1]).toBe('/services/institute');
    expect(hrefs).toContain('/services/institute/contacts');
    expect(hrefs).toContain('/settings');
  });

  /**
   * Every tool sits under the overview's own path, so prefix matching would light up "Overview"
   * on all sixty of them and put its name in the title bar.
   */
  it('does not let the overview claim the tool pages', () => {
    expect(findNavItem('/services/institute')?.label).toBe('Overview');
    expect(findNavItem('/services/institute/students')?.label).toBe('Students');
    expect(findNavItem('/services/institute/id-card-print')?.label).toBe('ID Card Print');
    expect(findNavItem('/services/institute/contacts')?.label).toBe('Contacts');
  });

  it('gives the phone a tab bar that resolves to real menu items', () => {
    const items = getNavigationItems('/services/institute');
    const tabs = getMobileNavHrefs('/services/institute');
    expect(tabs[0]).toBe('/home');
    expect(tabs[1]).toBe('/services/institute');
    // The shell adds its own "More", so four is the ceiling.
    expect(tabs.length).toBeLessThanOrEqual(4);
    for (const href of tabs) {
      expect(items.some((item: any) => item.href === href), `${href} has no menu item`).toBe(true);
    }
  });

  it('keeps the menu free of duplicate destinations', () => {
    const hrefs = getNavigationItems('/services/institute').map((item: any) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
