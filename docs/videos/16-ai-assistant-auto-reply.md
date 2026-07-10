# 16 — AI Assistant Auto-Reply Setup

## 1. Title & Target Audience
**Title:** AI Assistant Auto-Reply Setup
**Audience:** New customer
**Estimated runtime:** 5-7 min

## 2. Learning Objective
After watching, a viewer can configure an AI-powered fallback auto-reply that uses Claude to answer customer questions when no keyword rule matches.

## 3. Prerequisites
- A connected WhatsApp number.
- The backend configured with an `ANTHROPIC_API_KEY` (an admin/engineering prerequisite — auto-reply rules can be created without it, but the AI assistant rule type won't generate replies until it's set).

## 4. Hook / Cold Open
"Keyword rules can't cover everything a customer might type. This is the AI Assistant fallback — a real, working auto-reply option, not a chatbot builder with a hundred settings."

## 5. On-Screen Setup
- Logged in on `/whatsapp` → Meta tab → Auto Reply sub-tab.
- At least one existing keyword rule already configured, to show fallback ordering.

## 6. Step-by-Step Walkthrough
1. **Narration:** "Auto Reply rules match on keywords by default — contains, exact, or starts-with. But there's a third rule type: AI Assistant, used as a fallback when nothing else matches."
   **On screen:** `AutoReplyManagementPanel.jsx` — open the "Add rule" form, show the Rule Type dropdown: Keyword Reply, Product Catalog / Price List, AI Assistant (fallback).
2. **Narration:** "Select AI Assistant. There's no keyword to set here — this only fires when no keyword or catalog rule matches the incoming message."
   **On screen:** Select "AI Assistant (fallback)"; the keyword field disappears.
3. **Narration:** "Set a system prompt to keep the assistant on-topic — for example, telling it what your business does and to keep replies short."
   **On screen:** Fill in the system prompt field.
4. **Narration:** "Save the rule, then send a message that doesn't match any of your keyword rules from a test phone."
   **On screen:** Send an off-script question from a second phone to the connected number.
5. **Narration:** "Behind the scenes, this calls Claude with your system prompt and the customer's message, and sends back a short, on-topic reply — capped at a few sentences by design."
   **On screen:** Watch the AI-generated reply arrive in the Chats inbox.
6. **Narration:** "If the model's safety classifier refuses to answer, or the API key isn't configured, no reply is sent at all rather than sending something broken — it fails silently and safely."
   **On screen:** Point at this behavior narratively (no visual needed).

## 7. Common Mistakes / Pitfalls
- Expecting the AI Assistant to fire for every message — it's strictly a fallback; any matching keyword or catalog rule takes priority.
- Leaving the system prompt too generic — a focused prompt about your specific business gets far more useful answers than a default one.
- Forgetting this depends on `ANTHROPIC_API_KEY` being configured on the backend — without it, the rule saves fine but silently produces no replies.

## 8. Troubleshooting Callout
If AI replies never arrive, first confirm a keyword or catalog rule isn't matching first and swallowing the message before it reaches the AI fallback — check `getAutoReplyRules` results and rule ordering. If no rule is intercepting it, this is an engineering-side check: confirm `ANTHROPIC_API_KEY` is actually set on the backend environment, since the service logs a warning and returns no reply rather than erroring when it's missing.

## 9. Summary / Recap
"The AI Assistant rule is a real fallback for the messages your keyword rules don't catch — scoped, on-topic, and safe by default when it can't or shouldn't answer."

## 10. Call to Action & Related Resources
Continue to **17 — Managing Multiple WhatsApp Numbers**. Related reading: `docs/api/SDK_EXAMPLES.md` for the underlying send mechanics this auto-reply uses to deliver its response.
