> **This is a template, not legal advice.** These documents describe this codebase's actual technical mechanisms where cited, but must be reviewed and finalized by a licensed attorney familiar with your jurisdiction and business before use. Bracketed placeholders must be completed before publishing externally.

# Data Retention Policy

**Effective date:** [EFFECTIVE DATE]

This policy describes how long [COMPANY LEGAL NAME] ("Metabsp") retains different categories of data processed through the Service, and is grounded in the platform's actual backup and storage mechanisms rather than aspirational targets.

## 1. What is actually implemented today

### 1.1 Live production data
MongoDB is the system of record for all durable application data: accounts, WhatsApp Business Account connections, messages, contacts, auto-reply/workflow rules, subscriptions, invoices, and audit logs (`docs/BACKUP_RESTORE.md`). This data is retained in the live database for as long as the relevant account remains active — **there is currently no automated job in this codebase that expires or deletes individual message or contact records after a fixed age.** Retention of live message/contact data today is a matter of operator/business policy, not enforced application logic.

**This is a decision the operator must make explicitly.** If a fixed retention period for message content or contact records is required (for contractual, regulatory, or data-minimization reasons — e.g., DPDP or GDPR storage-limitation principles), it must be implemented separately (e.g., a scheduled job that purges or anonymizes records older than a defined threshold). Until that exists, this document should not claim automatic message-content expiry.

### 1.2 Database backups
Per `docs/BACKUP_RESTORE.md`, MongoDB is backed up via `mongodump` with a suggested cadence of:

- **Daily full backups, retained 14 days.**
- **Weekly full backups, retained 90 days.**

Backups are recommended to be stored off the database host (e.g., in object storage) and are the only durable backup target — **Redis is intentionally not backed up**, since it holds only the BullMQ send queue and rate-limit counters, both ephemeral/reconstructable state whose loss causes at most a recoverable delay, not data loss.

Encrypted fields (WhatsApp access tokens, encrypted via AES-256-GCM in `backend/src/utils/crypto.js`) are only as recoverable as the encryption key used to protect them. Per the same document, `WHATSAPP_TOKEN_ENCRYPTION_KEY` (and `JWT_SECRET`) must be backed up separately from the database dump, in a secrets manager — not bundled with the Mongo archive.

**Practical effect on data deletion:** because deleted records may still exist in a backup archive taken before the deletion, "true" removal of a specific record from all Metabsp-controlled storage is only guaranteed once every backup archive that could contain it has aged out under the cadence above — i.e., within 90 days at the outside (the longest-lived weekly backup), assuming no manual restore reintroduces it in the interim.

### 1.3 Redis (queues, rate limiting)
Not backed up; holds no durable personal data by design. Loss of Redis state at most causes in-flight broadcast jobs to need re-triggering and resets rate-limit windows.

## 2. Retention by data category

| Category | Where it lives | Retention today | Notes |
|---|---|---|---|
| Business Customer account data (name, email, mobile, org) | MongoDB | Duration of account, per live-data caveat in 1.1 | No automated purge job |
| WhatsApp access tokens | MongoDB (AES-256-GCM encrypted) | Duration of the connected WhatsApp Business Account | Rotated as `tokenRefreshService.js` cycles tokens; encryption key managed separately |
| Contacts (phone, name, email, city, state, company, notes, tags, custom fields) | MongoDB | Duration of account, per live-data caveat in 1.1 | [OPERATOR TO SET AN EXPLICIT POLICY IF REQUIRED] |
| Messages (content, media references, delivery/read status) | MongoDB; media files hosted with Cloudinary | Duration of account, per live-data caveat in 1.1 | No automated content-expiry job exists today |
| Subscriptions / invoices | MongoDB | Duration of account plus any statutory record-keeping period | [COMPANY TO SPECIFY TAX/ACCOUNTING RETENTION REQUIREMENT] |
| Audit logs (security/admin actions) | MongoDB (`AuditLog` collection) | Duration of account, per live-data caveat in 1.1 | Recorded best-effort/fire-and-forget; a logging failure never blocks the underlying action |
| Database backups | Off-host archive storage | Daily backups: 14 days. Weekly backups: 90 days | Per `docs/BACKUP_RESTORE.md` |
| Redis (queues, rate-limit counters) | Redis | Not backed up; ephemeral | No durable personal data retained here by design |

## 3. Account deletion / export process

**Honesty note:** the Service does not currently expose a self-service "export my data" or "delete my account" API endpoint or UI flow. Account deletion and data export requests are handled manually today via [SUPPORT CONTACT / PROCESS — COMPANY TO SPECIFY, e.g., a support ticket to privacy@[COMPANY DOMAIN]].

Until an automated flow exists, the manual process should, at minimum:

1. Verify the requester's authority to act on the account (e.g., account owner/admin).
2. For export requests: produce a reasonable export of the account's data (account profile, contacts, message history, templates/automations, invoices) and deliver it securely.
3. For deletion requests: deactivate the account and connected WhatsApp Business Account(s), then delete or anonymize the underlying records from production systems within [DELETION WINDOW — COMPANY TO SPECIFY].
4. Note to the requester that residual copies may exist in database backups until those backups age out under the cadence in Section 1.2 (up to 90 days for the longest-lived weekly backup), and that Metabsp does not selectively edit existing backup archives.
5. Confirm completion to the requester.

**Recommended next step for the operator:** if a contractual or regulatory commitment requires either (a) enforceable, timely deletion of message/contact data on a fixed schedule, or (b) a genuinely self-service export/erasure flow, these must be built as application features — they do not exist in the current codebase and should not be represented as existing in any customer-facing document until they do.

## 4. Backup restore drills

Per `docs/BACKUP_RESTORE.md`, restore drills (verifying that a backup can actually be restored and that its encrypted fields decrypt with the currently configured key) are recommended on a quarterly cadence using `backend/scripts/verify-restore.js`. This is an operational practice, not a data-subject-facing retention control, but is noted here because it directly affects how reliably a "true" deletion (Section 1.2) can be confirmed across all backup copies.

## 5. Changes to this policy

We may update this Data Retention Policy as our retention practices evolve, including if/when automated message/contact retention enforcement is implemented. Material changes will be reflected in the "Effective date" above.
