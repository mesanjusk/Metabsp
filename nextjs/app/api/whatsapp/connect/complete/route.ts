// Express mounts completeEmbeddedSignup at BOTH POST /connect/complete and
// POST /embedded-signup/exchange-code (see backend/src/routes/WhatsAppCloud.js:
// `completeConnection: completeEmbeddedSignup`). The frontend calls the
// /connect/complete alias, so re-export rather than duplicate the handler —
// two copies of an OAuth code exchange would drift.
export { POST } from '../../embedded-signup/exchange-code/route';
