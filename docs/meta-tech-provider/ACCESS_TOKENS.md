# Access tokens: types, storage, refresh, rotation

## Token types this app handles

| Type | `tokenSource` | Lifespan | Refresh path |
|---|---|---|---|
| Embedded Signup / manual user token | `user_token` (default) | ~60 days | Daily auto-refresh via `fb_exchange_token` |
| System User token | `system_user` | Typically "never expires" (admin's choice at generation) | None — excluded from the refresh cycle |
| Legacy env-config token | n/a (`legacyEnvConfig`) | Whatever you configure | Manual — used only for platform-sent OTPs, see `src/services/otpService.js` |

## Storage

Every token is AES-256-GCM encrypted (`backend/src/utils/crypto.js`)
before it touches `WhatsAppAccount.accessTokenEncrypted`. Plaintext tokens
are never logged — check any new logging you add near an `accessToken`
variable stays that way.

```js
const { encryptSensitiveValue, decryptSensitiveValue } = require('./src/utils/crypto');
```

## Key rotation

`crypto.js` supports zero-downtime rotation of the encryption key itself:

1. Generate a new 32-byte base64 key.
2. Move the **old** key's value into `WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS`.
3. Set `WHATSAPP_TOKEN_ENCRYPTION_KEY` to the **new** key.
4. Deploy.

New encryptions use the current key; anything already stored — including
data encrypted before this rotation scheme existed at all, which carries
no key-version label — still decrypts correctly via the previous-key
fallback. Once every stored token has naturally been re-encrypted
(happens automatically as `tokenRefreshService.js` cycles user tokens), drop
`WHATSAPP_TOKEN_ENCRYPTION_KEY_PREVIOUS`.

**This key is not part of any database backup.** See
`docs/BACKUP_RESTORE.md` — a restored database is undecryptable without
the matching key, so back up `WHATSAPP_TOKEN_ENCRYPTION_KEY` (and
`_PREVIOUS`, if mid-rotation) in a secrets manager, separately from the
Mongo dump.

## Refresh

`backend/src/services/tokenRefreshService.js` runs daily
(`startTokenRefreshScheduler`), finds `user_token`-sourced accounts within
7 days of `tokenExpiresAt`, and re-exchanges via `fb_exchange_token`. A
token that fails to refresh (already invalid) marks the account
`status: 'error'` — surfaced to the customer as "reconnect this number"
rather than silently failing sends.

## Verifying a restored database's tokens still decrypt

`backend/scripts/verify-restore.js` (see `docs/BACKUP_RESTORE.md`) samples
one `WhatsAppAccount` and confirms its token decrypts with the currently
configured key — this is the single check that catches "restored the
data but not the key it needs," the most common way a restore silently
turns out to be useless.
