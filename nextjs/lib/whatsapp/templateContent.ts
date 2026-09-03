// A sent template is one row in the inbox like any other message, and that row
// carried only the template's NAME. A thread that had just delivered "Hi Sanju,
// your order #1234 is ready" showed the word `order_ready` and nothing else, so
// the business's copy of the conversation did not match the customer's.
//
// Meta never hands back the rendered text: the send call returns a message id,
// and the text lives in two halves — the approved template (its HEADER, BODY and
// FOOTER, carrying {{1}} placeholders) and the parameters supplied at send time.
// Putting those halves back together is what this module does.

export type TemplateParts = {
  header: string;
  body: string;
  footer: string;
  buttons: string[];
  text: string;
};

const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);
const upper = (value: unknown) => String(value || '').toUpperCase();

const componentOfType = (components: unknown, type: string) =>
  asArray(components).find((component) => upper(component?.type) === type) || null;

// Meta accepts several parameter shapes; each one has a place it keeps the text
// a reader would have seen. `currency` and `date_time` are localised by Meta at
// delivery time, so the fallback value is the closest thing we can show.
const parameterText = (parameter: any): string => {
  if (typeof parameter === 'string') return parameter;
  const type = String(parameter?.type || 'text').toLowerCase();
  if (type === 'currency') return String(parameter?.currency?.fallback_value ?? '');
  if (type === 'date_time') return String(parameter?.date_time?.fallback_value ?? '');
  return String(parameter?.text ?? '');
};

// Positional ({{1}}) and named ({{order_id}}) placeholders both exist in the
// Cloud API. An unmatched placeholder is left standing rather than blanked:
// a visible {{2}} says "this variable went unsupplied", an empty gap says
// nothing at all.
export const substituteTemplateVariables = (text: unknown, parameters: unknown): string => {
  const values = new Map<string, string>();
  asArray(parameters).forEach((parameter, index) => {
    const value = parameterText(parameter);
    const named = String(parameter?.parameter_name || '').trim();
    // A template is authored with either named or numbered variables, never a
    // mix, so a named parameter answers only to its name — registering it under
    // its position too would let it fill someone else's {{1}}.
    if (named) values.set(named, value);
    else values.set(String(index + 1), value);
  });

  return String(text || '').replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (token, key) =>
    values.has(key) ? values.get(key)! : token
  );
};

// Only a TEXT header is text; an IMAGE/VIDEO/DOCUMENT/LOCATION header is media
// and has no words of its own to render into the bubble.
const headerFormatIsText = (header: any) => !header?.format || upper(header.format) === 'TEXT';

/**
 * Render an approved template definition plus the parameters it was sent with
 * into the words the recipient saw.
 *
 * `text` is the flattened form the inbox stores on the message row — it is what
 * the conversation list previews, search, and forwarded webhooks read.
 */
export const renderTemplateParts = (definition: any, components: unknown = []): TemplateParts => {
  const defComponents = asArray(definition?.components);
  const sentHeader = componentOfType(components, 'HEADER');
  const sentBody = componentOfType(components, 'BODY');

  const headerDef = componentOfType(defComponents, 'HEADER');
  const bodyDef = componentOfType(defComponents, 'BODY');
  const footerDef = componentOfType(defComponents, 'FOOTER');
  const buttonsDef = componentOfType(defComponents, 'BUTTONS');

  const header =
    headerDef && headerFormatIsText(headerDef)
      ? substituteTemplateVariables(headerDef.text, sentHeader?.parameters).trim()
      : '';
  const body = bodyDef ? substituteTemplateVariables(bodyDef.text, sentBody?.parameters).trim() : '';
  const footer = footerDef ? String(footerDef.text || '').trim() : '';
  const buttons = asArray(buttonsDef?.buttons)
    .map((button) => String(button?.text || '').trim())
    .filter(Boolean);

  return {
    header,
    body,
    footer,
    buttons,
    text: [header, body, footer].filter(Boolean).join('\n\n'),
  };
};

export const templatePartsAreEmpty = (parts: TemplateParts | null | undefined) =>
  !parts || (!parts.header && !parts.body && !parts.footer && !asArray(parts.buttons).length);

// A WABA can hold the same template name in several languages, and the send
// call names one of them. Fall back through language → base language → the only
// approved copy, because rendering the Hindi body for an English send is still
// closer to the truth than rendering the template's name.
export const findTemplateDefinition = (templates: unknown, name: string, language: string) => {
  const wanted = String(name || '').trim().toLowerCase();
  if (!wanted) return null;

  const byName = asArray(templates).filter(
    (template) => String(template?.name || '').trim().toLowerCase() === wanted
  );
  if (!byName.length) return null;

  const wantedLanguage = String(language || '').trim().toLowerCase();
  const languageOf = (template: any) =>
    String(typeof template?.language === 'string' ? template.language : template?.language?.code || '')
      .trim()
      .toLowerCase();

  return (
    byName.find((template) => languageOf(template) === wantedLanguage) ||
    byName.find((template) => languageOf(template).split('_')[0] === wantedLanguage.split('_')[0]) ||
    byName[0]
  );
};
