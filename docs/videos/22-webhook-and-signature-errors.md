# 22 — Webhook and Signature Errors

## 1. Title & Target Audience
**Title:** Webhook and Signature Errors
**Audience:** Developer / admin
**Estimated runtime:** 5-7 min

## 2. Learning Objective
After watching, a developer can diagnose why Meta's webhook isn't reaching this platform, or why deliveries are being silently rejected.

## 3. Prerequisites
- Admin/engineering access to the backend's environment variables.
- Access to the Meta App Dashboard's Webhooks configuration for the WABA in question.

## 4. Hook / Cold Open
"Webhook problems almost always come down to one of three things: the verify token, the app secret, or per-WABA subscription. This video walks through all three."

## 5. On-Screen Setup
- A terminal with access to the backend's environment configuration.
- The Meta App Dashboard open to WhatsApp → Configuration → Webhooks.

## 6. Step-by-Step Walkthrough
1. **Narration:** "First, the verification handshake — Meta sends a GET request with a verify token when you save the callback URL. That token has to match `WHATSAPP_WEBHOOK_VERIFY_TOKEN` exactly."
   **On screen:** Show the backend's environment variable, and the matching value entered in Meta's dashboard.
2. **Narration:** "Second, every actual webhook delivery is signature-verified using `META_APP_SECRET` — an HMAC-SHA256 over the raw request body. If this doesn't match what Meta is actually signing with, every delivery gets a silent 403."
   **On screen:** Point at the `X-Hub-Signature-256` header concept and where `META_APP_SECRET` is set.
3. **Narration:** "Third — and this one's easy to miss — registering the callback URL at the App level isn't enough by itself. Each WABA also needs the app subscribed to it specifically. This normally happens automatically at connect time."
   **On screen:** Check the account's `webhookSubscribed` flag (via admin tooling or a database query).
4. **Narration:** "If deliveries are failing, Meta shows this in its own Webhooks diagnostics panel — check there too, since the failure might be visible on Meta's side before it's obvious on ours."
   **On screen:** Meta App Dashboard → Webhooks → recent deliveries/failures.
5. **Narration:** "Also confirm Mongo is actually up — message processing runs in the background after the fast acknowledgment, so a database outage fails silently there rather than in the webhook response itself."
   **On screen:** Check `GET /health`.

## 7. Common Mistakes / Pitfalls
- Assuming a webhook problem is code-level before checking the three basics: verify token match, app secret match, and per-WABA subscription.
- Disabling signature enforcement (`WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE=false`) to "fix" a mismatch instead of fixing the actual secret — never do this in production.
- Not checking Meta's own webhook diagnostics panel, and only looking at this platform's logs.

## 8. Troubleshooting Callout
A 403 on `POST /webhook` almost always means `META_APP_SECRET` doesn't match what Meta is signing with — recompute the expected signature locally against a captured payload if you need to confirm this precisely. See `docs/meta-tech-provider/TROUBLESHOOTING.md` under "Webhook not receiving messages" and `docs/meta-tech-provider/WEBHOOK_SETUP.md` for the full signature-verification mechanics.

## 9. Summary / Recap
"Verify token match, app secret match, per-WABA subscription — in that order — resolves the overwhelming majority of webhook issues on this platform."

## 10. Call to Action & Related Resources
Continue to **23 — Token Expiry and Refresh**. Related reading: `docs/meta-tech-provider/WEBHOOK_SETUP.md`, `docs/meta-tech-provider/TROUBLESHOOTING.md`.
