# 24 — Template Rejection Reasons

## 1. Title & Target Audience
**Title:** Template Rejection Reasons
**Audience:** New customer / support staff
**Estimated runtime:** 3-5 min

## 2. Learning Objective
After watching, a viewer understands that template approval is entirely Meta's decision, where to see a template's current status, and where to find the actual rejection reason.

## 3. Prerequisites
- A connected WhatsApp number with at least one submitted template.

## 4. Hook / Cold Open
"Submitted a template and it came back rejected? That decision is made entirely by Meta, not by this platform — here's where to actually see why."

## 5. On-Screen Setup
- Logged in on `/whatsapp` → Meta tab → Templates sub-tab.
- Meta Business Manager's WhatsApp Manager open in a second tab, showing the same WABA's template list.

## 6. Step-by-Step Walkthrough
1. **Narration:** "The Templates tab here pulls the template list live, straight from Meta's Graph API — it's not a separate list this platform maintains."
   **On screen:** `getTemplates` result shown in the Templates sub-tab; point out this reflects Meta's data directly, in real time.
2. **Narration:** "That means approval, rejection, and the specific reason for a rejection are entirely Meta's decision — this platform has no template-review logic of its own."
   **On screen:** Point at a template's status as reported by Meta.
3. **Narration:** "For the exact rejection reason text, go to Meta Business Manager's WhatsApp Manager, where Meta shows the specific policy category that was violated."
   **On screen:** Switch to WhatsApp Manager, find the same rejected template, show its rejection detail.
4. **Narration:** "Common categories worth knowing before you submit: marketing language inside a utility-category template, a generic greeting with no clear business purpose, or a template that's just placeholder variables with no real surrounding text."
   **On screen:** Narrate over example template text illustrating each category (can be a slide, not necessarily a real submission).
5. **Narration:** "If a template is rejected, the fix is to edit and resubmit it in Meta Business Manager — there's nothing to do inside this platform except wait for the updated status to reflect here."

## 7. Common Mistakes / Pitfalls
- Contacting support expecting the platform to explain or override a rejection — the reason and the decision both live entirely on Meta's side.
- Resubmitting a rejected template with the same wording, expecting a different outcome.
- Forgetting that a template is approved per name+language pair — fixing the English version doesn't affect a rejected translation of the same template.

## 8. Troubleshooting Callout
If a template shows as rejected here but the Templates tab seems out of date, remember this list reflects whatever Meta's Graph API returns at the moment you load the tab — refresh the tab rather than assuming this platform is caching a stale status. For anything beyond the status itself, WhatsApp Manager in Meta Business Manager is the source of truth. See `docs/meta-tech-provider/REQUIRED_PERMISSIONS.md` for how template access ties to the `whatsapp_business_management` permission.

## 9. Summary / Recap
"This platform shows you Meta's real template status live — but the rejection reason and the fix both live in Meta Business Manager, not here."

## 10. Call to Action & Related Resources
Continue to **25 — Where to Find Logs and Health Status**. Related reading: `docs/meta-tech-provider/REQUIRED_PERMISSIONS.md`, `docs/meta-tech-provider/TROUBLESHOOTING.md`.
