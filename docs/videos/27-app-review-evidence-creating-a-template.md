# 27 — App Review Evidence: Creating a Message Template (`whatsapp_business_management`)

## 1. Title & Target Audience
**Title:** Creating a WhatsApp message template
**Audience:** A Meta App Review reviewer. **Not** a customer.
**Estimated runtime:** 2–3 min

The second of the two evidence recordings. Meta asks for a distinct screencast
per permission and explicitly disallows reuse, so this must be a separate file
from video 26 even though both are recorded in the same app on the same day.

Meta's requirement for this permission is specific: show a message template
being **created**, through the Graph API or the app's own UI. Listing existing
templates is not enough on its own — creation is the act being authorised.

## 2. Learning Objective
A reviewer watching this can confirm the app both reads a business's existing
message templates and creates a new one against that business's WABA.

## 3. Prerequisites
- A WhatsApp number connected to the app, with its WABA reachable.
- At least one existing template, so the read path has something to show.
- A template name not already used on that WABA. Names must be unique per
  WABA, and a collision mid-recording forces a retake.

## 4. Hook / Cold Open
No hook. Open on the URL bar showing `https://meta.sanjusk.in`, signed in, so
the reviewer can see this is the deployment named in the submission and the
same one as video 26.

## 5. On-Screen Setup
- Signed in at `https://meta.sanjusk.in`.
- **Workspace → Templates**.

## 6. Step-by-Step Walkthrough
1. **Narration:** "Same app, same deployment as the previous recording, signed in."
   **On screen:** URL bar, then the sidebar showing **Workspace → Templates**.
2. **Narration:** "These are the message templates on the connected business's WhatsApp
   Business Account, read from Meta."
   **On screen:** The template list, with names, languages and approval statuses
   visible. Pause here — this is the read half of the permission.
3. **Narration:** "Now I'll create a new one."
   **On screen:** Start the create-template flow.
4. **Narration:** "A template needs a name, a language, a category, and its body text."
   **On screen:** Fill each field deliberately, slowly enough to read. Use a name that
   is obviously a test and includes the date.
5. **Narration:** "Variables in the body are the placeholders the business fills in when
   sending."
   **On screen:** Include at least one `{{1}}` placeholder, so the reviewer sees the app
   handles parameterised templates rather than only static text.
6. **Narration:** "Submitting sends it to Meta for approval."
   **On screen:** Submit. Show the confirmation.
7. **Narration:** "And it appears in the list, pending Meta's review."
   **On screen:** The new template in the list with its pending status. Hold long
   enough that the name and status are both readable.

If approval comes through while you still have the recording open, a short
final shot of the status changing to approved is worth including. Do not wait
on it — pending is sufficient proof that creation worked.

## 7. What to keep out of frame
Do **not** show:

- Sending a message — that is `whatsapp_business_messaging`, video 26.
- Connecting a number, the Embedded Signup popup, or manual connect.
- Broadcasts, automations, contacts, analytics, billing or the admin screens.

## 8. Troubleshooting Callout
A rejected create usually means the name is already taken on that WABA, the
category does not match the body content, or the variable numbering is not
sequential from `{{1}}`. The error passed back is Meta's own, not a generic
one, so read it directly. `docs/videos/24-template-rejection-reasons.md`
covers the content-policy reasons a template gets rejected *after* submission,
which is a different failure from a create that never lands.

## 9. Summary / Recap
"Existing templates read from the business's WABA, a new template created in
the app, submitted to Meta, and listed as pending."

## 10. Call to Action & Related Resources
Pair with **26 — App Review Evidence: Sending a Message**. Written
justification for this permission is in
`docs/meta-tech-provider/APP_REVIEW_SUBMISSION_TEXT.md`.
