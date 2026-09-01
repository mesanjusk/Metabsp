// Loads Meta's Facebook JS SDK on demand (only when a user actually starts
// the Embedded Signup flow, not on every page load) and initializes it with
// the given appId/apiVersion. Meta's WhatsApp Embedded Signup requires this
// SDK for FB.login — previously it was never loaded at all, so
// window.FB was always undefined and the connect flow silently fell back to
// a manual paste prompt.
let loadPromise = null;

export function loadFacebookSdk({ appId, apiVersion = 'v20.0' }) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Facebook SDK can only load in a browser'));
  }
  if (!appId) {
    return Promise.reject(new Error('A Meta App ID is required to load the Facebook SDK'));
  }
  if (window.FB) {
    return Promise.resolve(window.FB);
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = function fbAsyncInit() {
      window.FB.init({
        appId,
        autoLogAppEvents: true,
        xfbml: false,
        version: apiVersion,
      });
      resolve(window.FB);
    };

    const existing = document.getElementById('facebook-jssdk');
    if (existing) return; // fbAsyncInit will still fire once it loads

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Failed to load the Facebook SDK script'));
    };
    document.body.appendChild(script);
  });

  return loadPromise;
}

// Meta's Embedded Signup "finish" events. FINISH is the ordinary Cloud API
// completion; FINISH_ONLY_WABA means a WABA was created but no phone number
// was attached; FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING is Coexistence — the
// customer linked a number that stays live in their WhatsApp Business app
// (they scanned the QR code in the app's Linked devices screen).
const FINISH_EVENTS = ['FINISH', 'FINISH_ONLY_WABA', 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'];
const COEXISTENCE_FINISH_EVENT = 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING';

// Exact origins, not a suffix test. `origin.endsWith('facebook.com')` also
// accepts https://evilfacebook.com, which is a registrable domain anyone can
// buy — and this listener hands whatever it receives straight to the server as
// the WABA and phone number to claim. The popup posts from www.facebook.com;
// web.facebook.com and the m. host are included because Meta has served the
// flow from both.
export const EMBEDDED_SIGNUP_ORIGINS = [
  'https://www.facebook.com',
  'https://web.facebook.com',
  'https://m.facebook.com',
  'https://business.facebook.com',
  'https://facebook.com',
];

// Meta's Embedded Signup popup posts window messages with the WABA/phone
// number identifiers — FB.login's own callback only carries the OAuth
// `code`, not these IDs, so they must be captured via this side channel.
// See: https://developers.facebook.com/docs/whatsapp/embedded-signup
export function listenForEmbeddedSignupData({ timeoutMs = 5 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timer);
    };

    const handleMessage = (event) => {
      if (!EMBEDDED_SIGNUP_ORIGINS.includes(event.origin)) return;
      let data;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;

      if (FINISH_EVENTS.includes(data.event)) {
        settled = true;
        cleanup();
        // Coexistence is reported either as its own finish event or, in
        // session-info v3, as a FINISH whose last step was the WhatsApp
        // Business app onboarding screen — accept both.
        const step = String(data.data?.current_step || '').toUpperCase();
        resolve({
          wabaId: data.data?.waba_id || '',
          phoneNumberId: data.data?.phone_number_id || '',
          businessId: data.data?.business_id || '',
          coexistence:
            data.event === COEXISTENCE_FINISH_EVENT || step.includes('WHATSAPP_BUSINESS_APP'),
          finishEvent: data.event,
        });
      } else if (data.event === 'CANCEL' || data.event === 'ERROR') {
        settled = true;
        cleanup();
        reject(new Error(data.data?.error_message || 'Meta Embedded Signup was cancelled or failed'));
      }
    };

    window.addEventListener('message', handleMessage);
    const timer = setTimeout(() => {
      if (settled) return;
      cleanup();
      reject(new Error('Timed out waiting for Meta Embedded Signup to complete'));
    }, timeoutMs);
  });
}
