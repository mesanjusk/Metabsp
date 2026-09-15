export const ROUTES = {
  ROOT: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  FORGOT_PASSWORD: '/forgot-password',
  HOME: '/home',
  // Successful sign-in lands on the service hub first. From there the user
  // deliberately enters WhatsApp, Instagram, Dialer, CRM, etc.
  DASHBOARD: '/home',
  // The service's overview, not its inbox. Every other service tile opens a
  // screen that says how the service is doing; WhatsApp's used to open the
  // inbox, which made the busiest channel the only one with no front page.
  WHATSAPP: '/whatsapp',
  WHATSAPP_INBOX: '/inbox',
  INSTAGRAM: '/instagram',
};
