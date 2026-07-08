# 10 — Sending Text and Template Messages

## 1. Title & Target Audience
**Title:** Sending Text and Template Messages
**Audience:** New customer (this doubles as a Meta App Review evidence recording for `whatsapp_business_messaging`)
**Estimated runtime:** 5-7 min

## 2. Learning Objective
After watching, a viewer can send both a free-form text message and a template message to a customer through the Cloud API.

## 3. Prerequisites
- A connected WhatsApp Cloud API number.
- At least one approved message template.
- A test recipient who has messaged the connected number recently (for the free-form example).

## 4. Hook / Cold Open
"Two ways to send a WhatsApp message here — free-form text, and templates. This video shows both, live, against a real connected number."

## 5. On-Screen Setup
- Logged in on `/whatsapp` → Meta tab → Chats.
- An existing conversation with a recent inbound message from the test recipient.

## 6. Step-by-Step Walkthrough
1. **Narration:** "For a customer who's messaged us within the last 24 hours, we can send plain text directly."
   **On screen:** Open the conversation, type into the message composer, and send (`POST /api/whatsapp/send-text`).
2. **Narration:** "That call goes straight to Meta's Messages API, and the message is saved and shown here immediately, along with delivery/read status as Meta reports it."
   **On screen:** Point out the sent message appearing in the thread with its status indicator.
3. **Narration:** "Now let's send a template — this works regardless of the 24-hour window, and needs to be pre-approved by Meta before it's usable."
   **On screen:** Switch to the Templates sub-tab, use `TemplateSelector`/`TemplateMessageComposer` to pick a template by name and language.
4. **Narration:** "Templates can include variables — here I'm filling in the placeholder fields the template defines."
   **On screen:** Fill in template parameter fields, matching the template's variable count.
5. **Narration:** "Send it, and it goes out the same way — through `send-template` on the backend, which doesn't require the 24-hour check that free-form sends do."
   **On screen:** Submit and show the sent template message in the conversation.
6. **Narration:** "Both paths land in the same conversation view, so your history stays complete regardless of which one you used."
   **On screen:** Show both the text and template messages together in the thread.

## 7. Common Mistakes / Pitfalls
- Trying to send free-form text to a customer who hasn't messaged in over 24 hours — use a template instead (see video 06).
- Sending a template with the wrong language code — templates are approved per-language; the exact name+language pair must match what Meta approved.
- Forgetting to fill in all of a template's required variables before sending.

## 8. Troubleshooting Callout
A failed template send with a Meta API error usually means either the template name/language pair doesn't exist or isn't approved yet, or a variable count mismatch — check the exact error message returned, which is passed through from Meta's Graph API rather than replaced with a generic message. See `docs/meta-tech-provider/TROUBLESHOOTING.md` for related token/permission failure modes.

## 9. Summary / Recap
"Free-form text for active conversations, templates for everything else — both send through the same Cloud API connection and land in the same conversation history."

## 10. Call to Action & Related Resources
Continue to **11 — Receiving Messages and Webhook Delivery**. Related reading: `docs/api/SDK_EXAMPLES.md`, `docs/meta-tech-provider/TROUBLESHOOTING.md`.
