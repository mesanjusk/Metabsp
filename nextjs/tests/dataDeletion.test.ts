import crypto from 'crypto';
import { describe, it, expect } from 'vitest';
import { parseSignedRequest } from '../lib/services/dataDeletionService';

/**
 * The signature is the whole of the authentication on Meta's data-deletion
 * callback — there is no session, and the caller is asking us to permanently
 * delete an account. A forged request that verified would let anyone delete
 * any customer's data by guessing a Facebook user id.
 */
const APP_SECRET = 'test-app-secret';

const sign = (payload: object, secret = APP_SECRET) => {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  return `${signature}.${encodedPayload}`;
};

const validPayload = {
  algorithm: 'HMAC-SHA256',
  issued_at: Math.floor(Date.now() / 1000),
  user_id: '1234567890',
};

describe('parseSignedRequest', () => {
  it('accepts a request Meta actually signed', () => {
    const parsed = parseSignedRequest(sign(validPayload), APP_SECRET);
    expect(parsed?.user_id).toBe('1234567890');
  });

  it('rejects a payload signed with a different secret', () => {
    expect(parseSignedRequest(sign(validPayload, 'wrong-secret'), APP_SECRET)).toBeNull();
  });

  it('rejects a payload edited after signing', () => {
    // The exact attack: take a real signed request and swap in someone
    // else's user id.
    const signed = sign(validPayload);
    const [signature] = signed.split('.');
    const tampered = Buffer.from(
      JSON.stringify({ ...validPayload, user_id: '9999999999' })
    ).toString('base64url');

    expect(parseSignedRequest(`${signature}.${tampered}`, APP_SECRET)).toBeNull();
  });

  it('rejects an unsigned or malformed request', () => {
    for (const input of ['', 'not-a-signed-request', 'only-one-part', '.', 'a.b']) {
      expect(parseSignedRequest(input, APP_SECRET)).toBeNull();
    }
  });

  it('rejects a downgraded algorithm rather than trusting the caller', () => {
    // Refusing anything but HMAC-SHA256 stops a caller nominating a weaker
    // one, or none.
    expect(parseSignedRequest(sign({ ...validPayload, algorithm: 'none' }), APP_SECRET)).toBeNull();
    expect(parseSignedRequest(sign({ ...validPayload, algorithm: 'MD5' }), APP_SECRET)).toBeNull();
  });

  it('refuses every request when no app secret is configured', () => {
    // Otherwise a deployment that forgot META_APP_SECRET would delete
    // accounts for anyone who posted to the endpoint.
    expect(parseSignedRequest(sign(validPayload), '')).toBeNull();
  });

  it('does not throw on input that is not valid base64 or JSON', () => {
    expect(() => parseSignedRequest('!!!.???', APP_SECRET)).not.toThrow();
    expect(parseSignedRequest('!!!.???', APP_SECRET)).toBeNull();
  });
});
