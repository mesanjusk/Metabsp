/** Shared by the setup UI and server; contains no credentials or server imports. */
export const BUSY_SOURCES = ['message', 'invoice_url', 'param1', 'param2', 'param3'] as const;
export type BusySource = typeof BUSY_SOURCES[number];
export type BusyBinding = {
  component: 'header' | 'body';
  variable: string;
  type: 'text' | 'document';
  named?: boolean;
  source: BusySource;
};
export type BusyConfig = {
  accountId: string;
  phoneNumberId: string;
  sender: string;
  mode: 'text' | 'template';
  addIndiaCode: boolean;
  template?: string;
  language?: string;
  bindings: BusyBinding[];
};

export function busyTemplateBindings(template: any): BusyBinding[] {
  if (template?.status !== 'APPROVED') throw new Error('Select an approved WhatsApp template.');
  const bindings: BusyBinding[] = [];
  for (const part of template.components || []) {
    const type = String(part.type).toUpperCase();
    if (type === 'FOOTER') continue;
    if (type === 'BUTTONS') {
      if ((part.buttons || []).some((button: any) =>
        !['PHONE_NUMBER', 'URL'].includes(button.type) || /\{\{/.test(button.url || '')))
        throw new Error('Choose a template without quick-reply, dynamic URL or special buttons.');
      continue;
    }
    if (!['HEADER', 'BODY'].includes(type)) throw new Error('This template component is not supported by BUSY.');
    if (type === 'HEADER' && part.format === 'DOCUMENT') {
      bindings.push({ component: 'header', variable: 'document', type: 'document', source: 'invoice_url' });
      continue;
    }
    if (type === 'HEADER' && part.format && part.format !== 'TEXT')
      throw new Error('BUSY supports text or PDF document headers.');
    const variables = [...new Set(Array.from(String(part.text || '').matchAll(/\{\{\s*(\w+)\s*\}\}/g), m => m[1]))];
    const named = variables.some(v => !/^\d+$/.test(v));
    if (!named) variables.sort((a, b) => Number(a) - Number(b));
    for (const variable of variables) {
      bindings.push({ component: type.toLowerCase() as 'header' | 'body', variable, type: 'text', named, source: 'message' });
    }
  }
  return bindings;
}

export function busySetupUrl(origin: string, bindings: BusyBinding[] = []) {
  const extras = [...new Set(bindings.map(b => b.source))].filter(s => /^param[123]$/.test(s));
  return `${origin}/api/integrations/busy/send?token=BUSY_TOKEN&phone=BUSY_MOBILE&message=BUSY_MESSAGE` +
    extras.map(s => `&${s}=BUSY_${s.toUpperCase()}`).join('');
}
