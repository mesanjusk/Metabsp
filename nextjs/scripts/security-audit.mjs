import { spawnSync } from 'node:child_process';

const rank = { low: 1, moderate: 2, high: 3, critical: 4 };
const gatedSeverity = rank.high;

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

for (const [name, vulnerability] of Object.entries(report.vulnerabilities || {})) {
  if ((rank[vulnerability.severity] || 0) < gatedSeverity) continue;

  const via = Array.isArray(vulnerability.via) ? vulnerability.via : [];
  failures.push({
    package: name,
    severity: vulnerability.severity,
    range: vulnerability.range,
    advisories: via
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        title: item.title,
        url: item.url,
        severity: item.severity || vulnerability.severity,
      })),
    dependencies: via.filter((item) => typeof item === 'string'),
  });
}

const summary = report.metadata?.vulnerabilities || {};
console.log('[security-audit] npm summary:', JSON.stringify(summary));

if (failures.length) {
  console.error('[security-audit] HIGH/CRITICAL production vulnerabilities remain:');
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}

console.log('[security-audit] PASS: no HIGH/CRITICAL production vulnerability remains.');
