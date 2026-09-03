import axios from 'axios';
import AppError from '../utils/AppError';
import { getGraphApiVersion } from '../config/graphApi';
import logger from '../utils/logger';
import {
  findTemplateDefinition,
  renderTemplateParts,
  templatePartsAreEmpty,
  type TemplateParts,
} from './templateContent';

// Template creation rules, ported from backend/src/controllers/whatsappController.js.
//
// These validations are not defensive padding — they are the difference
// between a template Meta approves and one it auto-rejects. Meta requires an
// example value for every {{n}} variable in a text component; without one,
// reviewers (and Meta's automation) have no real content to judge the template
// against and reject it outright. Variables must also be numbered 1..N with no
// gaps. Catching both here turns a rejection that arrives hours later into an
// error the user sees immediately.

export const TEMPLATE_NAME_PATTERN = /^[a-z0-9_]{1,512}$/;
export const TEMPLATE_CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];

export const extractVariableNumbers = (text: unknown): number[] =>
  Array.from(
    new Set(Array.from(String(text || '').matchAll(/\{\{(\d+)\}\}/g), (m) => Number(m[1])))
  ).sort((a, b) => a - b);

export const validateVariablesHaveExamples = (
  text: unknown,
  examples: unknown,
  label: string
): string[] | null => {
  const variableNumbers = extractVariableNumbers(text);
  if (!variableNumbers.length) return null;

  const isSequential = variableNumbers.every((n, i) => n === i + 1);
  if (!isSequential) {
    throw new AppError(`${label} variables must be numbered {{1}}, {{2}}, ... with no gaps`, 400);
  }

  const resolved = (Array.isArray(examples) ? examples : []).map((v) => String(v || '').trim());
  if (resolved.length !== variableNumbers.length || resolved.some((v) => !v)) {
    throw new AppError(
      `Provide an example value for each ${label} variable ({{1}}..{{${variableNumbers.length}}})`,
      400
    );
  }
  return resolved;
};

export const normalizeWhatsAppApiError = (error: any, fallback: string) => {
  const apiMessage = error?.response?.data?.error?.message;
  const status = error?.response?.status && error.response.status < 500 ? 400 : 502;
  return new AppError(apiMessage || fallback, status);
};

const credentialsFrom = (accountContext: any) => {
  const wabaId = String(accountContext?.wabaId || accountContext?.businessAccountId || '').trim();
  const accessToken = String(accountContext?.accessToken || '').trim();
  if (!accessToken || !wabaId) throw new AppError('Missing WhatsApp credentials', 400);
  return { wabaId, accessToken };
};

export const listTemplates = async (accountContext: any) => {
  const { wabaId, accessToken } = credentialsFrom(accountContext);
  try {
    const response = await axios.get(
      `https://graph.facebook.com/${getGraphApiVersion()}/${wabaId}/message_templates`,
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 15000 }
    );
    return Array.isArray(response?.data?.data) ? response.data.data : [];
  } catch (error) {
    throw normalizeWhatsAppApiError(error, 'Failed to load WhatsApp templates');
  }
};

export const buildTemplateComponents = (body: any) => {
  const {
    name,
    category,
    header = '',
    headerExample = '',
    body: templateBody,
    bodyExamples = [],
    footer = '',
  } = body || {};

  const resolvedName = String(name || '').trim().toLowerCase();
  const resolvedCategory = String(category || '').trim().toUpperCase();
  const resolvedBody = String(templateBody || '').trim();

  if (!TEMPLATE_NAME_PATTERN.test(resolvedName)) {
    throw new AppError('Template name must use only lowercase letters, numbers, and underscores', 400);
  }
  if (!TEMPLATE_CATEGORIES.includes(resolvedCategory)) {
    throw new AppError(`category must be one of ${TEMPLATE_CATEGORIES.join(', ')}`, 400);
  }
  if (!resolvedBody) throw new AppError('body is required', 400);

  const bodyExamplesResolved = validateVariablesHaveExamples(resolvedBody, bodyExamples, 'body');
  const bodyComponent: Record<string, unknown> = { type: 'BODY', text: resolvedBody };
  if (bodyExamplesResolved) bodyComponent.example = { body_text: [bodyExamplesResolved] };
  const components: Record<string, unknown>[] = [bodyComponent];

  const resolvedHeader = String(header || '').trim();
  if (resolvedHeader) {
    const headerExamples = validateVariablesHaveExamples(resolvedHeader, [headerExample], 'header');
    const headerComponent: Record<string, unknown> = { type: 'HEADER', format: 'TEXT', text: resolvedHeader };
    if (headerExamples) headerComponent.example = { header_text: headerExamples };
    components.push(headerComponent);
  }

  const resolvedFooter = String(footer || '').trim();
  if (resolvedFooter) components.push({ type: 'FOOTER', text: resolvedFooter });

  return { resolvedName, resolvedCategory, components };
};

export const createTemplate = async (accountContext: any, body: any) => {
  const { resolvedName, resolvedCategory, components } = buildTemplateComponents(body);
  const { wabaId, accessToken } = credentialsFrom(accountContext);
  const language = String(body?.language || 'en_US');

  try {
    const response = await axios.post(
      `https://graph.facebook.com/${getGraphApiVersion()}/${wabaId}/message_templates`,
      { name: resolvedName, category: resolvedCategory, language, components },
      {
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );
    return { data: response?.data, name: resolvedName, category: resolvedCategory };
  } catch (error) {
    throw normalizeWhatsAppApiError(error, 'Failed to create WhatsApp template');
  }
};

// Rendering a sent template into readable text needs the approved definition,
// and the definition only lives at Meta. Fetching it per message would put a
// Graph round trip in front of every save — a 5,000-recipient broadcast of one
// template would make 5,000 identical calls — so definitions are cached per
// WABA for a few minutes. Templates change rarely, and an edit needs Meta's
// re-approval anyway, so a stale minute costs nothing.
const TEMPLATE_DEFINITION_TTL_MS = 5 * 60 * 1000;
// A miss is cached too, but briefly: a name that resolves to nothing (deleted
// template, or credentials that cannot read the WABA) must not re-ask Graph
// once per recipient, and must not stay unresolvable for the full TTL either.
const TEMPLATE_DEFINITION_MISS_TTL_MS = 60 * 1000;
const templateDefinitionCache = new Map<string, { expiresAt: number; definition: any }>();

const templateCacheKey = (wabaId: string, name: string, language: string) =>
  `${wabaId}::${String(name || '').toLowerCase()}::${String(language || '').toLowerCase()}`;

export const clearTemplateDefinitionCache = () => templateDefinitionCache.clear();

/**
 * The approved definition of one template, or null when it cannot be read.
 *
 * Never throws: this sits on the send path, and a template that sent fine must
 * not fail afterwards because its definition could not be looked up.
 */
export const fetchTemplateDefinition = async (
  accountContext: any,
  name: string,
  language: string
): Promise<any | null> => {
  const wabaId = String(accountContext?.wabaId || accountContext?.businessAccountId || '').trim();
  const accessToken = String(accountContext?.accessToken || '').trim();
  const resolvedName = String(name || '').trim();
  if (!wabaId || !accessToken || !resolvedName) return null;

  const key = templateCacheKey(wabaId, resolvedName, language);
  const cached = templateDefinitionCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.definition;

  let definition: any = null;
  try {
    // `name` filters server-side where Meta supports it; findTemplateDefinition
    // filters again so an API version that ignores the parameter and returns the
    // whole list still resolves to the right template and language.
    const response = await axios.get(
      `https://graph.facebook.com/${getGraphApiVersion()}/${wabaId}/message_templates`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { name: resolvedName, limit: 100 },
        timeout: 10000,
      }
    );
    definition = findTemplateDefinition(response?.data?.data, resolvedName, language);
  } catch (error: any) {
    logger.warn(
      `Could not load WhatsApp template "${resolvedName}" for rendering: ${
        error?.response?.data?.error?.message || error?.message || 'unknown error'
      }`
    );
    definition = null;
  }

  templateDefinitionCache.set(key, {
    definition,
    expiresAt: Date.now() + (definition ? TEMPLATE_DEFINITION_TTL_MS : TEMPLATE_DEFINITION_MISS_TTL_MS),
  });
  return definition;
};

/**
 * The words a template send actually delivered, for storing on the inbox row.
 *
 * Falls back to the template's name — the old behaviour — only when the
 * definition cannot be read, so an unreachable Graph degrades to what the inbox
 * showed before rather than to an empty bubble.
 */
export const renderSentTemplate = async ({
  accountContext,
  templateName,
  language,
  components = [],
}: {
  accountContext: any;
  templateName: string;
  language: string;
  components?: unknown;
}): Promise<{ text: string; parts: TemplateParts | null }> => {
  const definition = await fetchTemplateDefinition(accountContext, templateName, language);
  if (!definition) return { text: templateName, parts: null };

  const parts = renderTemplateParts(definition, components);
  if (templatePartsAreEmpty(parts)) return { text: templateName, parts: null };

  return { text: parts.text || templateName, parts };
};

/**
 * Fill in template rows that were saved before sends stored their rendered text.
 *
 * Those rows carry the template's name in `body` and nothing else, which is the
 * bug the inbox showed: a delivered "Hi Sanju, your order is ready" listed as
 * `order_ready`. The parameters they were sent with were never recorded and
 * cannot be recovered, so the placeholders stay visible — `{{1}}` is a truthful
 * "this value is not known here", where the bare template name was not readable
 * as a message at all.
 *
 * Read-side only: nothing is written back, because a row hydrated with
 * placeholders is a rendering of what we can still see, not a record of what
 * was sent.
 */
export const hydrateLegacyTemplateMessages = async (rows: any[], accountContext: any) => {
  const messages = Array.isArray(rows) ? rows : [];

  const isLegacyTemplateRow = (row: any) => {
    if (String(row?.type || '').toLowerCase() !== 'template') return false;
    if (row?.templateParts) return false;
    const name = String(row?.templateName || row?.body || row?.message || row?.text || '').trim();
    // A rendered body has spaces and punctuation; only a bare template name
    // passes Meta's name pattern, so this cannot overwrite real message text.
    return TEMPLATE_NAME_PATTERN.test(name);
  };

  const pending = messages.filter(isLegacyTemplateRow);
  if (!pending.length) return messages;

  const nameOf = (row: any) => String(row?.templateName || row?.body || row?.message || row?.text || '').trim();
  const languageOf = (row: any) => String(row?.templateLanguage || '').trim();

  // One lookup per distinct template, not per message: a thread can hold
  // hundreds of sends of the same handful of templates.
  const definitions = new Map<string, any>();
  await Promise.all(
    Array.from(new Set(pending.map((row) => `${nameOf(row)}::${languageOf(row)}`))).map(async (key) => {
      const [name, language] = key.split('::');
      definitions.set(key, await fetchTemplateDefinition(accountContext, name, language));
    })
  );

  return messages.map((row) => {
    if (!isLegacyTemplateRow(row)) return row;

    const definition = definitions.get(`${nameOf(row)}::${languageOf(row)}`);
    if (!definition) return row;

    const parts = renderTemplateParts(definition, []);
    if (templatePartsAreEmpty(parts) || !parts.text) return row;

    return {
      ...row,
      templateName: row?.templateName || nameOf(row),
      templateParts: parts,
      body: parts.text,
      message: parts.text,
      text: parts.text,
    };
  });
};
