# 26 — App Review Evidence: Sending a Message (`whatsapp_business_messaging`)

## 1. Title & Target Audience
**Title:** Sending a WhatsApp message through the Cloud API
**Audience:** A Meta App Review reviewer. **Not** a customer.
**Estimated runtime:** 2–3 min

This is an evidence recording, not a product tour. It exists to prove one
permission and nothing else. Meta asks for a distinct screencast per
permission and explicitly disallows reusing one across several, so this video
must not be submitted for `whatsapp_business_management` as well — video 27
covers that.

Video 10 also demonstrates sending, but it is written for customers: it covers
both free-form and template sends, wanders into template selection, and
narrates product benefits. A reviewer checking one permission should not have
to find the relevant thirty seconds inside seven minutes.

## 2. Learning Objective
A reviewer watching this can confirm that the app sends a message to a real
WhatsApp number through Meta's Send API, and that the message genuinely
arrives.

## 3. Prerequisites
- A WhatsApp number connected to the app and active.
- A second, physical phone with WhatsApp installed, whose number is **not**
  the connected number. This is the proof of receipt and cannot be faked with
  a second browser tab.
- That phone has messaged the connected number within the last 24 hours, so a
  free-form send is permitted.
- Screen recording that can show the browser and the phone in the same frame,
  or cut cleanly between them.

## 4. Hook / Cold Open
No hook. Open with the URL bar showing `https://meta.sanjusk.in` and the
signed-in dashboard, so the reviewer sees this is the deployment named in the
submission.

## 5. On-Screen Setup
- Signed in at `https://meta.sanjusk.in`.
- **Workspace → Inbox**, with the conversation from the test phone open.
- The physical phone visible, unlocked, on that WhatsApp chat.

## 6. Step-by-Step Walkthrough
1. **Narration:** "This is the app at the URL given in our submission, signed in."
   **On screen:** URL bar, then the sidebar showing **Workspace → Inbox**.
2. **Narration:** "Here is a conversation with a customer who messaged this business."
   **On screen:** The open conversation, showing their inbound message and its timestamp.
3. **Narration:** "I'll type a message and send it."
   **On screen:** Type a short, plainly test-like message — include the date so it is
   unambiguous which send this is — and press send.
4. **Narration:** "The app calls Meta's Send API and the message appears in the thread."
   **On screen:** The sent message in the conversation.
5. **Narration:** "And here it is on the receiving phone."
   **On screen:** **Cut to the physical phone.** Show the message arriving in WhatsApp,
   with the same text. Hold long enough to read it. This is the shot the whole
   recording exists for.
6. **Narration:** "The delivery and read receipts come back over our webhook."
   **On screen:** Back to the browser; show the message's status indicator moving to
   delivered, then read.
7. **Narration:** "And a reply from the customer arrives in the same conversation."
   **On screen:** Reply from the phone, then show it appearing in the Inbox.

## 7. What to keep out of frame
Scope discipline matters more here than completeness. Do **not** show:

- Creating a message template — that is `whatsapp_business_management`, video 27.
- Connecting a number or the Embedded Signup popup.
- Broadcasts, automations, contacts, analytics, billing or the admin screens.

Every extra feature on screen is another thing a reviewer may ask about, and
none of it strengthens the case for this permission.

## 8. Troubleshooting Callout
If the free-form send is refused, the recipient has not messaged the business
within 24 hours and the guard is working correctly — have the phone send a
message first and re-record, rather than switching to a template. A template
send would prove a different thing and muddy the evidence.

## 9. Summary / Recap
"A message composed in the app, sent through the Cloud API, received on a real
phone, with delivery and read receipts returning over the webhook."

## 10. Call to Action & Related Resources
Pair with **27 — App Review Evidence: Creating a Message Template**. Written
justification for this permission is in
`docs/meta-tech-provider/APP_REVIEW_SUBMISSION_TEXT.md`.
