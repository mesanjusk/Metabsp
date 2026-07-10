# 25 — Where to Find Logs and Health Status

## 1. Title & Target Audience
**Title:** Where to Find Logs and Health Status
**Audience:** Admin / developer
**Estimated runtime:** 5-7 min

## 2. Learning Objective
After watching, an admin knows the first place to check when something seems wrong platform-wide, and where structured logs and error tracking actually live.

## 3. Prerequisites
- Access to the backend's deployment environment (container logs, hosting platform dashboard, or Sentry if configured).

## 4. Hook / Cold Open
"Before debugging any single customer's issue, check one thing first: is this platform-wide, or just them? This is how to tell in under a minute."

## 5. On-Screen Setup
- A terminal or browser tab ready to hit the backend's `/health` endpoint.
- Access to wherever this deployment's container logs are shipped (Docker/Kubernetes/cloud logging), and Sentry if `SENTRY_DSN` is configured.

## 6. Step-by-Step Walkthrough
1. **Narration:** "Always start here: `GET /health`. If it returns `ok: false` or a 503, this is a platform-wide incident — a database connectivity problem, most likely — not a single customer's bug."
   **On screen:** Hit `GET /health`, show the `{ ok: true, db: 'connected', uptimeSeconds, timestamp }` response, and the 503 shape for comparison.
2. **Narration:** "Application logs are structured JSON, written to stdout by pino — every request except health checks and the root path is auto-logged."
   **On screen:** Show a sample of structured log lines from wherever this deployment's logs are collected (container runtime logs, or a cloud log sink).
3. **Narration:** "Sensitive fields are redacted automatically before anything is logged — tokens, passwords, OTPs, and authorization headers never appear in plaintext here, so these logs are safe to ship to a third party without extra scrubbing."
   **On screen:** Point out a redacted field in a sample log line.
4. **Narration:** "If Sentry is configured for this environment, unhandled errors flow there automatically, with stack traces and request context — that's the fastest way to see application-level exceptions the health check alone can't reveal."
   **On screen:** Open the Sentry project dashboard (if configured) and show a recent issue.
5. **Narration:** "For the WhatsApp send queue specifically, a growing failed-job count usually means a Meta API error or an expiring token on a specific number — not a code bug — so route that alert to whoever owns WhatsApp account health rather than general on-call."
   **On screen:** Reference the BullMQ queue's failed-job count as a metric to watch, per `docs/deployment/MONITORING.md`.

## 7. Common Mistakes / Pitfalls
- Debugging an individual customer's report before checking `/health` first — if the platform itself is degraded, individual troubleshooting wastes time.
- Assuming Sentry is capturing errors without first confirming `SENTRY_DSN` is actually set for this environment — it's fully inert until configured.
- Forgetting the standalone worker process doesn't automatically get Sentry coverage unless it separately requires the same instrumentation module.

## 8. Troubleshooting Callout
If `/health` itself is unreachable or timing out (not just returning a 503 body), treat that as a more severe outage than a degraded-but-responding process — check the hosting platform's own uptime/process status before assuming it's purely a database issue. See `docs/deployment/MONITORING.md` for the full breakdown of what's built in and how to wire up alerts.

## 9. Summary / Recap
"`/health` first, structured pino logs for request-level detail, Sentry for unhandled exceptions once configured — that's the full observability picture this platform ships with today."

## 10. Call to Action & Related Resources
This concludes the video series. Related reading: `docs/deployment/MONITORING.md`, `docs/deployment/DISASTER_RECOVERY.md`, `docs/meta-tech-provider/SUPPORT_GUIDE.md`.
