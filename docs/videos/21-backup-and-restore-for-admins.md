# 21 — Backup and Restore for Admins

## 1. Title & Target Audience
**Title:** Backup and Restore for Admins
**Audience:** Admin / developer (self-hosted deployments)
**Estimated runtime:** 7-9 min

## 2. Learning Objective
After watching, an admin can run a MongoDB backup, restore it into a scratch environment, and verify the restore actually works end-to-end, including encrypted token decryption.

## 3. Prerequisites
- Shell access to the host running the backend, with `MONGO_URI` configured.
- The MongoDB Database Tools (`mongodump`/`mongorestore`) installed on that host.
- The `WHATSAPP_TOKEN_ENCRYPTION_KEY` and `JWT_SECRET` values available separately, in whatever secrets manager they're stored in.

## 4. Hook / Cold Open
"A backup you've never restored isn't a backup, it's a hope. This video runs an actual backup, restores it into a scratch environment, and proves it works."

## 5. On-Screen Setup
- A terminal with the backend repo checked out, `MONGO_URI` and `BACKUP_DIR` set.
- A separate scratch MongoDB instance available for the restore drill (never the production database).

## 6. Step-by-Step Walkthrough
1. **Narration:** "MongoDB is the only datastore that needs a durable backup — Redis holds only the send queue and rate-limit counters, both safely reconstructable, so it's intentionally excluded."
   **On screen:** Reference `docs/BACKUP_RESTORE.md`'s "What needs backing up" section.
2. **Narration:** "Run the backup script — it wraps `mongodump` into a single timestamped, gzipped archive."
   **On screen:**
   ```bash
   MONGO_URI="$MONGO_URI" BACKUP_DIR=/var/backups/metabsp npm run backup:mongo --prefix backend
   ```
3. **Narration:** "Critically, the encryption key for WhatsApp access tokens is never part of this backup — back that up separately, in a secrets manager, or every restored token is undecryptable."
   **On screen:** Point at the archive file produced, and narrate that `WHATSAPP_TOKEN_ENCRYPTION_KEY` lives elsewhere entirely.
4. **Narration:** "Now the part most teams skip — actually restoring it, into a scratch environment, never live production."
   **On screen:**
   ```bash
   MONGO_URI="$SCRATCH_MONGO_URI" npm run restore:mongo --prefix backend -- /path/to/metabsp-<timestamp>.gz
   ```
5. **Narration:** "This is destructive by design — `mongorestore --drop` replaces existing collections entirely, which is exactly what a real disaster-recovery restore should do."
   **On screen:** Show the restore completing.
6. **Narration:** "Finally, verify it actually worked — not just that the process exited zero, but that the app can connect, key collections have data, and a sample WhatsApp account's encrypted token actually decrypts with the currently configured key."
   **On screen:**
   ```bash
   MONGO_URI="$SCRATCH_MONGO_URI" WHATSAPP_TOKEN_ENCRYPTION_KEY="$KEY" npm run verify-restore --prefix backend
   ```
7. **Narration:** "That last check is the one that catches the most common way a restore silently turns out to be useless — the data came back, but not the key it needs."
   **On screen:** Show the script's pass/fail output.

## 7. Common Mistakes / Pitfalls
- Backing up MongoDB but not the token encryption key separately — a restored database with no matching key is functionally useless.
- Running a restore drill against a live production database instead of a scratch environment.
- Treating a successful `mongorestore` exit code as proof the restore is usable — always run the verification script too.

## 8. Troubleshooting Callout
If `verify-restore` fails specifically on the token-decryption check, and you know a key rotation happened recently, confirm `WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS` is also set during verification — the script exercises the previous-key fallback automatically, so a real failure here usually means neither key matches what's actually stored. See `docs/BACKUP_RESTORE.md` and `docs/meta-tech-provider/ACCESS_TOKENS.md`'s "Key rotation" section.

## 9. Summary / Recap
"Backup MongoDB on a schedule, keep the encryption key separate, and periodically prove the whole thing works with a real restore drill and the verification script — anything less is an unverified assumption."

## 10. Call to Action & Related Resources
Continue to **22 — Webhook and Signature Errors**. Related reading: `docs/BACKUP_RESTORE.md`, `docs/meta-tech-provider/ACCESS_TOKENS.md`, `docs/deployment/DISASTER_RECOVERY.md`.
