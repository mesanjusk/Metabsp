import { readFileSync } from 'node:fs';

const readJson = (url) => JSON.parse(readFileSync(url, 'utf8'));

const pkg = readJson(new URL('../package.json', import.meta.url));
const nestedLock = readJson(new URL('../package-lock.json', import.meta.url));
const workspaceLock = readJson(new URL('../../package-lock.json', import.meta.url));

const declared = {
  ...(pkg.dependencies || {}),
  ...(pkg.devDependencies || {}),
};

const nestedRoot = nestedLock.packages?.[''] || {};
const workspaceRoot = workspaceLock.packages?.['nextjs'] || {};

const failures = [];

for (const [name, spec] of Object.entries(declared)) {
  const nestedSpec = nestedRoot.dependencies?.[name] ?? nestedRoot.devDependencies?.[name];
  const workspaceSpec = workspaceRoot.dependencies?.[name] ?? workspaceRoot.devDependencies?.[name];

  if (nestedSpec !== spec) {
    failures.push(name + ': nextjs lock declares ' + JSON.stringify(nestedSpec) + ', package.json declares ' + JSON.stringify(spec));
  }
  if (workspaceSpec !== spec) {
    failures.push(name + ': workspace lock declares ' + JSON.stringify(workspaceSpec) + ', package.json declares ' + JSON.stringify(spec));
  }

  const nestedVersion = nestedLock.packages?.['node_modules/' + name]?.version || null;
  const workspaceVersion =
    workspaceLock.packages?.['nextjs/node_modules/' + name]?.version ||
    workspaceLock.packages?.['node_modules/' + name]?.version ||
    null;

  if (nestedVersion !== workspaceVersion) {
    failures.push(
      name + ': Docker lock resolves ' + JSON.stringify(nestedVersion) +
      ', workspace lock resolves ' + JSON.stringify(workspaceVersion)
    );
  }
}

for (const section of ['dependencies', 'devDependencies']) {
  for (const name of Object.keys(nestedRoot[section] || {})) {
    if (!(name in declared)) failures.push(name + ': stale entry remains in nextjs lock ' + section);
  }
  for (const name of Object.keys(workspaceRoot[section] || {})) {
    if (!(name in declared)) failures.push(name + ': stale entry remains in workspace lock ' + section);
  }
}

if (failures.length) {
  console.error('[lock-sync] Docker and workspace dependency locks are inconsistent:');
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}

console.log('[lock-sync] PASS: ' + Object.keys(declared).length + ' direct/dev dependencies resolve identically in both install modes.');
