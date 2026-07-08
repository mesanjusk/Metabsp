# 12 — Managing Contacts and Imports

## 1. Title & Target Audience
**Title:** Managing Contacts and Imports
**Audience:** New customer
**Estimated runtime:** 5-7 min

## 2. Learning Objective
After watching, a viewer can add, tag, categorize, and bulk-import contacts into the CRM panel for use in messaging and broadcasts.

## 3. Prerequisites
- A Metabsp account with a connected WhatsApp number.
- A spreadsheet (CSV/XLSX) of contacts to import, if demonstrating the import flow.

## 4. Hook / Cold Open
"Your customer list lives here too — not just your chat history. Here's how to organize contacts so broadcasts and follow-ups are easy to target."

## 5. On-Screen Setup
- Logged in on `/whatsapp` → CRM tab.
- A sample spreadsheet with columns like name, phone, email, category, tags ready to import.

## 6. Step-by-Step Walkthrough
1. **Narration:** "The CRM tab is your contact list — name, phone, email, city, company, category, tags, and notes, all searchable."
   **On screen:** `CRMPanel.jsx` showing the contact table/grid.
2. **Narration:** "Add a contact manually with the plus button."
   **On screen:** Fill the contact form (name, phone, email, category, tags, etc.) and save (`POST /api/whatsapp/contacts`).
3. **Narration:** "For a whole list at once, use Import — upload a spreadsheet, and the app tries to auto-match your column headers to fields like phone, category, or tags."
   **On screen:** Click the import button, upload a spreadsheet, review the column-mapping preview.
4. **Narration:** "Confirm the mapping and import — you'll get a result summary of how many contacts were added."
   **On screen:** Complete `POST /api/whatsapp/contacts/import`, show the import result.
5. **Narration:** "Use categories and tags to segment your list — for example, moving a group of selected contacts into a category in bulk."
   **On screen:** Select multiple contacts via checkboxes, use the bulk category-move action (`PATCH /api/whatsapp/contacts/bulk`).
6. **Narration:** "These same contacts are exactly what you'd pull into a broadcast recipient list."
   **On screen:** Point back at the Broadcast tab as where this list gets used (covered in video 08).

## 7. Common Mistakes / Pitfalls
- Importing a spreadsheet with phone numbers in inconsistent formats — normalize numbers (country code included) before import where possible.
- Assuming a bulk contact import triggers your outbound webhook destinations per-row — it deliberately doesn't, to avoid spamming a destination during a large import; poll the Contacts API instead if you need to sync a bulk import externally.
- Forgetting that deleting a contact here doesn't delete their message history.

## 8. Troubleshooting Callout
If an import silently skips rows, check the column-mapping preview before confirming — a header the platform can't automatically match to phone/name/category needs to be mapped manually, otherwise that column's data won't be captured on import. For bulk-sync needs with your own external system, see `docs/api/WEBHOOKS.md`'s note on why bulk imports don't fan out one event per row, and use `GET /api/whatsapp/contacts` to poll instead.

## 9. Summary / Recap
"Contacts, categories, tags, and bulk import all live in the CRM tab — the same list that powers broadcast recipients and shows up automatically as customers message you."

## 10. Call to Action & Related Resources
Continue to **13 — System User Tokens for Long-Lived Access**. Related reading: `docs/api/WEBHOOKS.md`, `docs/api/SDK_EXAMPLES.md`.
