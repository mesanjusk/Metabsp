# 20 — Audit Log Review

## 1. Title & Target Audience
**Title:** Audit Log Review
**Audience:** Admin / engineering
**Estimated runtime:** 4-6 min

## 2. Learning Objective
After watching, an admin understands exactly what security-relevant actions this platform records, where that data lives, and how to review it today.

## 3. Prerequisites
- Admin or engineering access to the platform's database (for a real query), or a platform admin login (for the in-product Security dashboard reference).

## 4. Hook / Cold Open
"Who logged in, who connected a WhatsApp account, who created an API key, and when — this platform records all of it. Here's exactly what's captured and how to actually look at it."

## 5. On-Screen Setup
- A terminal or database client ready to query MongoDB (for engineering-facing review), and/or the Security dashboard's Audit Logs tab open in the browser.

## 6. Step-by-Step Walkthrough
1. **Narration:** "Every security-relevant action on this platform is written to a single `AuditLog` collection — logins and failed logins, WhatsApp account connect/disconnect, System User token changes, team member add/remove, API key creation and revocation, and subscription creation."
   **On screen:** Show the `AuditLog` schema fields — `userId`, `tenantId`, `action`, `resource`, `resourceId`, `outcome`, `ipAddress`, `userAgent`, `metadata`, and `createdAt`.
2. **Narration:** "This is independent of the request-level application logs — it's a purpose-built security trail, indexed by user, tenant, action, and time."
   **On screen:** Point at the indexes defined on the model.
3. **Narration:** "There's a Security dashboard page in the app with an Audit Logs tab, filters, and CSV export — but as shipped today, that view is a UI demonstration over sample data, not a live query against the real `AuditLog` collection. There is no backend endpoint yet that serves real audit rows to that screen."
   **On screen:** Open the Security dashboard's Audit Logs tab, and be explicit on camera that what's shown there is illustrative, not live.
4. **Narration:** "So the real, live way to review this today is a direct database query — for example, finding every failed login in the last 24 hours, or every action by a specific user."
   **On screen:** Run a sample query against the `auditlogs` collection filtering on `outcome: 'failure'` and a recent `createdAt` range.
5. **Narration:** "If you want alerting on this — say, a spike in failed logins from one IP — that also needs to be built on top of this collection; nothing watches it automatically today."
   **On screen:** Reference `docs/deployment/MONITORING.md`'s note on this.

## 7. Common Mistakes / Pitfalls
- Treating the Security dashboard's Audit Logs tab as a live feed during a real investigation — verify against the actual database until a real endpoint backs that screen.
- Forgetting this is a separate collection from the general pino application logs — don't search one when you mean the other.
- Assuming audit events are retried if the recording itself fails — recording is deliberately best-effort/fire-and-forget so a logging failure never blocks the real action it's describing; a rare recording failure is logged as a warning, not surfaced anywhere else.

## 8. Troubleshooting Callout
If you need a specific user's action history for a support escalation, query `AuditLog` directly by `userId` and a time range rather than relying on the Security dashboard screen — see `docs/deployment/MONITORING.md`'s "Security/audit history: the AuditLog model" section for the exact fields and how to alert on them yourself.

## 9. Summary / Recap
"The audit trail itself is real and comprehensive — logins, account connects, token and API key changes, subscriptions. Reviewing it today means querying the database directly, since the in-product dashboard view isn't wired to live data yet."

## 10. Call to Action & Related Resources
Continue to **21 — Backup and Restore for Admins**. Related reading: `docs/deployment/MONITORING.md`.
