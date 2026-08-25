import WebhookDestination from '@/lib/models/WebhookDestination';
import WhatsAppAccount from '@/lib/models/WhatsAppAccount';

// Ported from backend/src/routes/webhookDestinations.js.

const ALLOWED_URL_PREFIXES = /^https?:\/\//;
const PRIVATE_IP = /^https?:\/\/(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/i;

export function validateUrl(url: unknown): string | null {
  if (!url || typeof url !== 'string') return 'url is required';
  if (!ALLOWED_URL_PREFIXES.test(url)) return 'url must start with http:// or https://';
  if (PRIVATE_IP.test(url)) return 'url must not target a private/local/link-local IP address';
  try {
    new URL(url);
  } catch {
    return 'url is not a valid URL';
  }
  return null;
}

// Generic words are banned as entry keywords everywhere: they collide across
// projects sharing the number and are only meaningful inside an active
// session. EXIT is reserved as the universal close-session command.
const BANNED_KEYWORDS = ['HI', 'HELLO', 'HEY', 'START', 'MENU', 'HELP', 'STOP', 'YES', 'NO', 'OK'];
const RESERVED_KEYWORDS = ['EXIT'];
const KEYWORD_PATTERN = /^[A-Z][A-Z0-9_-]{1,19}$/;

export function normalizeKeyword(value: unknown): string {
  return String(value || '').trim().toUpperCase();
}

export function normalizeAliases(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(normalizeKeyword).filter(Boolean))];
}

// Validates the keyword + aliases and checks case-insensitive uniqueness
// against every other destination on the same WhatsApp account.
export async function validateKeywords({
  entryKeyword,
  aliases,
  whatsappAccountId,
  excludeId,
}: {
  entryKeyword: string;
  aliases: string[];
  whatsappAccountId: any;
  excludeId?: any;
}): Promise<string | null> {
  const all = entryKeyword ? [entryKeyword, ...aliases] : aliases;

  for (const kw of all) {
    if (!KEYWORD_PATTERN.test(kw)) {
      return `"${kw}" is not a valid keyword (2-20 chars, letters/digits/_/-, must start with a letter)`;
    }
    if (BANNED_KEYWORDS.includes(kw)) {
      return `"${kw}" is a banned generic word — it cannot be an entry keyword or alias in any project`;
    }
    if (RESERVED_KEYWORDS.includes(kw)) {
      return `"${kw}" is reserved (EXIT closes an active conversation)`;
    }
  }
  if (new Set(all).size !== all.length) return 'entryKeyword and aliases must not repeat';

  if (all.length) {
    const query: any = { whatsappAccountId, ...(excludeId ? { _id: { $ne: excludeId } } : {}) };
    const siblings = await WebhookDestination.find(query).select('label entryKeyword aliases').lean();
    for (const sibling of siblings as any[]) {
      const taken = [sibling.entryKeyword, ...(sibling.aliases || [])].map(normalizeKeyword).filter(Boolean);
      const clash = all.find((kw) => taken.includes(kw));
      if (clash) return `keyword "${clash}" is already taken by destination "${sibling.label}"`;
    }
  }
  return null;
}

export function sanitize(dest: any) {
  return {
    id: String(dest._id),
    label: dest.label,
    url: dest.url,
    isActive: dest.isActive,
    entryKeyword: dest.entryKeyword || '',
    aliases: dest.aliases || [],
    fanoutFallback: Boolean(dest.fanoutFallback),
    // The whole point of this secret is for the owner to hand it to their
    // receiving service so it can verify X-Metabsp-Signature-256 — only the
    // authenticated owner (every route filters by userId) ever sees this
    // response, so there's no reason to withhold the full value.
    secret: dest.secret || '',
    secretPreview: dest.secret ? `${dest.secret.slice(0, 6)}…` : '',
    lastAttemptAt: dest.lastAttemptAt,
    lastStatus: dest.lastStatus,
    lastError: dest.lastError,
    createdAt: dest.createdAt,
  };
}

// Resolves (and one-time-migrates) the caller's active WhatsApp account.
export async function resolveOwnedAccount(userId: string) {
  const account: any = await WhatsAppAccount.findOne({ userId, isActive: true }).sort({ updatedAt: -1 });
  if (!account) return null;

  // One-time migration: a legacy single `callbackUrl` becomes a "Default" destination.
  if (account.callbackUrl) {
    const existing = await WebhookDestination.countDocuments({ whatsappAccountId: account._id });
    if (existing === 0) {
      await WebhookDestination.create({
        userId,
        whatsappAccountId: account._id,
        label: 'Default',
        url: account.callbackUrl,
        secret: (WebhookDestination as any).generateSecret(),
        isActive: true,
      });
    }
    account.callbackUrl = '';
    await account.save();
  }

  return account;
}
