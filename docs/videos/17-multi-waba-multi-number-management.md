# 17 — Managing Multiple WhatsApp Numbers

## 1. Title & Target Audience
**Title:** Managing Multiple WhatsApp Numbers
**Audience:** New customer / developer running several brands or departments
**Estimated runtime:** 5-6 min

## 2. Learning Objective
After watching, a viewer can switch which connected number is active, disconnect a number safely, and reconnect one later without losing its history.

## 3. Prerequisites
- At least two WhatsApp numbers already connected to the same Metabsp account (see video 09).

## 4. Hook / Cold Open
"Running WhatsApp for more than one brand or team? Here's the day-to-day workflow for switching, disconnecting, and reconnecting numbers without breaking anything."

## 5. On-Screen Setup
- Logged in on `/whatsapp` → Meta tab → Settings, with two or more connected numbers visible in `WhatsAppNumbersPanel`.

## 6. Step-by-Step Walkthrough
1. **Narration:** "Here are two connected numbers. Only one is active at a time — active means it's the one your Chats, Templates, and Broadcast tabs operate against."
   **On screen:** `WhatsAppNumbersPanel.jsx` list, showing one marked active.
2. **Narration:** "Switching is one click — activate the other number."
   **On screen:** Click "Activate" on the second number; the dashboard refreshes to reflect it.
3. **Narration:** "Disconnecting a number marks it disconnected and releases its phone-number claim — it doesn't delete its history, and the number becomes available to reconnect later, by you or, if genuinely released on Meta's side, someone else."
   **On screen:** Click disconnect on a number (`POST /account/:id/disconnect`), show its status change to "disconnected."
4. **Narration:** "Reconnecting re-checks the number is still available to you before reactivating it — this is a single atomic operation, so there's no race condition between two people trying to reconnect the same number at once."
   **On screen:** Click reactivate (`POST /accounts/:id/activate`) on the disconnected number, show it become active again.
5. **Narration:** "This is also where you'd manage per-number System User tokens independently — each connected number can have its own token source."
   **On screen:** Point at the "System User token" button as a per-account setting, distinct across numbers.

## 7. Common Mistakes / Pitfalls
- Expecting two numbers to be simultaneously active in the same session — only one is active at a time, by design.
- Disconnecting a number thinking it deletes data — it doesn't; it just deactivates the connection and releases the claim.
- Reconnecting a number that's genuinely been claimed elsewhere on Meta's side — the availability check will correctly block this.

## 8. Troubleshooting Callout
If reactivating a previously disconnected number fails, it's most likely because the phone number is no longer available to this user (claimed elsewhere on Meta's side in the meantime) — `assertPhoneNumberAvailable` checks this before allowing reactivation, atomically, to avoid a stale read-then-save race. See `docs/meta-tech-provider/CUSTOMER_ONBOARDING.md` under "Reconnecting."

## 9. Summary / Recap
"Multiple numbers, one active at a time, safe disconnect/reconnect that never silently loses history — that's the full lifecycle for managing more than one WhatsApp number on this platform."

## 10. Call to Action & Related Resources
Continue to **18 — Team Member and Permission Management**. Related reading: `docs/meta-tech-provider/CUSTOMER_ONBOARDING.md`.
