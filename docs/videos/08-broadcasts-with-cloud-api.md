# 08 — Sending a Broadcast with the Cloud API

## 1. Title & Target Audience
**Title:** Sending a Broadcast with the Cloud API
**Audience:** New customer
**Estimated runtime:** 5-7 min

## 2. Learning Objective
After watching, a viewer can send a template broadcast to a list of recipients through the officially-supported Cloud API broadcast feature.

## 3. Prerequisites
- A connected WhatsApp Cloud API number.
- At least one approved message template.
- A list of recipient phone numbers with consent to receive messages.

## 4. Hook / Cold Open
"Need to reach a few hundred customers at once with an order update or a promo? This is the Cloud API broadcast feature — official, template-based, and durable if it gets interrupted mid-send."

## 5. On-Screen Setup
- Logged in on `/whatsapp` → Meta tab → Broadcast sub-tab.
- A CSV or short list of test recipient numbers ready to paste.
- An approved template already visible in the Templates sub-tab.

## 6. Step-by-Step Walkthrough
1. **Narration:** "This is the Broadcast tab under the Meta section — this is the officially-supported Cloud API path, distinct from the Baileys-based bulk sender under the Manual tab, which is a different, unofficial product."
   **On screen:** Point at the `Meta` main tab → `Broadcast` sub-tab specifically.
2. **Narration:** "Choose your message type — a template, since that's what lets you reach customers outside the 24-hour window — and pick the approved template."
   **On screen:** Select `messageType: template`, pick a template name and language.
3. **Narration:** "Add your recipients — a list of phone numbers, or pull them from your existing contacts."
   **On screen:** Paste/select recipients into the broadcast form (backing endpoint: `POST /api/whatsapp/broadcast`).
4. **Narration:** "Behind the scenes, each recipient becomes its own queued job with automatic retry — so even if something fails partway through, the whole batch doesn't just die; failed sends are visible individually."
   **On screen:** Submit and show the response summary: total, sent, failed counts.
5. **Narration:** "You get a per-recipient result, not just a single success/fail for the whole broadcast — useful for knowing exactly who needs a follow-up."
   **On screen:** Scroll through the `results` array in the UI, showing individual success/failure per recipient.

## 7. Common Mistakes / Pitfalls
- Sending free-form text broadcasts to a large list of contacts you haven't messaged recently — most will fail the 24-hour window check; templates are almost always the right choice for broadcasts.
- Duplicate phone numbers in the recipient list — the platform de-duplicates automatically, but don't rely on that to catch bad list hygiene generally.
- Confusing this with the "Campaigns" feature under the Manual/Baileys tab — that's a different, unofficial sending path with its own risk profile; don't mix the two up when troubleshooting.

## 8. Troubleshooting Callout
If a broadcast reports failures for specific recipients, check each failed result's error message individually — a common cause is an invalid or non-WhatsApp phone number in the list, not a platform-wide problem. For systemic broadcast failures, check `GET /health` first per `docs/meta-tech-provider/SUPPORT_GUIDE.md` — if the platform itself is degraded, individual broadcast troubleshooting is the wrong first step.

## 9. Summary / Recap
"Cloud API broadcasts send templates to many recipients at once, queued individually with retry, and report back per-recipient results — the right tool for reaching a list without waiting on the 24-hour window."

## 10. Call to Action & Related Resources
Continue to **09 — Connecting and Managing Additional WhatsApp Numbers**. Related reading: `docs/api/SDK_EXAMPLES.md`, `docs/meta-tech-provider/APP_REVIEW.md` (for why the Baileys-based Campaigns feature is treated differently).
