# 23 — Token Expiry and Refresh

## 1. Title & Target Audience
**Title:** Token Expiry and Refresh
**Audience:** Admin / support staff
**Estimated runtime:** 4-6 min

## 2. Learning Objective
After watching, a support staff member or admin can diagnose an account showing `status: 'error'` and knows the correct fix.

## 3. Prerequisites
- Admin visibility into a customer's `WhatsAppAccount` record (via admin tooling or a database query).

## 4. Hook / Cold Open
"A connected number suddenly can't send messages, and the account shows `status: error`. Here's what that actually means and the one correct fix."

## 5. On-Screen Setup
- Admin view or database client able to inspect a `WhatsAppAccount` document's `status` and `tokenSource` fields.

## 6. Step-by-Step Walkthrough
1. **Narration:** "Every Embedded Signup or manually-connected token is valid roughly 60 days, and this platform refreshes it automatically, daily, once it's within 7 days of expiring."
   **On screen:** Reference `tokenRefreshService.js`'s daily scheduler.
2. **Narration:** "When that refresh succeeds, nothing changes visibly — the customer never notices. When it fails, it's because the underlying token is genuinely no longer valid: revoked, expired past repair, or the connecting user lost access on Meta's side."
   **On screen:** Show an account's `status` field flipping to `'error'`.
3. **Narration:** "The fix is not to retry the refresh — a truly dead token can't be revived by this app. The fix is reconnecting the number, either through Embedded Signup or manual connect again."
   **On screen:** Walk through disconnecting and reconnecting the affected account.
4. **Narration:** "If this keeps happening to the same number, it's usually because it's relying on one person's personal Meta login. Migrate that account to a System User token instead — those don't expire on this schedule at all."
   **On screen:** Point to the System User token button in `WhatsAppNumbersPanel`.
5. **Narration:** "Note that System User token accounts are deliberately excluded from this daily refresh cycle — running the standard refresh against one risks invalidating a working token instead of extending it."
   **On screen:** Show the "System User token" badge as the marker that excludes an account from this cycle.

## 7. Common Mistakes / Pitfalls
- Repeatedly restarting the backend hoping a dead token will start working again — it won't; the token itself needs to be replaced.
- Manually re-running the refresh logic against a System User token account — this isn't its documented refresh path and risks breaking a working token.
- Not recognizing "status: error" as the customer-facing signal to reconnect, and instead treating it as a generic bug report.

## 8. Troubleshooting Callout
An account stuck at `status: 'error'` after several days almost always means reconnecting is the only fix — check `tokenSource` first; if it's already `system_user`, the failure is something else entirely (a genuinely revoked System User token) and needs regenerating in Meta Business Manager per `docs/meta-tech-provider/SYSTEM_USER_CREATION.md`. See `docs/meta-tech-provider/TROUBLESHOOTING.md` under "Token refresh keeps failing."

## 9. Summary / Recap
"`status: error` means the token is dead, not that something's broken in the app — reconnect it, and consider a System User token if it's a recurring pattern on that number."

## 10. Call to Action & Related Resources
Continue to **24 — Template Rejection Reasons**. Related reading: `docs/meta-tech-provider/ACCESS_TOKENS.md`, `docs/meta-tech-provider/SYSTEM_USER_CREATION.md`.
