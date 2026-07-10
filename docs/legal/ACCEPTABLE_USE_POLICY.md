> **This is a template, not legal advice.** These documents describe this codebase's actual technical mechanisms where cited, but must be reviewed and finalized by a licensed attorney familiar with your jurisdiction and business before use. Bracketed placeholders must be completed before publishing externally.

# Acceptable Use Policy (AUP)

**Effective date:** [EFFECTIVE DATE]

This Acceptable Use Policy governs how Customer and its authorized users may use the Metabsp platform (the "Service") and is incorporated by reference into the [Terms of Service](./TERMS_OF_SERVICE.md). Because Metabsp operates as a WhatsApp Business Solution Provider on top of Meta's WhatsApp Cloud API, this policy is intentionally stricter than a generic SaaS AUP: violations here can jeopardize not only Customer's own WhatsApp Business Account standing but the messaging quality rating and platform access of every other Customer sharing the underlying Meta Tech Provider relationship.

## 1. Consent and opt-in requirements

Customer must not use the Service to message any phone number without a valid, documented opt-in consistent with WhatsApp's Business Messaging Policy. Specifically, Customer must not:

- Send bulk or unsolicited messages to contacts who have not affirmatively opted in to receive messages from Customer's specific business.
- Purchase, scrape, or otherwise acquire contact lists from third parties without verifying that each contact has consented to be messaged by Customer.
- Continue messaging a contact who has opted out, unsubscribed, or otherwise indicated they do not wish to receive further messages.
- Use the Service to message personal/non-business WhatsApp numbers for cold outreach in a manner inconsistent with Meta's opt-in requirements.

## 2. Compliance with Meta's WhatsApp and Commerce policies

Customer must at all times comply with:

- Meta's **WhatsApp Business Messaging Policy** (message categories, template usage rules, session-messaging windows).
- Meta's **WhatsApp Business Policy**.
- Meta's **Commerce Policies**, where Customer uses commerce/catalog features.

as each is amended by Meta from time to time. Metabsp does not control and cannot override Meta's enforcement of these policies against a given WhatsApp Business Account.

## 3. Prohibited content

Customer must not use the Service to send, request, or facilitate messages containing:

- Spam, chain messages, or unsolicited bulk messaging outside a verified opt-in relationship.
- Fraudulent, deceptive, or misleading content, including phishing attempts or impersonation of another person, business, or Meta itself.
- Illegal content, or content facilitating illegal activity, under applicable law.
- Content that infringes a third party's intellectual property rights.
- Malware, malicious links, or content designed to compromise a recipient's device or account.
- Hate speech, harassment, or content that threatens or promotes violence against individuals or groups.
- Sexually explicit content or content sexualizing minors.
- Content promoting self-harm.
- Content facilitating the sale of counterfeit goods, weapons, illicit drugs, or other items prohibited under Meta's Commerce Policies.

## 4. Prohibited industries and use cases

Consistent with Meta's own restrictions on regulated and high-risk categories, Customer must not use the Service on behalf of, or to message contacts regarding, any of the following unless Customer holds all applicable licenses and Meta itself permits the category for WhatsApp Business messaging:

- Unlicensed gambling, betting, or lottery services.
- Illegal or unlicensed pharmaceuticals, controlled substances, or drug paraphernalia.
- Multi-level marketing schemes or other deceptive financial schemes.
- Payday/predatory lending or other prohibited financial products.
- Weapons, ammunition, or explosives sales.
- Adult content or services.
- Counterfeit goods.
- Any other business vertical Meta designates as restricted or prohibited for WhatsApp Business use from time to time.

[COMPANY TO REVIEW AGAINST THE CURRENT VERSION OF META'S RESTRICTED/PROHIBITED INDUSTRY LISTS BEFORE PUBLISHING, AS THESE CHANGE OVER TIME.]

## 5. Platform and security misuse

Customer (and its users) must not:

- Share, sell, or sublicense API keys or account credentials outside Customer's own organization.
- Attempt to circumvent rate limits, authentication, or webhook signature verification.
- Probe, scan, or test the vulnerability of the Service without prior written authorization (see the [Security Policy](./SECURITY_POLICY.md)'s responsible-disclosure section for the correct channel).
- Access or attempt to access another tenant's data, contacts, or message history.
- Use the Service in a way that places excessive, abnormal load on shared infrastructure to the detriment of other Customers.

## 6. Consequences of violation

Violations of this policy may result in one or more of the following, at our discretion and proportional to the severity and recurrence of the violation:

- A warning and requirement to remediate within a specified period.
- Temporary suspension of the affected feature, WhatsApp Business Account connection, or user account — reflected in the platform via the account/connection being marked inactive (the `isActive`/`status` state tracked on user, organization, and WhatsApp Business Account records) so that messaging and API access stop immediately without necessarily deleting underlying data.
- Termination of Customer's account and all associated API keys, consistent with Section 6 of the [Terms of Service](./TERMS_OF_SERVICE.md).
- Reporting to Meta or law enforcement where required or appropriate, particularly for content or conduct that risks other Customers' shared standing as part of the same Meta Tech Provider relationship.
- In serious cases, immediate suspension without prior warning, particularly where continued access poses a security risk or a risk to Metabsp's own standing with Meta.

Customer acknowledges that Meta may independently restrict or disable a WhatsApp Business Account for policy violations regardless of any action taken (or not taken) by Metabsp, and that such Meta-side action is outside Metabsp's control.

## 7. Reporting abuse

To report suspected abuse of the Service (e.g., spam originating from a Metabsp-connected number, or suspected policy violations by a Customer), contact:

- **Abuse/Trust & Safety contact:** [ABUSE REPORT CONTACT EMAIL]

Please include the phone number, WhatsApp Business Account, or account identifier involved, and any message content or headers that support the report.

## 8. Changes to this policy

We may update this Acceptable Use Policy from time to time, including to reflect changes in Meta's own policies. Material changes will be notified via [NOTIFICATION METHOD] and reflected in the "Effective date" above.
