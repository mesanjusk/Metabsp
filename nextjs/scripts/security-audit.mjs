import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const lockedNext = String(lock?.packages?.['node_modules/next']?.version || '');

const rank = { low: 1, moderate: 2, high: 3, critical: 4 };
const gatedSeverity = 3;

const PATCHED_NEXT_15_ADVISORIES = new Set([
  'GHSA-2xp9-vwfh-vxw4',
  'GHSA-p293-qw3h-jr36',
]);

function ghsaFrom(value) {
  const match = String(value || '').match(/GHSA-[0-9a-z-]+/i);
  return match ? match[0].toUpperCase() : '';
}

function isPatchedNext15FalsePositive(via) {
  if (lockedNext !== '15.5.25' || !via || typeof via !== 'object') return false;
  const id = ghsaFrom(via.url) || ghsaFrom(via.source) || ghsaFrom(via.title);
  return PATCHED_NEXT_15_ADVISORIES.has(id);
}

const audit = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
  env: process.env,
});

if (!audit.stdout?.trim()) {
  process.stderr.write(audit.stderr || 'npm audit returned no JSON output\n');
  process.exit(2);
}

let report;
try {
  report = JSON.parse(audit.stdout);
} catch (error) {
  process.stderr.write('Could not parse npm audit JSON: ' + error.message + '\n');
  process.stderr.write(audit.stdout.slice(0, 4000));
  process.exit(2);
}

const failures = [];
const ignored = [];

for (const [name, vulnerability] of Object.entries(report.vulnerabilities || {})) {
  if ((rank[vulnerability.severity] || 0) < gatedSeverity) continue;

  const via = Array.isArray(vulnerability.via) ? vulnerability.via : [];
  const advisoryObjects = via.filter((item) => item && typeof item === 'object');
  const stringVia = via.filter((item) => typeof item === 'string');

  const remainingAdvisories = advisoryObjects.filter((item) => {
    if (name === 'next' && isPatchedNext15FalsePositive(item)) {
      ignored.push({
        package: name,
        advisory: ghsaFrom(item.url) || String(item.source || item.title || ''),
        reason: 'Next 15.5.25 contains the published backport fix',
      });
      return false;
    }
    return (rank[item.severity || vulnerability.severity] || 0) >= gatedSeverity;
  });

  const highCriticalDependencies = stringVia.filter((dependencyName) => {
    const dependency = report.vulnerabilities?.[dependencyName];
    return dependency && (rank[dependency.severity] || 0) >= gatedSeverity;
  });

  if (remainingAdvisories.length || highCriticalDependencies.length || (!advisoryObjects.length && !stringVia.length)) {
    failures.push({
      package: name,
      severity: vulnerability.severity,
      range: vulnerability.range,
      advisories: remainingAdvisories.map((item) => ({
        title: item.title,
        url: item.url,
        severity: item.severity || vulnerability.severity,
      })),
      dependencies: highCriticalDependencies,
    });
  }
}

for (const item of ignored) {
  console.log('[security-audit] allowed patched advisory:', item.package, item.advisory, '-', item.reason);
}

const summary = report.metadata?.vulnerabilities || {};
console.log('[security-audit] npm summary:', JSON.stringify(summary));

if (failures.length) {
  console.error('[security-audit] HIGH/CRITICAL production vulnerabilities remain:');
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}

console.log('[security-audit] PASS: no unapproved HIGH/CRITICAL production vulnerability remains.');
