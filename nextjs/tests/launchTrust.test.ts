import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd());

const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('launch trust claims', () => {
  const security = read('app/(public)/security-info/page.jsx');
  const terms = read('app/(public)/terms-of-service/page.jsx');
  const privacy = read('app/(public)/privacy-policy/page.jsx');
  const deletion = read('app/(public)/data-deletion/page.jsx');
  const layout = read('app/layout.tsx');
  const manifest = read('public/manifest.webmanifest');

  it('does not claim certifications or controls the product cannot currently prove', () => {
    const publicTrustCopy = [security, terms, privacy, deletion].join('\n');
    for (const forbidden of [
      'SOC 2 Type I audit: Completed',
      'SOC 2 Type II (In Progress)',
      'HashiCorp Vault',
      'Certificate pinning for our mobile clients',
      'Internal service-to-service communication uses mutual TLS',
      'All data stored on SanjuSK infrastructure is encrypted using AES-256',
      'AES-256 encryption for all data at rest',
      'Audit logs retained for 2 years',
      'Backup Purge',
    ]) {
      expect(publicTrustCopy).not.toContain(forbidden);
    }
  });

  it('does not publish a default 99.9 percent SLA', () => {
    expect(terms).not.toContain('strives to maintain 99.9% uptime');
  });

  it('does not fake manual deletion completion or email delivery', () => {
    expect(deletion).toContain('/api/privacy/deletion-request');
    expect(deletion).not.toContain('Confirmation email sent to');
    expect(deletion).not.toContain('All data will be permanently deleted within 30 days');
  });

  it('uses SK Digital as the installed and browser-facing product brand', () => {
    expect(layout).toContain("applicationName: 'SK Digital'");
    expect(layout).toContain("title: 'SK Digital — Business Growth OS'");
    expect(manifest).toContain('"short_name": "SK Digital"');
  });
});
