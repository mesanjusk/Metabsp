> **This is a template, not legal advice.** These documents describe this codebase's actual technical mechanisms where cited, but must be reviewed and finalized by a licensed attorney familiar with your jurisdiction and business before use. Bracketed placeholders must be completed before publishing externally.

# Cookie Policy

**Effective date:** [EFFECTIVE DATE]

This Cookie Policy explains what cookies and similar storage technologies the Metabsp web frontend uses.

## 1. What we actually found in this codebase

We reviewed the frontend application code before drafting this policy rather than assuming a generic cookie stack. Findings:

- **Authentication does not use a session cookie.** The frontend stores its JWT/auth token and related session state (user name, role, connected WhatsApp provider, etc.) in the browser's `localStorage` (see `frontend/src/utils/authStorage.js`), not in a cookie. This means no traditional "session cookie" is set for login state.
- **No client-side analytics or advertising tracking scripts (e.g., Google Analytics, Meta Pixel, Mixpanel, Hotjar) were found wired into the application.** No such library is loaded from the app's entry point or bundled into the frontend's dependencies as of this policy's drafting.
- **A cookie/data-use consent banner exists in the UI** (`frontend/src/components/WhatsAppConsentBanner.jsx`) that informs users what WhatsApp-related data (message content, contact numbers, delivery status, WABA identifiers) is processed by the platform. Its own dismissal state is stored in `localStorage`, not a cookie.
- Certain third-party services we use operationally (e.g., **Sentry** for error tracking, if `SENTRY_DSN` is configured) are server-side/application-monitoring integrations rather than client-side tracking cookies dropped in the visitor's browser; they are covered in the [Privacy Policy](./PRIVACY_POLICY.md)'s subprocessor list rather than here.

**Because no analytics or marketing cookies are currently set by this application, this policy describes only strictly necessary browser storage. If a future release adds any analytics, advertising, or other non-essential tracking technology (cookie- or storage-based), this policy — and the accompanying consent mechanism — must be updated before that technology goes live, and it must not be described here until it actually exists in the code.**

## 2. Categories of storage we use

| Category | What it is | Purpose | Duration |
|---|---|---|---|
| **Strictly necessary (local storage, not a cookie)** | Auth token, user role/name, selected WhatsApp provider (`localStorage`) | Keeps you signed in and preserves session/UI state across page loads | Until you log out or clear browser storage |
| **Strictly necessary (local storage, not a cookie)** | Consent-banner dismissal flag | Remembers that you've seen/dismissed the data-use consent banner | Until cleared |
| **Functional (if used by hosting infrastructure)** | Any load-balancer/session-affinity cookie set by our hosting provider or CDN, if applicable | Routes requests consistently | [COMPANY TO CONFIRM WITH HOSTING PROVIDER] |
| **Analytics** | None currently in use | — | — |
| **Marketing/advertising** | None currently in use | — | — |

## 3. Third-party embeds

If the Service embeds third-party content that itself sets cookies (for example, Meta's own Embedded Signup / Facebook Login for Business flow, which runs Meta's JavaScript SDK during WhatsApp Business Account connection), those cookies are set and controlled by Meta under its own cookie/privacy policies, not by us. [COMPANY TO REVIEW AND LIST ANY SUCH THIRD-PARTY EMBEDS SPECIFICALLY, e.g., Meta's Embedded Signup SDK, if loaded on the page.]

## 4. Your choices

Because the Service relies on `localStorage` rather than cookies for its core session functionality, standard browser cookie-blocking controls will not affect login; however, clearing your browser's site data/local storage will log you out and reset any locally remembered preferences. Most browsers let you view and clear local storage under their developer tools or site-settings pages.

## 5. Do Not Track

As no cross-site tracking technologies are currently deployed, there is no tracking behavior for a "Do Not Track" browser signal to disable. This section will be updated if that changes.

## 6. Changes to this policy

We will update this Cookie Policy if the Service begins using cookies or similar tracking technologies beyond the strictly necessary local-storage usage described above, and will seek any consent required by applicable law before doing so.

## 7. Contact us

Questions about this Cookie Policy can be directed to [PRIVACY CONTACT EMAIL].
