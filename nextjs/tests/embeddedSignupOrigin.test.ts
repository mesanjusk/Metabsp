import { describe, expect, it, beforeEach, afterEach } from 'vitest';

/**
 * Meta's Embedded Signup popup reports the new WABA and phone number id by
 * posting a window message; FB.login's own callback carries only the OAuth
 * code. Whatever this listener accepts is handed to the server as the
 * identifiers to claim, so the origin test in front of it is a real trust
 * boundary rather than a formality.
 *
 * It used to be `event.origin.endsWith('facebook.com')`, which also accepts
 * https://evilfacebook.com — a registrable domain anyone can buy.
 */

const listeners: Array<(event: any) => void> = [];

beforeEach(() => {
  listeners.length = 0;
  (globalThis as any).window = {
    addEventListener: (_type: string, handler: any) => listeners.push(handler),
    removeEventListener: () => undefined,
  };
});

afterEach(() => {
  delete (globalThis as any).window;
});

const { listenForEmbeddedSignupData, EMBEDDED_SIGNUP_ORIGINS } = await import('@/lib/client/facebookSdk');

const finishEvent = (origin: string) => ({
  origin,
  data: {
    type: 'WA_EMBEDDED_SIGNUP',
    event: 'FINISH',
    data: { waba_id: 'waba-1', phone_number_id: 'pn-1', business_id: 'biz-1' },
  },
});

const post = (event: any) => listeners.forEach((handler) => handler(event));

describe('Embedded Signup postMessage origin', () => {
  it('accepts the finish event from Meta and returns the identifiers', async () => {
    const pending = listenForEmbeddedSignupData();
    post(finishEvent('https://www.facebook.com'));

    await expect(pending).resolves.toMatchObject({
      wabaId: 'waba-1',
      phoneNumberId: 'pn-1',
      coexistence: false,
    });
  });

  it('REJECTS a look-alike domain that merely ends in facebook.com', async () => {
    // The outcome must be observed after the listener's own timeout has had a
    // chance to fire, not synchronously after posting: a promise that the
    // handler resolved is still unsettled on the next line, so checking a flag
    // here would pass against the vulnerable suffix check too.
    const pending = listenForEmbeddedSignupData({ timeoutMs: 20 }).then(
      (value: any) => ({ accepted: true, value }),
      (error: any) => ({ accepted: false, error })
    );

    post(finishEvent('https://evilfacebook.com'));
    post(finishEvent('https://facebook.com.attacker.test'));
    post(finishEvent('http://www.facebook.com')); // plain HTTP is not Meta either

    const outcome = await pending;

    expect(outcome.accepted).toBe(false);
    expect((outcome as any).error.message).toMatch(/timed out/i);
  });

  it('recognises a coexistence finish as coexistence', async () => {
    const pending = listenForEmbeddedSignupData();
    post({
      origin: 'https://www.facebook.com',
      data: {
        type: 'WA_EMBEDDED_SIGNUP',
        event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
        data: { waba_id: 'waba-2', phone_number_id: 'pn-2' },
      },
    });

    await expect(pending).resolves.toMatchObject({ coexistence: true });
  });

  it('allow-lists exact origins only, with no wildcard or suffix entry', () => {
    for (const origin of EMBEDDED_SIGNUP_ORIGINS) {
      expect(origin.startsWith('https://')).toBe(true);
      expect(origin).not.toContain('*');
    }
  });
});
