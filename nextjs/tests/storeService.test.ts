import { describe, expect, it } from 'vitest';
import { cleanImages, inquiryNumber, normalizeStoreDomain, publicStoreUrls, rupeesToPaise, storeSlug } from '@/lib/store/helpers';
import { getMobileNavHrefs, getNavSections } from '@/lib/ui/app/navigation';
import { getServiceBySlug } from '@/lib/ui/app/serviceRegistry';

describe('general-purpose E-Store', () => {
  it('publishes the store as an active basic service', () => {
    expect(getServiceBySlug('store')).toMatchObject({ label: 'E-Store', status: 'active', tier: 'basic' });
  });

  it('exposes responsive catalogue management navigation', () => {
    const hrefs = getNavSections('/services/store').flatMap((section) => section.items.map((item) => item.href));
    expect(hrefs).toEqual(expect.arrayContaining([
      '/services/store/products', '/services/store/categories', '/services/store/inquiries', '/services/store/settings',
    ]));
    expect(getMobileNavHrefs('/services/store')).toEqual([
      '/home', '/services/store', '/services/store/products', '/services/store/categories',
    ]);
  });

  it('normalizes safe public catalogue input', () => {
    expect(storeSlug('  My All-Purpose Shop!  ')).toBe('my-all-purpose-shop');
    expect(rupeesToPaise('1499.50')).toBe(149950);
    expect(cleanImages('http://unsafe.test/a.jpg\nhttps://cdn.test/a.jpg')).toEqual(['https://cdn.test/a.jpg']);
    expect(inquiryNumber()).toMatch(/^ENQ-\d{8}-[A-F0-9]{6}$/);
  });

  it('creates public paths, platform subdomains and safe custom domains', () => {
    expect(normalizeStoreDomain('https://Shop.Example.com/path')).toBe('shop.example.com');
    expect(normalizeStoreDomain('not a domain')).toBe('');
    expect(publicStoreUrls('My Shop', 'shop.example.com', 'active')).toMatchObject({
      publicPath: '/shop/my-shop',
      subdomainUrl: 'https://my-shop.store.meta.sanjusk.in',
      customDomainUrl: 'https://shop.example.com',
    });
  });
});
