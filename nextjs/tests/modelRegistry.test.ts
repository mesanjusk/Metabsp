import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * No two schemas may claim the same Mongoose model name.
 *
 * Mongoose keeps one global registry per process, and every model file in this repository is
 * written defensively as `models.X ?? model('X', schema)` so that a hot reload does not throw
 * OverwriteModelError. The side effect is that a *genuine* duplicate never throws either: the
 * second definition is silently discarded and both modules go on using the first one's schema.
 *
 * That is not a theoretical hazard. Porting the Video Studio in brought a second `InstagramAccount`
 * — string `userId`, required `pageId`/`pageName`/`credentials.pageAccessTokenEnc` — alongside the
 * platform's, which keys `userId` as an ObjectId ref and requires `accessTokenEncrypted`. Both
 * resolved to the same name and therefore the same `instagramaccounts` collection. Every video
 * route authenticates through lib/auth/session, which imports lib/models, so the platform's schema
 * always registered first and the studio's writes were validated against a schema that had never
 * heard of a Page token. A second `Workflow` and a second `AuditLog` arrived the same way.
 *
 * Reviewing for that works exactly once. This is the check that keeps working, and it is deliberately
 * a source scan rather than an import of the models: importing them would need a live connection,
 * and the failure it is looking for is a naming decision, which is visible in the text.
 */

const APP_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEARCH_ROOTS = [path.join(APP_ROOT, 'lib')];

/** `model('Name', schema)` / `model<Doc>("Name", schema, 'collection')`, single or double quoted. */
const REGISTRATION = /\bmodel(?:<[^>]*>)?\(\s*['"`]([A-Za-z0-9_]+)['"`]/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') && !full.endsWith('.test.ts') ? [full] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function registrations(): { name: string; file: string }[] {
  return SEARCH_ROOTS.flatMap(sourceFiles).flatMap((file) => {
    // Comments are stripped first: a model file explains its own registration in prose, and
    // `model('X', schema)` written inside a doc comment is documentation, not a collection.
    const source = stripComments(readFileSync(file, 'utf8'));
    REGISTRATION.lastIndex = 0;
    return [...source.matchAll(REGISTRATION)].map((match) => ({
      name: match[1],
      file: path.relative(APP_ROOT, file),
    }));
  });
}

describe('the Mongoose model registry', () => {
  it('finds the model definitions it is supposed to be checking', () => {
    // Guards against the whole check passing vacuously because a directory moved or the
    // registration idiom changed.
    expect(registrations().length).toBeGreaterThanOrEqual(40);
  });

  it('never registers one model name from two files', () => {
    const byName = new Map<string, string[]>();
    for (const { name, file } of registrations()) {
      // A model file legitimately mentions its own name more than once (the `models.X ??` guard);
      // only a second *file* is a collision.
      const files = byName.get(name) ?? [];
      if (!files.includes(file)) files.push(file);
      byName.set(name, files);
    }

    const collisions = [...byName.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([name, files]) => `${name}: ${files.join(' and ')}`);

    expect(
      collisions,
      `These model names are defined twice. Whichever file imports first wins and the other silently ` +
        `uses the wrong schema and the wrong collection — rename one and give it an explicit ` +
        `collection name:\n  ${collisions.join('\n  ')}`,
    ).toEqual([]);
  });
});
