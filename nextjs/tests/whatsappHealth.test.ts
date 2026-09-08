import { describe, expect, it } from 'vitest';
import {
  classifyWhatsAppApiError,
  isDefinitiveWhatsAppDisconnectReason,
} from '@/lib/services/whatsappHealthService';

describe('WhatsApp health disconnect classification', () => {
  it('treats authorization failures as definitive disconnects', () => {
    const result = classifyWhatsAppApiError({
      response: {
        status: 403,
        data: { error: { code: 200, message: 'Permissions error' } },
      },
    });

    expect(result.code).toBe('TOKEN_EXPIRED');
    expect(isDefinitiveWhatsAppDisconnectReason(result.code)).toBe(true);
  });

  it('treats Meta object access removal as a definitive disconnect', () => {
    const result = classifyWhatsAppApiError({
      response: {
        status: 400,
        data: {
          error: {
            code: 100,
            message: 'Unsupported get request. Object cannot be loaded due to missing permissions.',
          },
        },
      },
    });

    expect(result.code).toBe('ACCESS_REVOKED');
    expect(isDefinitiveWhatsAppDisconnectReason(result.code)).toBe(true);
  });

  it('does not disconnect a workspace for an unrelated Graph error 100', () => {
    const result = classifyWhatsAppApiError({
      response: {
        status: 400,
        data: { error: { code: 100, message: 'Invalid parameter value' } },
      },
    });

    expect(result.code).toBe('NETWORK_ERROR');
    expect(isDefinitiveWhatsAppDisconnectReason(result.code)).toBe(false);
  });

  it('does not treat transient server failures as a disconnect', () => {
    const result = classifyWhatsAppApiError({
      response: {
        status: 503,
        data: { error: { code: 2, message: 'Service temporarily unavailable' } },
      },
    });

    expect(result.code).toBe('NETWORK_ERROR');
    expect(isDefinitiveWhatsAppDisconnectReason(result.code)).toBe(false);
  });
});
