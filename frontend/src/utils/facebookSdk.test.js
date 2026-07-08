import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadFacebookSdk, listenForEmbeddedSignupData } from './facebookSdk';

describe('loadFacebookSdk', () => {
  beforeEach(() => {
    delete window.FB;
    delete window.fbAsyncInit;
    document.getElementById('facebook-jssdk')?.remove();
    vi.resetModules();
  });

  it('rejects when no appId is given', async () => {
    await expect(loadFacebookSdk({ appId: '' })).rejects.toThrow(/App ID/);
  });

  it('injects the Facebook SDK script tag with the correct src', async () => {
    const promise = loadFacebookSdk({ appId: '123456', apiVersion: 'v20.0' });
    const script = document.getElementById('facebook-jssdk');

    expect(script).not.toBeNull();
    expect(script.src).toBe('https://connect.facebook.net/en_US/sdk.js');

    // Simulate the script finishing load and calling fbAsyncInit, the way
    // the real connect.facebook.net/sdk.js would.
    window.FB = { init: vi.fn(), login: vi.fn() };
    window.fbAsyncInit();

    const fb = await promise;
    expect(fb).toBe(window.FB);
    expect(window.FB.init).toHaveBeenCalledWith(
      expect.objectContaining({ appId: '123456', version: 'v20.0' })
    );
  });

  it('resolves immediately if FB is already loaded', async () => {
    window.FB = { already: 'loaded' };
    const fb = await loadFacebookSdk({ appId: '123456' });
    expect(fb).toBe(window.FB);
    expect(document.getElementById('facebook-jssdk')).toBeNull();
  });
});

describe('listenForEmbeddedSignupData', () => {
  const postFacebookMessage = (data) => {
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://www.facebook.com',
        data,
      })
    );
  };

  it('resolves with waba/phone/business IDs on a FINISH event', async () => {
    const promise = listenForEmbeddedSignupData({ timeoutMs: 1000 });
    postFacebookMessage({
      type: 'WA_EMBEDDED_SIGNUP',
      event: 'FINISH',
      data: { waba_id: 'waba-1', phone_number_id: 'phone-1', business_id: 'biz-1' },
    });

    await expect(promise).resolves.toEqual({
      wabaId: 'waba-1',
      phoneNumberId: 'phone-1',
      businessId: 'biz-1',
    });
  });

  it('rejects on a CANCEL event', async () => {
    const promise = listenForEmbeddedSignupData({ timeoutMs: 1000 });
    postFacebookMessage({ type: 'WA_EMBEDDED_SIGNUP', event: 'CANCEL', data: {} });

    await expect(promise).rejects.toThrow();
  });

  it('ignores messages from non-Facebook origins', async () => {
    const promise = listenForEmbeddedSignupData({ timeoutMs: 300 });
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.example.com',
        data: { type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH', data: { waba_id: 'x' } },
      })
    );

    await expect(promise).rejects.toThrow(/Timed out/);
  });

  it('ignores unrelated message types from Facebook', async () => {
    const promise = listenForEmbeddedSignupData({ timeoutMs: 300 });
    postFacebookMessage({ type: 'something_else' });

    await expect(promise).rejects.toThrow(/Timed out/);
  });
});
