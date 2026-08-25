import { normalizePhone } from './dispatch';

// Contact helpers, ported from backend/src/controllers/whatsappController.js.

export const normalizeContactPayload = (payload: any = {}) => ({
  phone: normalizePhone(payload.phone || payload.mobile || payload.number),
  name: String(payload.name || payload.fullName || '').trim(),
  email: String(payload.email || '').trim(),
  city: String(payload.city || '').trim(),
  state: String(payload.state || '').trim(),
  company: String(payload.company || '').trim(),
  notes: String(payload.notes || '').trim(),
  category: String(payload.category || '').trim(),
  tags: Array.isArray(payload.tags)
    ? payload.tags.map((t: unknown) => String(t).trim()).filter(Boolean)
    : String(payload.tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
  assignedAgent: String(payload.assignedAgent || '').trim(),
  customFields:
    payload.customFields && typeof payload.customFields === 'object' && !Array.isArray(payload.customFields)
      ? payload.customFields
      : {},
});

// Contacts predate per-account ownership, so rows with no userId are treated as
// shared legacy data and stay visible to everyone — matching the Express
// behaviour rather than hiding records a customer can currently see.
export const buildScopedContactFilter = (userId: string, accountContext: any) => ({
  $or: [
    { userId, ...(accountContext?.account?._id ? { whatsappAccountId: accountContext.account._id } : {}) },
    { userId: { $exists: false } },
    { userId: null },
  ],
});

/**
 * Combines the ownership scope with the optional filters using `$and`.
 *
 * This must never go back to an object spread. The ownership scope and the
 * search term are both `$or` expressions, so spreading them into one object
 * makes the search REPLACE the scope — which is exactly the bug this port
 * inherited: listing contacts was scoped correctly, but searching returned
 * matching contacts belonging to every user. See
 * backend/__tests__/contactSearchScoping.test.js.
 */
export const buildContactListFilter = (
  scope: Record<string, unknown>,
  { search = '', category = '', tag = '' }: { search?: string; category?: string; tag?: string }
) => ({
  $and: [
    scope,
    ...(search
      ? [
          {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { phone: { $regex: normalizePhone(search), $options: 'i' } },
            ],
          },
        ]
      : []),
    ...(category ? [{ category }] : []),
    ...(tag ? [{ tags: tag }] : []),
  ],
});
