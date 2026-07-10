> **This is a template, not legal advice.** These documents describe this codebase's actual technical mechanisms where cited, but must be reviewed and finalized by a licensed attorney familiar with your jurisdiction and business before use. Bracketed placeholders must be completed before publishing externally.

# Security Policy

**Effective date:** [EFFECTIVE DATE]

This document describes the technical security measures implemented in the Metabsp platform, and how to report a suspected security vulnerability. It is written to reflect what the codebase actually does, not generic industry boilerplate.

## 1. Encryption of sensitive data at rest

WhatsApp access tokens are encrypted at rest using **AES-256-GCM** authenticated encryption (`backend/src/utils/crypto.js`):

- Each value is encrypted with a random 96-bit IV and the resulting authentication tag is stored alongside the ciphertext, so tampering is detectable at decryption time.
- The encryption key is supplied via the `WHATSAPP_TOKEN_ENCRYPTION_KEY` environment variable (a base64-encoded 32-byte key) and is never stored alongside the encrypted data or in the database backup.
- **Zero-downtime key rotation** is supported: an operator can introduce a new key as `WHATSAPP_TOKEN_ENCRYPTION_KEY` while moving the prior key to `WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS`. New values are always encrypted with the current key; values encrypted under the previous key (or under the legacy pre-rotation format) still decrypt correctly via fallback logic, until they are naturally re-encrypted (e.g., as tokens are refreshed).
- Backup/restore procedures (`docs/BACKUP_RESTORE.md`) explicitly call for storing the encryption key separately from database dumps, since a database backup is only as useful as the key needed to decrypt the tokens within it.

## 2. Authentication and authorization

- User sessions are authenticated via **JWTs**, which are re-verified against the live user record in the database on every request (not trusted on claims alone), ensuring that a revoked or altered user immediately loses access rather than continuing to act on a stale token (`backend/src/middleware/auth.js`, delegating to the unified auth path).
- Administrative actions are gated behind role/permission checks (`requireAdmin`, permission-based `permit()` checks), derived from the authenticated user's assigned role.
- Programmatic/API access can alternatively use an **API key** (`X-Api-Key` header), validated against active, non-revoked keys stored per user (`backend/src/middleware/apiKeyAuth.js`), with last-used timestamps tracked for visibility into key activity.
- Passwords are hashed, not stored in plaintext (`backend/src/utils/password.js`).

## 3. Webhook authenticity

- Inbound webhooks from Meta are verified using an **HMAC-SHA256 signature check** against the `X-Hub-Signature-256` header, computed over the raw request body using the configured Meta app secret, and compared using a **timing-safe comparison** (`crypto.timingSafeEqual`) to resist timing attacks (`backend/src/controllers/whatsappController.js`).
- Signature enforcement is controlled by `WHATSAPP_ENFORCE_WEBHOOK_SIGNATURE`; when enabled, a webhook is rejected outright if the app secret is not configured or the signature is invalid/missing.
- Outbound webhook events forwarded to a Business Customer's configured destination are themselves HMAC-SHA256 signed (`X-Metabsp-Signature-256` header) so the receiving system can verify authenticity, with retry-with-backoff on delivery failure.

## 4. Rate limiting

- Rate limiting is backed by **Redis** (via `rate-limit-redis` on top of `express-rate-limit`), so limits are enforced consistently across horizontally scaled instances and survive process restarts, rather than resetting per-instance as an in-memory limiter would (`backend/src/middleware/rateLimit.js`).
- Authenticated routes are rate-limited per user (or per IP if unauthenticated); a stricter, IP-keyed limiter is applied to unauthenticated auth/OTP endpoints (login, signup OTP request, password reset) — the highest-value targets for brute-force or enumeration attacks.
- By design, a Redis outage degrades rate limiting to "not enforced" rather than blocking the underlying messaging/API routes (`passOnStoreError: true`) — an explicit availability-over-strictness tradeoff during transient infrastructure failure. [OPERATOR SHOULD CONFIRM THIS TRADEOFF MATCHES THEIR RISK TOLERANCE]

## 5. Network and transport-layer protections

- HTTP security headers are applied via `helmet()` on every request (`backend/src/app.js`), including a default Content-Security-Policy (relaxed only for the `/api-docs` Swagger UI route, which needs inline scripts).
- CORS is restricted to an explicit allow-list of known frontend origins plus the configured `FRONTEND_URL`; unrecognized origins are rejected.
- `TRUST_PROXY` is configured to the correct reverse-proxy hop count so that client IP addresses (used for rate limiting and audit logging) reflect the real client rather than the proxy.
- [TLS/HTTPS TERMINATION DETAILS — COMPANY TO SPECIFY, typically handled at the hosting/CDN layer rather than in application code]

## 6. Audit logging

Security- and administration-relevant actions are recorded in an append-only audit log (`backend/src/models/AuditLog.js`, `backend/src/services/auditLogService.js`), capturing:

- the acting user (`userId`) and tenant (`tenantId`),
- the `action` taken and the `resource`/`resourceId` affected,
- whether the action succeeded or failed (`outcome`),
- the requester's IP address and user agent,
- a timestamp.

Logging is intentionally best-effort/fire-and-forget: a logging failure never blocks the underlying action it's recording, matching the pattern used elsewhere in the codebase (e.g., tenant provisioning, webhook auto-subscription). This means audit logging supports investigation and accountability but should not be relied upon as a hard compliance control against every possible logging-path failure.

## 7. Backups and disaster recovery

See the [Data Retention Policy](./DATA_RETENTION_POLICY.md) and `docs/BACKUP_RESTORE.md` for full detail. In summary: daily database backups retained 14 days, weekly backups retained 90 days, stored off the database host; encryption keys backed up separately from data; quarterly restore drills recommended to verify backups are actually restorable and that encrypted fields decrypt correctly with the currently configured key.

## 8. Vulnerability scope and known limitations

In the interest of an honest security posture rather than a marketing one:

- Rate limiting fails open (not closed) during a Redis outage (Section 4) — an intentional availability tradeoff.
- Audit logging is best-effort and can silently fail without blocking the underlying action (Section 6).
- There is no automated data-retention/erasure job for message or contact content (see the [Data Retention Policy](./DATA_RETENTION_POLICY.md)) — this is a gap the operator should address if required by policy or regulation.
- [OPERATOR TO ADD: any additional known limitations, pending security work, or compensating controls not reflected above]

## 9. Responsible disclosure

We welcome reports of suspected security vulnerabilities. Please report suspected vulnerabilities to:

- **Security contact:** [SECURITY CONTACT EMAIL]
- **PGP key (optional):** [PGP KEY / FINGERPRINT, IF OFFERED]

Please include enough detail to reproduce the issue, and avoid actions that could affect the availability or integrity of the Service or other customers' data (e.g., do not access, modify, or exfiltrate another tenant's data beyond what is minimally necessary to demonstrate the issue). We aim to acknowledge reports within [ACKNOWLEDGEMENT TIMEFRAME, e.g., 3 business days] and will work with reporters on responsible, coordinated disclosure timelines. [BUG BOUNTY / SAFE HARBOR LANGUAGE, IF OFFERED — COMPANY TO SPECIFY]

## 10. Changes to this policy

We will update this Security Policy as our security measures evolve. Material changes will be reflected in the "Effective date" above.
