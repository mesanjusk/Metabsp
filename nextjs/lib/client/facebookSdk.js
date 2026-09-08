// Loads Meta's Facebook JS SDK on demand (only when a user actually starts
// the Embedded Signup flow, not on every page load) and initializes it with
// the given appId/apiVersion. Meta's WhatsApp Embedded Signup requires this
// SDK for FB.login — previously it was never loaded at all, so
// window.FB was always undefined and the connect flow silently fell back to
// a manual paste prompt.
let loadPromise = null;

// `apiVersion` here is the Facebook JS SDK version passed to FB.init — the
// server sends it as `sdkVersion` from GET /api/whatsapp/connect/config, which
// can track Meta's Embedded Signup Builder output independently of the Graph
// API version used for server-side calls. Defaults to the validated baseline.
export function loadFacebookSdk({ appId, apiVersion = 'v23.0' }) {
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
        // Off deliberately: the SDK is loaded to power the Embedded Signup
        // popup, not to send automatic app-event/analytics traffic to Meta on
        // every dashboard that happens to initialise it.
        autoLogAppEvents: false,
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

// Build exactly the launch shape emitted by Meta's current Embedded Signup v4
// Builder for this production configuration. Keeping this pure and exported
// gives the launch parameters direct unit coverage instead of burying them in
// a React hook.
export function buildEmbeddedSignupLoginOptions({
  configId,
  embeddedSignupVersion = 'v4',
  coexistenceEnabled = false,
  featureType = '',
}) {
  const extras = {
    version: embeddedSignupVersion,
    ...(coexistenceEnabled && featureType ? { featureType } : {}),
  };

  return {
    config_id: configId,
    response_type: 'code',
    override_default_response_type: true,
    extras,
  };
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

// Meta's Embedded Signup popup normally posts window messages with the
// WABA/phone identifiers, while FB.login's callback carries the OAuth code.
// In practice some popup variants complete successfully but omit the final
// WA_EMBEDDED_SIGNUP postMessage. The server is already designed to re-derive
// WABA/phone/coexistence from the BISU token, so callers can opt into a safe
// code-only fallback after a short grace period instead of hanging for minutes.
// See: https://developers.facebook.com/docs/whatsapp/embedded-signup
export function listenForEmbeddedSignupData({ timeoutMs = 5 * 60 * 1000, allowMissingOnTimeout = false } = {}) {
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
        // Coexistence is reported either as its own finish event or as a FINISH
        // whose last step names the WhatsApp Business app onboarding screen —
        // accept both defensively across current Meta payload variants.
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
      settled = true;
      cleanup();
      if (allowMissingOnTimeout) {
        resolve({ wabaId: '', phoneNumberId: '', businessId: '', coexistence: false, finishEvent: '' });
        return;
      }
      reject(new Error('Timed out waiting for Meta Embedded Signup to complete'));
    }, timeoutMs);
  });
}
