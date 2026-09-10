import { normalizePhone } from './dispatch';

// Contact helpers. Contacts are now a platform-core customer resource even
// though this compatibility module still lives below lib/whatsapp.

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

/**
 * Workspace-wide contact ownership.
 *
 * `accountContext` is retained in the signature for backward compatibility,
 * but a connected WhatsApp number no longer narrows the contact list. The same
 * user's contacts must be visible from Instagram, CRM, Dialer and every other
 * enabled service. Provider/account ids remain useful as provenance, not as a
 * visibility boundary.
 *
 * Legacy rows without userId remain visible to preserve migration behaviour.
 */
export const buildScopedContactFilter = (userId: string, _accountContext?: any) => ({
  $or: [
    { userId },
    { userId: { $exists: false } },
    { userId: null },
  ],
});

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
