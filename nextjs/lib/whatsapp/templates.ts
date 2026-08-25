import axios from 'axios';
import AppError from '../utils/AppError';
import { getGraphApiVersion } from '../config/graphApi';

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
