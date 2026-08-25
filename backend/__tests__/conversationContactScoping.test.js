const fs = require('fs');
const path = require('path');

// Regression test for a second tenant-isolation bug, this one in
// GET /api/whatsapp/conversations.
//
// The conversation list is correctly scoped: the Message aggregate matches on
// the caller's userId / whatsappAccountId. But the follow-up lookup that turns
// each phone number into a display name was not:
//
//   const contacts = await Contact.find({ phone: { $in: phones } }).lean();
//
// Contacts are keyed by phone number and two tenants routinely hold the same
// number, so that returns other tenants' contact rows. `new Map(...)` then
// keeps whichever one came last, meaning the name shown against a conversation
// could be the label a DIFFERENT customer gave that number.
//
// Same defect in the Next.js port, fixed in both.

describe('conversation contact lookup scoping', () => {
  const sources = {
    express: path.join(__dirname, '..', 'src', 'controllers', 'whatsappController.js'),
    nextjs: path.join(__dirname, '..', '..', 'nextjs', 'app', 'api', 'whatsapp', 'conversations', 'route.ts'),
  };

  // Asserting against the real files, not a copy of the logic. A mirror test
  // would keep passing while the source regressed — and the whole point here
  // is that the unscoped call must not come back.
  for (const [name, file] of Object.entries(sources)) {
    describe(name, () => {
      const src = fs.readFileSync(file, 'utf8');

      it('does not look contacts up by phone number alone', () => {
        expect(src).not.toMatch(/Contact\.find\(\{\s*phone:\s*\{\s*\$in:\s*phones\s*\}\s*\}\)/);
      });

      it('composes the ownership scope with $and', () => {
        expect(src).toMatch(/\$and:\s*\[\s*buildScopedContactFilter\(/);
      });
    });
  }

  // The de-duplication rule itself: with a legacy shared contact (no userId)
  // and one the caller owns on the same number, the owned row must win
  // regardless of the order Mongo returns them in.
  const buildContactMap = (contacts) => {
    const contactMap = new Map();
    for (const contact of contacts) {
      const existing = contactMap.get(contact.phone);
      if (!existing || (!existing.userId && contact.userId)) contactMap.set(contact.phone, contact);
    }
    return contactMap;
  };

  const legacy = { phone: '919999999999', name: 'Legacy shared name', userId: null };
  const owned = { phone: '919999999999', name: 'My name for them', userId: 'user-1' };

  it('prefers the owned contact when the legacy row comes first', () => {
    expect(buildContactMap([legacy, owned]).get('919999999999').name).toBe('My name for them');
  });

  it('prefers the owned contact when the legacy row comes last', () => {
    expect(buildContactMap([owned, legacy]).get('919999999999').name).toBe('My name for them');
  });

  it('still falls back to a legacy shared contact when there is no owned one', () => {
    expect(buildContactMap([legacy]).get('919999999999').name).toBe('Legacy shared name');
  });
});
