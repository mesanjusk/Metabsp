# 06 — The 24-Hour Customer Service Window Explained

## 1. Title & Target Audience
**Title:** The 24-Hour Customer Service Window Explained
**Audience:** New customer
**Estimated runtime:** 3-5 min

## 2. Learning Objective
After watching, a viewer understands why free-form messages sometimes get blocked, and knows to use a template message outside the 24-hour window.

## 3. Prerequisites
- A connected WhatsApp number.
- At least one approved message template (see video 10 if none exist yet).

## 4. Hook / Cold Open
"Ever tried to reply to a customer and gotten an 'outside 24-hour window' error? That's not a bug — it's Meta's own policy, and this video shows you exactly when it applies and how to work around it."

## 5. On-Screen Setup
- Logged in on `/whatsapp` → Meta tab → Chats (inbox).
- One conversation where the customer's last message is recent (inside the window), and — for the demo — a scenario narrated for a conversation older than 24 hours (can be simulated/described rather than waiting a real day).

## 6. Step-by-Step Walkthrough
1. **Narration:** "Meta's rule: you can send free-form text or media to a customer only within 24 hours of their last message to you. Outside that window, only pre-approved template messages go through."
   **On screen:** Point at the inbox, a recent customer message with a visible timestamp.
2. **Narration:** "This is enforced automatically — the platform checks the timestamp of that customer's last inbound message before allowing a free-form send."
   **On screen:** Send a normal text reply successfully inside the window (`send-text` / `send-message` calls this check via `enforceWhatsApp24hWindow`).
3. **Narration:** "If you try to send free text after that window closes, you'll get a 403 with a clear message: outside the 24-hour window."
   **On screen:** Show the error toast (can be a staged/described scenario rather than a live 24h-old conversation).
4. **Narration:** "The fix isn't to retry — it's to send a template message instead. Templates are pre-approved by Meta and work regardless of the window."
   **On screen:** Switch to the Templates sub-tab and send a template to the same contact.
5. **Narration:** "Note that sending a template doesn't require this same check — `send-template` isn't gated by the 24-hour guard."
   **On screen:** Point out the successful template send.

## 7. Common Mistakes / Pitfalls
- Assuming this is a platform bug rather than Meta's own policy — it isn't something Metabsp can override.
- Forgetting that media messages are also gated by the same window, not just plain text.
- Not having any approved templates ready when a customer's window has already closed.

## 8. Troubleshooting Callout
"Outside 24h window" on `send-text`, `send-media`, or `send-message` is expected behavior enforced by `enforceWhatsApp24hWindow` (`backend/src/middleware/whatsapp24hGuard.js`) — direct the user to send a template instead of retrying the same call. See `docs/meta-tech-provider/TROUBLESHOOTING.md` under "Messages fail to send with 'outside 24h window.'"

## 9. Summary / Recap
"Free-form messages only work within 24 hours of the customer's last message. Outside that, templates are the answer — always keep a few approved templates ready for exactly this situation."

## 10. Call to Action & Related Resources
Continue to **07 — Shared Team Inbox and Conversation History**. Related reading: `docs/meta-tech-provider/TROUBLESHOOTING.md`, `docs/meta-tech-provider/SUPPORT_GUIDE.md`.
