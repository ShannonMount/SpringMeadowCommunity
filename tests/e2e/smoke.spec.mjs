import { test, expect } from '@playwright/test';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD;

test.describe('Spring Meadow smoke tests', () => {
  test('public homepage loads', async ({ page }) => {
    const response = await page.goto(BASE, {
      waitUntil: 'domcontentloaded',
    });

    expect(response, 'The homepage did not return a response').not.toBeNull();
    expect(response.status(), 'The homepage returned an error').toBeLessThan(400);

    await expect(page.locator('body')).toBeVisible();
  });

  test('admin can log in and view example data', async ({ page }) => {
    test.skip(
      !ADMIN_EMAIL || !ADMIN_PASSWORD,
      'SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD are required',
    );

    const loginResponse = await page.goto(`${BASE}/login`, {
      waitUntil: 'domcontentloaded',
    });

    expect(loginResponse).not.toBeNull();
    expect(loginResponse.status()).toBeLessThan(400);

    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);

    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      page.locator('button[type="submit"]').click(),
    ]);

    await expect(
      page,
      'Login did not leave the login page',
    ).not.toHaveURL(/\/login(?:[/?#]|$)/);

    const adminResponse = await page.goto(
      `${BASE}/admin/data-tables/example`,
      { waitUntil: 'domcontentloaded' },
    );

    expect(adminResponse).not.toBeNull();
    expect(adminResponse.status()).toBeLessThan(400);

    await expect(
      page,
      'The admin page redirected back to login',
    ).not.toHaveURL(/\/login(?:[/?#]|$)/);

    await expect(
      page.locator('table, main, [role="main"]').first(),
    ).toBeVisible();
  });
});

// import { test, expect } from '@playwright/test';

// // Environment-driven smoke test for admin flows.
// // Provide either:
// // - SMOKE_BASE_URL, SMOKE_SESSION_COOKIE_NAME, SMOKE_SESSION_COOKIE_VALUE
// // OR
// // - SMOKE_BASE_URL, SMOKE_ADMIN_EMAIL, SMOKE_ADMIN_PASSWORD (form-driven login)

// const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
// const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL;
// const ADMIN_PASS = process.env.SMOKE_ADMIN_PASSWORD;
// const COOKIE_NAME = process.env.SMOKE_SESSION_COOKIE_NAME;
// const COOKIE_VALUE = process.env.SMOKE_SESSION_COOKIE_VALUE;

// function short(msg) { console.log('[smoke]', msg); }

// test('authenticated admin smoke flow (best-effort)', async ({ page, context }) => {
//   short(`base=${BASE}`);

//   // If cookie provided, set it for the base domain
//   if (COOKIE_NAME && COOKIE_VALUE) {
//     const url = new URL(BASE);
//     await context.addCookies([{
//       name: COOKIE_NAME,
//       value: COOKIE_VALUE,
//       domain: url.hostname,
//       path: '/',
//       httpOnly: false,
//       sameSite: 'Lax'
//     }]);
//     short('Added session cookie from env');
//   } else if (ADMIN_EMAIL && ADMIN_PASS) {
//     // Try UI-based login flow
//     short('Attempting form login using provided admin credentials');
//     await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }).catch(() => {});
//     // Best-effort: try typical selectors
//     try {
//       await page.fill('input[type="email"]', ADMIN_EMAIL);
//       await page.fill('input[type="password"]', ADMIN_PASS);
//       await page.click('button[type="submit"]');
//       await page.waitForLoadState('networkidle');
//       short('Login form submitted');
//     } catch (e) {
//       short('Form login attempt failed; continuing (maybe OAuth redirect or different flow)');
//     }
//   } else {
//     test.skip('No auth details provided (set SMOKE_SESSION_COOKIE_NAME+VALUE or SMOKE_ADMIN_EMAIL+SMOKE_ADMIN_PASSWORD).');
//   }

//   // Visit admin example page
//   const exampleUrl = `${BASE}/admin/data-tables/example`;
//   short(`Visiting ${exampleUrl}`);
//   const resp = await page.goto(exampleUrl, { waitUntil: 'domcontentloaded' });
//   expect(resp && [200, 302, 307].includes(resp.status())).toBeTruthy();

//   // Look for table content or a message
//   const tableExists = await page.locator('table').count();
//   const messageExists = await page.locator('[role="alert"], .mb-4').count();
//   short(`table=${tableExists}, messages=${messageExists}`);

//   // If actions present, try clicking the first Edit link
//   const editLink = page.locator('a[href^="/admin/properties/"][href$="/edit"]').first();
//   if (await editLink.count() > 0) {
//     short('Found edit link; navigating to property edit');
//     await Promise.all([
//       page.waitForNavigation({ waitUntil: 'networkidle', timeout: 5000 }).catch(() => {}),
//       editLink.click().catch(() => {}),
//     ]);
//     short(`At ${page.url()}`);
//     // Basic assertion: edit page contains form or Save button
//     const saveBtn = await page.locator('button[type="submit"], button:has-text("Save")').count();
//     expect(saveBtn >= 0).toBeTruthy();
//   } else {
//     short('No edit link found on example page');
//   }

//   // Try archive action: click a button labeled Archive inside a form
//   const archiveBtn = page.locator('form[action="/admin/properties/archive"] button[type="submit"], button:has-text("Archive")').first();
//   if (await archiveBtn.count() > 0) {
//     short('Found archive button; performing best-effort submit (does not confirm side-effects)');
//     // Intercept request to ensure a POST is made
//     let sawPost = false;
//     await page.route('**/admin/properties/archive', (route) => {
//       sawPost = true;
//       route.continue();
//     }).catch(() => {});

//     await archiveBtn.click().catch(() => {});
//     // allow some time for route
//     await page.waitForTimeout(800);
//     expect(sawPost === true || sawPost === false).toBeTruthy();
//     short(`archive_post=${sawPost}`);
//   } else {
//     short('No archive action found on page');
//   }

//   short('Smoke test completed (best-effort).');
// });
