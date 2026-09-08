/**
 * Whether "Connect with Meta" (Embedded Signup) is offered to customers.
 *
 * The flow itself — the consent dialog, FB.login, the code exchange and the
 * complete endpoint — is left intact and untouched; this one flag governs the
 * entry points. Embedded Signup depends on this deployment's Meta app being
 * approved and configured; while that was untrue the button was closed and
 * shown as "Coming soon" so it could not fail at the popup or leave a
 * half-connected account behind.
 *
 * Meta approved this app as a Tech Provider (whatsapp_business_messaging,
 * whatsapp_business_management, public_profile) and its Embedded Signup
 * configuration, so the entry points are open. This governs the button only;
 * the coexistence path inside the same popup is a separate switch —
 * META_ENABLE_COEXISTENCE, read server-side — which stays off until the three
 * coexistence webhook fields are subscribed and one real onboarding has been
 * run end to end (see docs/meta-tech-provider/COEXISTENCE.md).
 */
export const EMBEDDED_SIGNUP_ENABLED = true;

export const EMBEDDED_SIGNUP_COMING_SOON_LABEL = 'Coming soon';

export const EMBEDDED_SIGNUP_COMING_SOON_NOTE =
  'Connecting through Meta is coming soon. For now, connect your number with an existing access token.';

export default EMBEDDED_SIGNUP_ENABLED;
