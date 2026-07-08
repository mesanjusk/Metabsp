// Hand-written OpenAPI 3.0 spec for the core Tech Provider (BSP) API surface.
// Scope: the External API (api-key auth, /api/v1) in full, plus the primary
// WhatsApp Cloud endpoints a tenant/integrator actually needs (accounts,
// messaging, contacts, auto-reply, workflows, team, billing). Internal/admin
// routes and the Bulk (Baileys dashboard) CRUD routes are intentionally out
// of scope here — this documents the API a third-party integrator or
// tenant-facing frontend calls, not every internal route in the monorepo.

const successEnvelope = (dataSchema) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: dataSchema,
  },
});

const errorEnvelope = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string', example: 'Something went wrong' },
  },
};

const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Metabsp WhatsApp Tech Provider API',
    version: '1.0.0',
    description:
      'Core REST API for the Metabsp WhatsApp Business Solution Provider platform: ' +
      'Meta WhatsApp Cloud API account management, messaging, contacts, ' +
      'auto-reply/workflow automation, shared team inbox, and UPI-based billing. ' +
      'A separate API-key-authenticated External API (/api/v1) is also documented ' +
      'here for third-party integrations sending messages through a connected number.',
  },
  servers: [{ url: '/', description: 'Current environment' }],
  tags: [
    { name: 'External API', description: 'API-key authenticated, no login session required' },
    { name: 'Accounts', description: 'Connecting and managing WhatsApp Cloud numbers' },
    { name: 'Messaging', description: 'Sending messages and broadcasts' },
    { name: 'Contacts', description: 'Contact/address-book management (also the CRM sync source)' },
    { name: 'Auto Reply', description: 'Keyword, catalog, and AI-assistant auto-reply rules' },
    { name: 'Workflows', description: 'Multi-step, keyword-triggered message sequences' },
    { name: 'Team Inbox', description: 'Sharing an account with other users and assigning conversations' },
    { name: 'Billing', description: 'Subscription plans, UPI Autopay, and invoices' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      apiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-Api-Key' },
    },
    schemas: {
      Error: errorEnvelope,
      WhatsAppAccount: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          phoneNumberId: { type: 'string' },
          displayPhoneNumber: { type: 'string' },
          verifiedName: { type: 'string' },
          wabaId: { type: 'string' },
          status: { type: 'string', enum: ['active', 'disconnected', 'error', 'pending'] },
          isActive: { type: 'boolean' },
          connectionMode: { type: 'string', enum: ['embedded_signup', 'manual', 'legacy_env'] },
        },
      },
      Contact: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          phone: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          category: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          assignedAgent: { type: 'string' },
        },
      },
      AutoReplyRule: {
        type: 'object',
        required: ['keyword'],
        properties: {
          ruleType: { type: 'string', enum: ['keyword', 'product_catalog', 'ai_assistant'] },
          keyword: { type: 'string' },
          matchType: { type: 'string', enum: ['exact', 'contains', 'starts_with'] },
          replyType: { type: 'string', enum: ['text', 'template'] },
          reply: { type: 'string' },
          templateLanguage: { type: 'string' },
          aiSystemPrompt: { type: 'string' },
          aiModel: { type: 'string' },
          isActive: { type: 'boolean' },
          delaySeconds: { type: 'number' },
        },
      },
      WorkflowStep: {
        type: 'object',
        required: ['reply'],
        properties: {
          delaySeconds: { type: 'number', minimum: 0, maximum: 3600 },
          replyType: { type: 'string', enum: ['text', 'template'] },
          reply: { type: 'string' },
          templateLanguage: { type: 'string' },
        },
      },
      Workflow: {
        type: 'object',
        required: ['name', 'keyword', 'steps'],
        properties: {
          name: { type: 'string' },
          keyword: { type: 'string' },
          matchType: { type: 'string', enum: ['exact', 'contains', 'starts_with'] },
          isActive: { type: 'boolean' },
          steps: { type: 'array', items: { $ref: '#/components/schemas/WorkflowStep' }, minItems: 1, maxItems: 10 },
        },
      },
      SubscriptionPlan: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          name: { type: 'string' },
          priceInPaise: { type: 'integer' },
          includedMessages: { type: 'integer' },
          overagePricePerMessageInPaise: { type: 'integer' },
        },
      },
      Invoice: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'pending', 'paid', 'failed'] },
          totalInPaise: { type: 'integer' },
          periodStart: { type: 'string', format: 'date-time' },
          periodEnd: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Liveness/readiness check',
        responses: { 200: { description: 'Service and DB are up' }, 503: { description: 'DB not connected' } },
      },
    },

    // ── External API v1 ──────────────────────────────────────────────────
    '/api/v1/baileys/status': {
      get: {
        tags: ['External API'],
        summary: 'Get the connected WhatsApp session status for this API key\'s owner',
        security: [{ apiKeyAuth: [] }],
        responses: { 200: { description: 'Connection status' } },
      },
    },
    '/api/v1/baileys/send': {
      post: {
        tags: ['External API'],
        summary: 'Send a text message, or an image with caption if imageUrl is provided',
        security: [{ apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['to', 'message'],
                properties: { to: { type: 'string', example: '919876543210' }, message: { type: 'string' }, imageUrl: { type: 'string' } },
              },
            },
          },
        },
        responses: { 200: { description: 'Sent' }, 400: { description: 'Missing to/message' } },
      },
    },
    '/api/v1/baileys/send-bulk': {
      post: {
        tags: ['External API'],
        summary: 'Send to up to 500 recipients with a delay between sends (processed in background)',
        security: [{ apiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['recipients'],
                properties: {
                  recipients: {
                    type: 'array',
                    maxItems: 500,
                    items: {
                      type: 'object',
                      properties: { to: { type: 'string' }, message: { type: 'string' }, imageUrl: { type: 'string' } },
                    },
                  },
                  delay: { type: 'integer', description: 'ms between sends, 5000-60000', default: 12000 },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Bulk send accepted and started' } },
      },
    },

    // ── Accounts ──────────────────────────────────────────────────────────
    '/api/whatsapp/accounts': {
      get: {
        tags: ['Accounts'],
        summary: 'List every WhatsApp number connected to the current user',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: successEnvelope({ type: 'array', items: { $ref: '#/components/schemas/WhatsAppAccount' } }) } } } },
      },
    },
    '/api/whatsapp/accounts/{id}/activate': {
      post: {
        tags: ['Accounts'],
        summary: 'Switch the active WhatsApp number for the current user',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Activated' }, 404: { description: 'Not found' } },
      },
    },
    '/api/whatsapp/connect/complete': {
      post: {
        tags: ['Accounts'],
        summary: 'Complete Meta Embedded Signup — exchanges the OAuth code for a long-lived token and activates the account',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['code'], properties: { code: { type: 'string' }, wabaId: { type: 'string' }, phoneNumberId: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Connected' } },
      },
    },
    '/api/whatsapp/connect/manual': {
      post: {
        tags: ['Accounts'],
        summary: 'Connect a WhatsApp number manually with an access token (validated against the Graph API before saving)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['accessToken', 'phoneNumberId'],
                properties: { accessToken: { type: 'string' }, phoneNumberId: { type: 'string' }, wabaId: { type: 'string' } },
              },
            },
          },
        },
        responses: { 200: { description: 'Connected' }, 400: { description: 'Invalid credentials' } },
      },
    },
    '/api/whatsapp/account/{id}/disconnect': {
      post: {
        tags: ['Accounts'],
        summary: 'Disconnect a WhatsApp account (releases the phone number so it can be reconnected)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Disconnected' } },
      },
    },

    // ── Messaging ─────────────────────────────────────────────────────────
    '/api/whatsapp/send-text': {
      post: {
        tags: ['Messaging'],
        summary: 'Send a free-form text message (requires an open 24h customer service window)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['to', 'body'], properties: { to: { type: 'string' }, body: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Sent' }, 400: { description: '24h window closed / validation error' } },
      },
    },
    '/api/whatsapp/send-template': {
      post: {
        tags: ['Messaging'],
        summary: 'Send an approved WhatsApp message template (works outside the 24h window)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['to', 'templateName', 'language'], properties: { to: { type: 'string' }, templateName: { type: 'string' }, language: { type: 'string' }, components: { type: 'array', items: {} } } } } },
        },
        responses: { 200: { description: 'Sent' } },
      },
    },
    '/api/whatsapp/broadcast': {
      post: {
        tags: ['Messaging'],
        summary: 'Send a template broadcast to many recipients (queued via BullMQ, response waits for completion)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['recipients', 'templateName', 'language'],
                properties: {
                  recipients: { type: 'array', items: { type: 'string' } },
                  templateName: { type: 'string' },
                  language: { type: 'string' },
                  components: { type: 'array', items: {} },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Broadcast completed', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, campaignId: { type: 'string' }, total: { type: 'integer' }, sent: { type: 'integer' }, failed: { type: 'integer' } } } } } } },
      },
    },
    '/api/whatsapp/conversations': {
      get: {
        tags: ['Messaging'],
        summary: 'List conversations for the current account, optionally filtered by assignment',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'assignedTo', in: 'query', schema: { type: 'string', enum: ['me', 'unassigned'] }, description: 'Or pass a specific userId' }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/whatsapp/conversations/{phone}/assign': {
      put: {
        tags: ['Team Inbox'],
        summary: 'Assign (or unassign) a conversation to an account owner or team member',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'phone', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { userId: { type: 'string', nullable: true } } } } } },
        responses: { 200: { description: 'Assigned' }, 400: { description: 'Not the owner or a team member' } },
      },
    },

    // ── Contacts ──────────────────────────────────────────────────────────
    '/api/whatsapp/contacts': {
      get: {
        tags: ['Contacts'],
        summary: 'List/search contacts',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'tag', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: successEnvelope({ type: 'array', items: { $ref: '#/components/schemas/Contact' } }) } } } },
      },
      post: {
        tags: ['Contacts'],
        summary: 'Create or upsert a contact by phone number. Fires a contact.upserted webhook event to registered destinations',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Contact' } } } },
        responses: { 201: { description: 'Created' } },
      },
    },
    '/api/whatsapp/contacts/{id}': {
      put: {
        tags: ['Contacts'],
        summary: 'Update a contact. Fires a contact.upserted webhook event',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Contact' } } } },
        responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
      },
      delete: {
        tags: ['Contacts'],
        summary: 'Delete a contact. Fires a contact.deleted webhook event',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted' }, 404: { description: 'Not found' } },
      },
    },

    // ── Auto Reply ────────────────────────────────────────────────────────
    '/api/whatsapp/auto-reply': {
      get: {
        tags: ['Auto Reply'],
        summary: 'List auto-reply rules for the current account',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'OK' } },
      },
      post: {
        tags: ['Auto Reply'],
        summary: 'Create an auto-reply rule (keyword, product_catalog, or ai_assistant)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AutoReplyRule' } } } },
        responses: { 201: { description: 'Created' } },
      },
    },
    '/api/whatsapp/auto-reply/{id}/toggle': {
      patch: {
        tags: ['Auto Reply'],
        summary: 'Toggle a rule active/inactive',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Toggled' } },
      },
    },

    // ── Workflows ─────────────────────────────────────────────────────────
    '/api/whatsapp/workflows': {
      get: {
        tags: ['Workflows'],
        summary: 'List workflows for the current account',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'OK' } },
      },
      post: {
        tags: ['Workflows'],
        summary: 'Create a keyword-triggered, multi-step workflow (runs instead of any matching Auto Reply rule)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Workflow' } } } },
        responses: { 201: { description: 'Created' }, 400: { description: 'Missing name/keyword/steps' } },
      },
    },
    '/api/whatsapp/workflows/{id}/toggle': {
      patch: {
        tags: ['Workflows'],
        summary: 'Toggle a workflow active/inactive',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Toggled' } },
      },
    },

    // ── Team Inbox ────────────────────────────────────────────────────────
    '/api/whatsapp/accounts/{id}/team-members': {
      get: {
        tags: ['Team Inbox'],
        summary: 'List team members with access to this account',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } },
      },
      post: {
        tags: ['Team Inbox'],
        summary: 'Add a platform user (looked up by mobile number) as a team member — owner-only',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['mobile'], properties: { mobile: { type: 'string' } } } } } },
        responses: { 201: { description: 'Added' }, 404: { description: 'Account or user not found' } },
      },
    },
    '/api/whatsapp/accounts/{id}/team-members/{memberId}': {
      delete: {
        tags: ['Team Inbox'],
        summary: 'Remove a team member — owner-only',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'memberId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Removed' } },
      },
    },

    // ── Billing ───────────────────────────────────────────────────────────
    '/api/billing/plans': {
      get: {
        tags: ['Billing'],
        summary: 'List available subscription plans',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: successEnvelope({ type: 'array', items: { $ref: '#/components/schemas/SubscriptionPlan' } }) } } } },
      },
    },
    '/api/billing/subscription': {
      get: {
        tags: ['Billing'],
        summary: "Get the current tenant's active subscription",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/billing/subscribe': {
      post: {
        tags: ['Billing'],
        summary: 'Start a UPI Autopay subscription for a plan (Cashfree) — returns an authorizationLink to complete UPI mandate setup',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['planCode'], properties: { planCode: { type: 'string' } } } } } },
        responses: { 200: { description: 'Subscription created, awaiting UPI mandate authorization' } },
      },
    },
    '/api/billing/invoices': {
      get: {
        tags: ['Billing'],
        summary: 'List invoices for the current tenant',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: successEnvelope({ type: 'array', items: { $ref: '#/components/schemas/Invoice' } }) } } } },
      },
    },
    '/api/billing/invoices/{id}/pdf': {
      get: {
        tags: ['Billing'],
        summary: 'Download an invoice as a PDF',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'PDF file', content: { 'application/pdf': {} } } },
      },
    },
  },
};

module.exports = openapiSpec;
