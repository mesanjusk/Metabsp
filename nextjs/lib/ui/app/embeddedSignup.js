/**
 * Whether "Connect with Meta" (Embedded Signup) is offered to customers.
 *
 * The flow itself — the consent dialog, FB.login, the code exchange and the
 * complete endpoint — is left intact and untouched; only the entry points are
 * closed. Embedded Signup depends on this deployment's Meta app being approved
 * and configured, and until that is true the button either fails at the popup
 * or leaves a half-connected account behind, which is worse than not offering
 * it. Marking it "Coming soon" and pointing at the token route says plainly
 * what is happening, and flipping this one flag back to true re-opens every
 * entry point at once.
 */
export const EMBEDDED_SIGNUP_ENABLED = false;

export const EMBEDDED_SIGNUP_COMING_SOON_LABEL = 'Coming soon';

export const EMBEDDED_SIGNUP_COMING_SOON_NOTE =
  'Connecting through Meta is coming soon. For now, connect your number with an existing access token.';

export default EMBEDDED_SIGNUP_ENABLED;
