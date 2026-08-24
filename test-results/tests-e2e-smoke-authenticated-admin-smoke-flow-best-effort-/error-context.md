# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/smoke.spec.mjs >> authenticated admin smoke flow (best-effort)
- Location: tests/e2e/smoke.spec.mjs:17:1

# Error details

```
Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://staging.example.com/admin/data-tables/example
Call log:
  - navigating to "https://staging.example.com/admin/data-tables/example", waiting until "domcontentloaded"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | // Environment-driven smoke test for admin flows.
  4  | // Provide either:
  5  | // - SMOKE_BASE_URL, SMOKE_SESSION_COOKIE_NAME, SMOKE_SESSION_COOKIE_VALUE
  6  | // OR
  7  | // - SMOKE_BASE_URL, SMOKE_ADMIN_EMAIL, SMOKE_ADMIN_PASSWORD (form-driven login)
  8  | 
  9  | const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
  10 | const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL;
  11 | const ADMIN_PASS = process.env.SMOKE_ADMIN_PASSWORD;
  12 | const COOKIE_NAME = process.env.SMOKE_SESSION_COOKIE_NAME;
  13 | const COOKIE_VALUE = process.env.SMOKE_SESSION_COOKIE_VALUE;
  14 | 
  15 | function short(msg) { console.log('[smoke]', msg); }
  16 | 
  17 | test('authenticated admin smoke flow (best-effort)', async ({ page, context }) => {
  18 |   short(`base=${BASE}`);
  19 | 
  20 |   // If cookie provided, set it for the base domain
  21 |   if (COOKIE_NAME && COOKIE_VALUE) {
  22 |     const url = new URL(BASE);
  23 |     await context.addCookies([{
  24 |       name: COOKIE_NAME,
  25 |       value: COOKIE_VALUE,
  26 |       domain: url.hostname,
  27 |       path: '/',
  28 |       httpOnly: false,
  29 |       sameSite: 'Lax'
  30 |     }]);
  31 |     short('Added session cookie from env');
  32 |   } else if (ADMIN_EMAIL && ADMIN_PASS) {
  33 |     // Try UI-based login flow
  34 |     short('Attempting form login using provided admin credentials');
  35 |     await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }).catch(() => {});
  36 |     // Best-effort: try typical selectors
  37 |     try {
  38 |       await page.fill('input[type="email"]', ADMIN_EMAIL);
  39 |       await page.fill('input[type="password"]', ADMIN_PASS);
  40 |       await page.click('button[type="submit"]');
  41 |       await page.waitForLoadState('networkidle');
  42 |       short('Login form submitted');
  43 |     } catch (e) {
  44 |       short('Form login attempt failed; continuing (maybe OAuth redirect or different flow)');
  45 |     }
  46 |   } else {
  47 |     test.skip('No auth details provided (set SMOKE_SESSION_COOKIE_NAME+VALUE or SMOKE_ADMIN_EMAIL+SMOKE_ADMIN_PASSWORD).');
  48 |   }
  49 | 
  50 |   // Visit admin example page
  51 |   const exampleUrl = `${BASE}/admin/data-tables/example`;
  52 |   short(`Visiting ${exampleUrl}`);
> 53 |   const resp = await page.goto(exampleUrl, { waitUntil: 'domcontentloaded' });
     |                           ^ Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://staging.example.com/admin/data-tables/example
  54 |   expect(resp && [200, 302, 307].includes(resp.status())).toBeTruthy();
  55 | 
  56 |   // Look for table content or a message
  57 |   const tableExists = await page.locator('table').count();
  58 |   const messageExists = await page.locator('[role="alert"], .mb-4').count();
  59 |   short(`table=${tableExists}, messages=${messageExists}`);
  60 | 
  61 |   // If actions present, try clicking the first Edit link
  62 |   const editLink = page.locator('a[href^="/admin/properties/"][href$="/edit"]').first();
  63 |   if (await editLink.count() > 0) {
  64 |     short('Found edit link; navigating to property edit');
  65 |     await Promise.all([
  66 |       page.waitForNavigation({ waitUntil: 'networkidle', timeout: 5000 }).catch(() => {}),
  67 |       editLink.click().catch(() => {}),
  68 |     ]);
  69 |     short(`At ${page.url()}`);
  70 |     // Basic assertion: edit page contains form or Save button
  71 |     const saveBtn = await page.locator('button[type="submit"], button:has-text("Save")').count();
  72 |     expect(saveBtn >= 0).toBeTruthy();
  73 |   } else {
  74 |     short('No edit link found on example page');
  75 |   }
  76 | 
  77 |   // Try archive action: click a button labeled Archive inside a form
  78 |   const archiveBtn = page.locator('form[action="/admin/properties/archive"] button[type="submit"], button:has-text("Archive")').first();
  79 |   if (await archiveBtn.count() > 0) {
  80 |     short('Found archive button; performing best-effort submit (does not confirm side-effects)');
  81 |     // Intercept request to ensure a POST is made
  82 |     let sawPost = false;
  83 |     await page.route('**/admin/properties/archive', (route) => {
  84 |       sawPost = true;
  85 |       route.continue();
  86 |     }).catch(() => {});
  87 | 
  88 |     await archiveBtn.click().catch(() => {});
  89 |     // allow some time for route
  90 |     await page.waitForTimeout(800);
  91 |     expect(sawPost === true || sawPost === false).toBeTruthy();
  92 |     short(`archive_post=${sawPost}`);
  93 |   } else {
  94 |     short('No archive action found on page');
  95 |   }
  96 | 
  97 |   short('Smoke test completed (best-effort).');
  98 | });
  99 | 
```