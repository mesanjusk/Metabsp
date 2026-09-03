import { getCatalogFields } from '../services/autoReplyService';

// Auto-reply and workflow payload normalisation, ported from
// backend/src/controllers/whatsappController.js.

const normalizeCatalogRows = (rows: unknown = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((row) => (row && typeof row === 'object' ? row : null))
    .filter(Boolean)
    .map((row: any) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          String(key || '').trim(),
          value == null ? '' : String(value).trim(),
        ])
      )
    )
    .filter((row) => Object.values(row).some((value) => String(value || '').trim()));

const buildCatalogConfigFromPayload = (payload: any = {}) => {
  const catalogConfig =
    payload.catalogConfig && typeof payload.catalogConfig === 'object' ? payload.catalogConfig : {};
  return {
    menuTitle: String(catalogConfig.menuTitle || payload.menuTitle || 'Product Price Finder').trim(),
    menuIntro: String(
      catalogConfig.menuIntro || payload.menuIntro || 'Choose product options to get the latest price.'
    ).trim(),
    selectionFields: Array.isArray(catalogConfig.selectionFields)
      ? catalogConfig.selectionFields.map((f: unknown) => String(f || '').trim()).filter(Boolean)
      : getCatalogFields(payload),
  };
};

// Fields the client may set. The Express version spreads the raw request body,
// which lets a caller supply _id (and anything else the schema happens to
// accept) on create. Ownership was already overridden after the spread, so this
// was not a privilege escalation — but allow-listing is the right shape, and it
// keeps a client from choosing a document's id.
const AUTO_REPLY_CLIENT_FIELDS = [
  'name',
  'keyword',
  'keywords',
  'matchType',
  'replyText',
  'templateName',
  'menuTitle',
  'menuIntro',
  'delaySeconds',
  'catalogConfig',
];

export const normalizeAutoReplyPayload = (payload: any = {}) => {
  const ruleType = String(payload.ruleType || 'keyword').toLowerCase();
  const replyType = String(payload.replyType || payload.replyMode || 'text').toLowerCase();

  const allowed = Object.fromEntries(
    AUTO_REPLY_CLIENT_FIELDS.filter((k) => k in payload).map((k) => [k, payload[k]])
  );

  return {
    ...allowed,
    ruleType,
    replyType,
    reply: String(
      payload.reply || (replyType === 'template' ? payload.templateName : payload.replyText) || ''
    ).trim(),
    templateLanguage: String(payload.templateLanguage || payload.language || 'en_US').trim() || 'en_US',
    isActive:
      typeof payload.isActive === 'boolean'
        ? payload.isActive
        : typeof payload.active === 'boolean'
          ? payload.active
          : true,
    catalogRows: ruleType === 'product_catalog' ? normalizeCatalogRows(payload.catalogRows) : [],
    ...(ruleType === 'product_catalog' ? { catalogConfig: buildCatalogConfigFromPayload(payload) } : {}),
  };
};

export const normalizeWorkflowPayload = (payload: any = {}) => ({
  name: String(payload.name || '').trim(),
  keyword: String(payload.keyword || '').trim(),
  matchType: ['exact', 'contains', 'starts_with'].includes(String(payload.matchType || '').toLowerCase())
    ? String(payload.matchType).toLowerCase()
    : 'contains',
  isActive: typeof payload.isActive === 'boolean' ? payload.isActive : true,
  steps: (Array.isArray(payload.steps) ? payload.steps : [])
    .map((step: any) => ({
      // Clamped: an unbounded delay would hold a timer open indefinitely.
      delaySeconds: Math.min(3600, Math.max(0, Number(step?.delaySeconds) || 0)),
      replyType: String(step?.replyType || 'text').toLowerCase() === 'template' ? 'template' : 'text',
      reply: String(step?.reply || '').trim(),
      templateLanguage: String(step?.templateLanguage || 'en_US').trim() || 'en_US',
    }))
    .filter((step: any) => step.reply),
});

// Auto-reply rules predate per-account ownership, so unowned rows stay visible.
/**
 * The rules a user owns, and the legacy rules nobody owns.
 *
 * Both are Mongoose filters against AutoReply, whose `userId` is an ObjectId —
 * which is the whole point of this living here rather than inline. A filter
 * had a `{ userId: '' }` clause in it: unmatchable, because an empty string
 * cannot be stored in an ObjectId field, and uncastable, so Mongoose threw
 * CastError and the route answered 500. It sat in the branch taken only when a
 * user owns no rules at all, so the screen failed for precisely the accounts
 * that had never used the feature — a brand-new signup among them.
 *
 * `{ userId: null }` matches documents where the field is null *or* absent, so
 * it covers the pre-ownership rows on its own.
 */
export const ownedAutoReplyFilter = (userId: string, accountContext: any) => ({
  userId,
  ...(accountContext?.account?._id ? { whatsappAccountId: accountContext.account._id } : {}),
});

export const unownedAutoReplyFilter = () => ({ userId: null });

export const autoReplyScopeFilter = (userId: string, accountContext: any) => ({
  $or: [
    { userId, ...(accountContext?.account?._id ? { whatsappAccountId: accountContext.account._id } : {}) },
    { userId: { $exists: false } },
    { userId: null },
  ],
});
