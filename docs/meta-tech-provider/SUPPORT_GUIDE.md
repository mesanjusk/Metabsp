# Support guide (internal runbook)

For support staff handling customer-reported issues on this platform.

## Before anything else

Check `GET /health` on the environment the customer is on — if `ok:
false`, this is a platform-wide incident, not a customer-specific issue;
escalate immediately rather than debugging the individual account.

## "My messages aren't sending"

1. Ask what error the customer sees. "Outside 24h window" is expected
   behavior, not a bug — see `TROUBLESHOOTING.md`.
2. Check the account's `status` field (admin view or ask engineering to
   query `WhatsAppAccount` by the customer's connected number) —
   `'error'` means the stored token is dead; the fix is reconnecting, not
   a backend restart.
3. Check whether this is the Cloud API product or the Bulk (Baileys)
   product — they're architecturally different (see
   `PRODUCTION_ARCHITECTURE.md`) and fail differently. Baileys
   (`/api/whatsapp/campaigns`, `/api/bulk/*`) can disconnect if the
   underlying WhatsApp-Web session logs out remotely; Cloud API failures
   are almost always a token/webhook issue instead.

## "I'm not receiving replies from my customers"

1. Confirm the account's `webhookSubscribed` flag is true.
2. Confirm `WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE`/`META_APP_SECRET` are
   correctly configured on the environment (engineering-only check) —
   a misconfigured secret silently rejects every inbound webhook with a
   403 Meta will show in its own delivery-failure dashboard.
3. Ask the customer to check Meta Business Manager's own webhook health
   indicator for their WABA — sometimes the issue is upstream of this
   platform entirely.

## "I want to migrate my existing WhatsApp number"

See `CUSTOMER_ONBOARDING.md`'s migration section — direct them to
complete Meta's own number-release/2-step-verification process first,
then run the normal connect flow. This platform has no separate
migration mode to walk them through.

## "Can multiple people on my team reply to the same number?"

Yes — Team inbox (`TeamManagementPanel.jsx`). The account owner adds a
team member by that person's platform login mobile number; they then get
full view/reply access to that number's conversations on next login. Only
the account owner can add/remove team members.

## "I got charged for messages I didn't send" (billing dispute)

Check `usageMeteringService.js`'s message-count query for the tenant's
billing period against the actual `Message` collection — this is a real,
auditable count, not an estimate. If the dispute is about the **payment**
itself (double charge, failed UPI mandate), escalate to engineering — the
Cashfree integration is flagged unverified against live docs
(`ACCESS_TOKENS.md`/`PRODUCTION_CHECKLIST.md`) and payment disputes should
get engineering eyes rather than a first-line resolution.

## Escalation checklist for engineering

When escalating, include: the customer's connected `phoneNumberId`, the
approximate timestamp of the issue, whether it's Cloud API or Bulk
product, and (if available) the exact error message/status code shown to
the customer. This maps directly to log lines in the structured pino
output and avoids a second round-trip asking for the same details.
