import { chromium } from 'playwright';

const baseUrl = process.env.MOBILE_SMOKE_BASE_URL || 'http://localhost:3100';
const widths = [320, 375, 390];
const protectedRoutes = [
  '/home',
  '/whatsapp',
  '/inbox',
  '/templates',
  '/broadcasts',
  '/automations',
  '/analytics',
  '/numbers',
  '/contacts',
  '/business',
  '/developers',
  '/instagram',
  '/services/rcs',
  '/services/google-business',
  '/services/google-business/reviews',
  '/services/google-business/posts',
  '/services/google-business/review-requests',
  '/services/lead-finder',
  '/services/dialer',
  '/services/crm',
  '/services/crm/board',
  '/services/store',
  '/services/store/products',
  '/services/store/categories',
  '/services/store/inquiries',
  '/services/store/settings',
  '/services/institute',
  '/services/institute/forms',
  '/services/institute/fees',
  '/services/institute/id-card',
  '/services/institute/add-admission',
  '/services/marketing',
  '/services/staff',
  '/services/staff/attendance',
  '/services/staff/my-day',
  '/services/video',
  '/services/video/new',
  '/services/video/accounts',
  '/services/payments',
  '/services/payments/documents',
  '/services/payments/ledger',
  '/services/payments/reports',
  '/settings',
  '/setup/business-profile',
];
const publicRoutes = [
  '/',
  '/login',
  '/signup',
  '/about',
  '/contact',
  '/help-center',
  '/privacy-policy',
  '/terms-of-service',
  '/security-info',
  '/cookie-policy',
  '/data-deletion',
];

const services = [
  'whatsapp','rcs','instagram','google-business','lead-finder','dialer','crm','store',
  'institute','marketing','staff','video','payments'
];

const json = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });

function mockedApi(url) {
  const path = new URL(url).pathname;

  if (path === '/api/users/me') {
    return json({ success: true, user: { User_group: 'user', User_name: 'Launch Tester', Display_name: 'Launch Tester', Mobile_number: '919999999999' } });
  }
  if (path === '/api/business-profile') {
    return json({ success: true, data: { businessType: 'services_agency', businessName: 'Mobile Test Business', teamSize: '2-5', selectedServices: services } });
  }
  if (path === '/api/services/access') {
    return json({ success: true, data: Object.fromEntries(services.map((service) => [service, { enabled: true, reason: 'Launch smoke test' }])) });
  }
  if (path === '/api/services/overview') {
    return json({ success: true, data: {
      kpis: { totalContacts: 12, newContacts7d: 3, messagesToday: 8, incomingToday: 5, outgoingToday: 3, activeChats: 2, availableTools: services.length, connectedChannels: 0 },
      deltas: {}, funnel: { new: 3, interested: 2, followUp: 2, quotation: 1, converted: 3, lost: 1 }, activity: [], serviceHealth: []
    }});
  }
  if (path === '/api/services/growth') {
    return json({ success: true, data: { summary: {}, agents: {}, recommendations: [] } });
  }
  if (path === '/api/founder/summary') return json({ success: true, data: {} });
  if (path === '/api/smb/summary') {
    return json({ success: true, data: { recent: [], aging: {}, leadsOpen: 0, followupsDue: 0, quotationsOpen: 0, openOrders: 0 } });
  }
  if (path === '/api/whatsapp/status') return json({ success: true, data: { status: 'not_connected' } });
  if (path === '/api/whatsapp/account' || path === '/api/whatsapp/accounts/active') return json({ success: true, data: null });
  if (path === '/api/whatsapp/accounts') return json({ success: true, data: [] });
  if (path === '/api/whatsapp/connect/config') return json({ success: true, data: {} });
  if (path === '/api/institute/forms') return json({ success: true, data: [] });
  if (path.includes('/api/institute/idcards/projects')) return json({ success: true, data: [] });
  if (path === '/api/store/products' || path === '/api/store/categories' || path === '/api/store/inquiries') return json({ success: true, data: [] });
  if (path === '/api/store/profile') return json({ success: true, data: { name: 'Test Store', slug: 'test-store', currency: 'INR' } });
  if (path === '/api/admin/privacy/deletion-requests') return json({ success: true, data: [] });

  // Launch smoke is testing browser layout and route stability, not provider
  // correctness. An empty collection is the safest generic load-state payload:
  // list screens can iterate it, while object-style property reads simply get
  // undefined and render their empty states.
  return json({ success: true, data: [] });
}

async function waitForServer() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl + '/login', { redirect: 'manual' });
      if (response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Next.js server did not become ready for the mobile smoke test.');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertNoViewportOverflow(page, route, width, suffix = '') {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyWidth: document.body.scrollWidth,
    mainWidth: document.querySelector('main')?.scrollWidth || 0,
    mainClientWidth: document.querySelector('main')?.clientWidth || 0,
  }));
  const label = suffix ? `${route} ${suffix}` : route;
  assert(metrics.scrollWidth <= metrics.clientWidth + 1, `${label} overflows root at ${width}px: ${metrics.scrollWidth}px > ${metrics.clientWidth}px`);
  assert(metrics.bodyWidth <= metrics.clientWidth + 1, `${label} overflows body at ${width}px`);
  if (metrics.mainClientWidth) {
    assert(metrics.mainWidth <= metrics.mainClientWidth + 1, `${label} overflows main at ${width}px: ${metrics.mainWidth}px > ${metrics.mainClientWidth}px`);
  }
}

await waitForServer();
const browser = await chromium.launch({ headless: true });

try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.route('**/api/**', async (route) => route.fulfill(mockedApi(route.request().url())));

    for (const route of publicRoutes) {
      await page.goto(baseUrl + route, { waitUntil: 'networkidle' });
      await assertNoViewportOverflow(page, route, width);
    }

    await page.addInitScript(() => {
      localStorage.setItem('token', 'launch-smoke-token');
      localStorage.setItem('User_name', 'Launch Tester');
      localStorage.setItem('User_group', 'user');
      localStorage.setItem('Mobile_number', '919999999999');
    });

    for (const route of protectedRoutes) {
      await page.goto(baseUrl + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(150);
      await assertNoViewportOverflow(page, route, width);
      assert(await page.getByText('More', { exact: true }).count(), `${route} is missing mobile More navigation at ${width}px`);

      if (route === '/services/institute/forms') {
        const trigger = page.getByRole('button', { name: /new form/i });
        if (await trigger.count()) {
          await trigger.first().click();
          await page.waitForTimeout(50);
          await assertNoViewportOverflow(page, route, width, 'dialog');
          await page.keyboard.press('Escape');
        }
      }

      if (route === '/services/store/products') {
        const trigger = page.getByRole('button', { name: /add product/i });
        if (await trigger.count()) {
          await trigger.first().click();
          await page.waitForTimeout(50);
          await assertNoViewportOverflow(page, route, width, 'dialog');
          await page.keyboard.press('Escape');
        }
      }
    }

    assert(pageErrors.length === 0, `Browser errors at ${width}px: ${pageErrors.join(' | ')}`);
    await context.close();
  }

  console.log(`Mobile smoke passed at ${widths.join(', ')}px across ${publicRoutes.length + protectedRoutes.length} customer-facing routes.`);
} finally {
  await browser.close();
}
