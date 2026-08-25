// Regression test for a tenant-isolation bug in GET /api/whatsapp/contacts.
//
// The ownership scope and the search term are BOTH expressed as `$or`. They
// used to be merged with an object spread:
//
//   { ...scope, ...(search ? { $or: [...searchClauses] } : {}) }
//
// which is not a merge at all — the second `$or` replaces the first. The
// effect was that listing contacts was correctly scoped to the caller, but
// SEARCHING returned matching contacts belonging to every user in the
// database. The fix combines them under `$and`.
//
// This asserts the filter shape rather than hitting Mongo, because the bug
// was in filter construction, not in the query.

describe('contact search filter scoping', () => {
  const scope = {
    $or: [
      { userId: 'user-1', whatsappAccountId: 'acct-1' },
      { userId: { $exists: false } },
      { userId: null },
    ],
  };

  // Mirrors the corrected construction in whatsappController.js:getContacts.
  const buildFilter = ({ search = '', category = '', tag = '' } = {}) => ({
    $and: [
      scope,
      ...(search
        ? [{ $or: [{ name: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }] }]
        : []),
      ...(category ? [{ category }] : []),
      ...(tag ? [{ tags: tag }] : []),
    ],
  });

  const mentionsOwnership = (filter) => JSON.stringify(filter).includes('userId');

  it('keeps the ownership scope when no search is given', () => {
    expect(mentionsOwnership(buildFilter())).toBe(true);
  });

  it('KEEPS the ownership scope when searching — the actual bug', () => {
    const filter = buildFilter({ search: 'asha' });
    expect(mentionsOwnership(filter)).toBe(true);
    // Both conditions must survive, not just one.
    expect(JSON.stringify(filter)).toContain('asha');
  });

  it('demonstrates why the old spread was unsafe', () => {
    // The original construction, reproduced exactly.
    const broken = {
      ...scope,
      ...{ $or: [{ name: { $regex: 'asha' } }, { phone: { $regex: 'asha' } }] },
    };
    // A single `$or` key cannot hold both sets of clauses: the search wins and
    // every user's contacts match.
    expect(mentionsOwnership(broken)).toBe(false);
  });

  it('keeps ownership alongside category and tag filters too', () => {
    const filter = buildFilter({ search: 'ravi', category: 'lead', tag: 'vip' });
    expect(mentionsOwnership(filter)).toBe(true);
    expect(filter.$and).toHaveLength(4);
  });
});

// The bug above was survivable because only one call site spread the scope
// into a filter that also had an `$or`. Several other call sites spread it
// next to an `_id`, which happens to be safe — until someone adds a second
// `$or` beside it and silently re-creates the same hole. They are all `$and`
// now; this keeps them that way.
describe('contact scope composition across call sites', () => {
  const fs = require('fs');
  const path = require('path');

  const files = [
    path.join(__dirname, '..', 'src', 'controllers', 'whatsappController.js'),
    path.join(__dirname, '..', '..', 'nextjs', 'app', 'api', 'whatsapp', 'contacts', '[id]', 'route.ts'),
    path.join(__dirname, '..', '..', 'nextjs', 'app', 'api', 'whatsapp', 'contacts', 'bulk', 'route.ts'),
  ];

  for (const file of files) {
    it(`never spreads the ownership scope in ${path.basename(path.dirname(file))}/${path.basename(file)}`, () => {
      const src = fs.readFileSync(file, 'utf8');
      expect(src).not.toMatch(/\.\.\.\s*(buildScopedContactFilter\(|scopeFilter\b|scope\b)/);
    });
  }
});
