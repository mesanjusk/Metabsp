import { chromium } from 'playwright';

const baseUrl = process.env.LAUNCH_JOURNEY_BASE_URL || 'http://127.0.0.1:3100';

const services = [
  'whatsapp','rcs','instagram','google-business','lead-finder','dialer','crm','store',
  'institute','marketing','staff','video','payments'
];

const json = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });

async function waitForServer() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl + '/signup', { redirect: 'manual' });
      if (response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Next.js server did not become ready for the launch journey test.');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await waitForServer();
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const pageErrors = [];
    let profileCreated = false;
    let businessProfile = null;

    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const method = request.method();

      if (path === '/api/users/signup/request-otp' && method === 'POST') {
        return route.fulfill(json({ success: true, message: 'OTP sent for launch test.' }));
      }
      if (path === '/api/users/signup/verify' && method === 'POST') {
        return route.fulfill(json({
          success: true,
          token: 'launch-journey-token',
          user: {
            User_group: 'user',
            User_name: '919999999999',
            Display_name: 'Launch Tester',
            Mobile_number: '919999999999',
          },
        }));
      }
      if (path === '/api/users/me') {
        return route.fulfill(json({
          success: true,
          user: {
            User_group: 'user',
            User_name: '919999999999',
            Display_name: 'Launch Tester',
            Mobile_number: '919999999999',
          },
        }));
      }
      if (path === '/api/business-profile' && method === 'GET') {
        return route.fulfill(json({ success: true, data: profileCreated ? businessProfile : null }));
      }
      if (path === '/api/business-profile' && method === 'PUT') {
        profileCreated = true;
        const payload = JSON.parse(request.postData() || '{}');
        businessProfile = { ...payload, completedAt: new Date().toISOString() };
        return route.fulfill(json({ success: true, data: businessProfile }));
      }
      if (path === '/api/services/access') {
        return route.fulfill(json({ success: true, data: Object.fromEntries(services.map((service) => [service, { enabled: true }])) }));
      }
      if (path === '/api/services/overview') {
        return route.fulfill(json({ success: true, data: {
          kpis: { totalContacts: 0, newContacts7d: 0, messagesToday: 0, incomingToday: 0, outgoingToday: 0, activeChats: 0, availableTools: services.length, connectedChannels: 0 },
          deltas: {}, funnel: {}, activity: [], serviceHealth: []
        }}));
      }
      if (path === '/api/services/growth') return route.fulfill(json({ success: true, data: { summary: {}, agents: {}, recommendations: [] } }));
      if (path === '/api/founder/summary') return route.fulfill(json({ success: true, data: {} }));
      if (path === '/api/whatsapp/status') return route.fulfill(json({ success: true, data: { status: 'not_connected' } }));
      if (path === '/api/whatsapp/account' || path === '/api/whatsapp/accounts/active') return route.fulfill(json({ success: true, data: null }));
      if (path === '/api/whatsapp/accounts') return route.fulfill(json({ success: true, data: [] }));
      return route.fulfill(json({ success: true, data: [] }));
    });

    await page.goto(baseUrl + '/signup', { waitUntil: 'networkidle' });

    await page.getByLabel('WhatsApp mobile number').fill('9999999999');
    await page.getByLabel('Your name (optional)').fill('Launch Tester');
    await page.getByLabel('Password').fill('LaunchTest#2026');
    await page.getByRole('button', { name: /send otp/i }).click();

    await page.getByLabel('OTP').fill('123456');
    await page.getByRole('button', { name: /verify & create account/i }).click();

    await page.waitForURL(/\/setup\/business-profile|\/home/, { timeout: 10_000 });
    if (!page.url().includes('/setup/business-profile')) {
      await page.waitForURL(/\/setup\/business-profile/, { timeout: 10_000 });
    }

    await page.getByLabel('Business type').click();
    await page.getByRole('option', { name: 'Service business / Agency' }).click();
    await page.getByLabel('Business name (optional)').fill('Launch Test Business');

    await page.getByRole('button', { name: /create my workspace/i }).click();
    await page.waitForURL(/\/home/, { timeout: 10_000 });

    assert(await page.getByText('Business growth workspace', { exact: true }).count(), 'Home did not show the growth workspace after onboarding.');
    assert(await page.getByRole('link', { name: /open inbox/i }).count(), 'Home did not expose the primary inbox action.');
    assert(pageErrors.length === 0, `Browser errors at ${viewport.width}px: ${pageErrors.join(' | ')}`);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 1, `Launch journey overflows by ${overflow}px at ${viewport.width}px`);

    await context.close();
  }

  console.log('Launch journey passed on mobile and desktop: signup → OTP → business profile → growth workspace.');
} finally {
  await browser.close();
}
