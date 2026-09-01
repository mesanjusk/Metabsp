> **This is a template, not legal advice.** These documents describe this codebase's actual technical mechanisms where cited, but must be reviewed and finalized by a licensed attorney familiar with your jurisdiction and business before use. Bracketed placeholders must be completed before publishing externally.

# Data Retention Policy

**Effective date:** [EFFECTIVE DATE]

This policy describes how long [COMPANY LEGAL NAME] ("Metabsp") retains different categories of data processed through the Service, and is grounded in the platform's actual backup and storage mechanisms rather than aspirational targets.

## 1. What is actually implemented today

### 1.1 Live production data
MongoDB is the system of record for all durable application data: accounts, WhatsApp Business Account connections, messages, contacts, auto-reply/workflow rules, subscriptions, invoices, and audit logs (`docs/BACKUP_RESTORE.md`).

**A retention sweep is implemented** in `nextjs/lib/services/dataRetentionService.ts`. It runs once a day, under the same Redis leader lock as the other schedulers so multiple instances cannot duplicate it, and it:

- deletes **messages** whose `createdAt` is older than `RETENTION_MESSAGES_DAYS`;
- deletes **contacts** whose `lastSeen` is older than `RETENTION_CONTACTS_INACTIVE_DAYS` — measured from last contact, not from row age, so a long-standing customer who messaged recently is not treated as stale;
- deletes **audit log** entries older than `RETENTION_AUDIT_LOG_DAYS`;
- deletes the **Cloudinary media file** belonging to a pruned message *before* deleting the row, so removal is not merely the loss of a pointer to a file that survives (controlled by `RETENTION_DELETE_MEDIA`, on by default);
- records each run, with counts, as a `data_retention.sweep` entry in the audit log, so the policy can be evidenced.

Deletes run in bounded batches with a per-run ceiling, so enabling this against years of accumulated history cannot lock the database.

**Every window defaults to `0`, meaning keep indefinitely.** That is deliberate: deleting message history is irreversible, and how long to keep customer communications is a legal and commercial decision, not something a deployment should inherit from a default. Until the operator sets a value, the behaviour is exactly as it was — data is kept for the life of the account.

**[OPERATOR TO SET]** the three windows above to the periods this business has committed to, in the deployment's environment. This document should not be published to customers with a specific retention period stated until those values are actually configured.

### 1.2 Database backups
Per `docs/BACKUP_RESTORE.md`, MongoDB is backed up via `mongodump` with a suggested cadence of:

- **Daily full backups, retained 14 days.**
- **Weekly full backups, retained 90 days.**

Backups are recommended to be stored off the database host (e.g., in object storage) and are the only durable backup target — **Redis is intentionally not backed up**, since it holds only the BullMQ send queue and rate-limit counters, both ephemeral/reconstructable state whose loss causes at most a recoverable delay, not data loss.

Encrypted fields (WhatsApp access tokens, encrypted via AES-256-GCM in `nextjs/lib/utils/crypto.ts`) are only as recoverable as the encryption key used to protect them. Per the same document, `WHATSAPP_TOKEN_ENCRYPTION_KEY` (and `JWT_SECRET`) must be backed up separately from the database dump, in a secrets manager — not bundled with the Mongo archive.

**Practical effect on data deletion:** because deleted records may still exist in a backup archive taken before the deletion, "true" removal of a specific record from all Metabsp-controlled storage is only guaranteed once every backup archive that could contain it has aged out under the cadence above — i.e., within 90 days at the outside (the longest-lived weekly backup), assuming no manual restore reintroduces it in the interim.

### 1.3 Redis (queues, rate limiting)
Not backed up; holds no durable personal data by design. Loss of Redis state at most causes in-flight broadcast jobs to need re-triggering and resets rate-limit windows.

## 2. Retention by data category

| Category | Where it lives | Retention today | Notes |
|---|---|---|---|
| Business Customer account data (name, email, mobile, org) | MongoDB | Duration of account, per live-data caveat in 1.1 | No automated purge job |
| WhatsApp access tokens | MongoDB (AES-256-GCM encrypted) | Duration of the connected WhatsApp Business Account | Rotated as `tokenRefreshService.js` cycles tokens; encryption key managed separately |
| Contacts (phone, name, email, city, state, company, notes, tags, custom fields) | MongoDB | `RETENTION_CONTACTS_INACTIVE_DAYS` after last contact; indefinite when unset | Enforced by the daily sweep in 1.1 |
| Messages (content, media references, delivery/read status) | MongoDB; media files hosted with Cloudinary | `RETENTION_MESSAGES_DAYS`; indefinite when unset | Enforced by the daily sweep in 1.1, which deletes the Cloudinary file too |
| Subscriptions / invoices | MongoDB | Duration of account plus any statutory record-keeping period | [COMPANY TO SPECIFY TAX/ACCOUNTING RETENTION REQUIREMENT] |
| Audit logs (security/admin actions) | MongoDB (`AuditLog` collection) | `RETENTION_AUDIT_LOG_DAYS`; indefinite when unset | Recorded best-effort; a logging failure never blocks the underlying action |
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

**Recommended next step for the operator:** scheduled deletion (a) now exists and is described in Section 1.1 — it needs its windows configured, not built. A genuinely self-service export/erasure flow (b) still does not exist and must not be represented as existing in any customer-facing document until it does.

## 4. Backup restore drills

Per `docs/BACKUP_RESTORE.md`, restore drills (verifying that a backup can actually be restored and that its encrypted fields decrypt with the currently configured key) are recommended on a quarterly cadence using `nextjs/scripts/verify-restore.mjs`. This is an operational practice, not a data-subject-facing retention control, but is noted here because it directly affects how reliably a "true" deletion (Section 1.2) can be confirmed across all backup copies.

## 5. Changes to this policy

We may update this Data Retention Policy as our retention practices evolve, including if/when automated message/contact retention enforcement is implemented. Material changes will be reflected in the "Effective date" above.
