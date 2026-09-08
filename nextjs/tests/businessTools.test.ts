import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  businessToolCapabilities,
  createFlow,
  createQrCode,
  getBusinessProfile,
  updateCommerceSettings,
} from '@/lib/whatsapp/businessTools';

const account = {
  graphVersion: 'v23.0',
  accessToken: 'secret-token',
  phoneNumberId: 'phone-1',
  wabaId: 'waba-1',
};

describe('WhatsApp business tools', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the WhatsApp business profile through the active phone number', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [{ business_profile: { about: 'Hello', vertical: 'OTHER' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const profile = await getBusinessProfile(account);

    expect(profile).toMatchObject({ about: 'Hello', vertical: 'OTHER' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v23.0/phone-1/whatsapp_business_profile');
    expect(String(url)).toContain('fields=');
    expect((init?.headers as any)?.Authorization).toBe('Bearer secret-token');
  });

  it('writes cart and catalogue visibility as Meta commerce settings', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await updateCommerceSettings(account, { isCartEnabled: true, isCatalogVisible: false });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('is_cart_enabled=true');
    expect(String(url)).toContain('is_catalog_visible=false');
    expect(init?.method).toBe('POST');
  });

  it('creates message QR codes without exposing the access token in the URL', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'QR1', deep_link_url: 'https://wa.me/message/QR1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await createQrCode(account, 'Hello there');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/phone-1/message_qrdls');
    expect(String(url)).not.toContain('secret-token');
    expect(JSON.parse(String(init?.body))).toMatchObject({ prefilled_message: 'Hello there', generate_qr_image: 'PNG' });
  });

  it('creates a Flow asset under the connected WABA', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'flow-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await createFlow(account, { name: 'Lead form', categories: ['LEAD_GENERATION'] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/waba-1/flows');
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get('name')).toBe('Lead form');
    expect((init?.body as FormData).get('categories')).toBe('["LEAD_GENERATION"]');
  });

  it('does not pretend product CRUD is available with only WhatsApp permissions', () => {
    expect(businessToolCapabilities.catalogItemManagement).toBe(false);
    expect(businessToolCapabilities.catalogItemManagementReason).toContain('additional');
  });
});
