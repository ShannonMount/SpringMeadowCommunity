Authenticated smoke tests (Playwright)

Overview
- This is a best-effort Playwright smoke test suite for admin flows: login, admin data-tables example, edit navigation, and archive action.

Prerequisites
1. Node.js installed.
2. Install Playwright testing deps (one-time):

```bash
npm install -D @playwright/test playwright
npx playwright install chromium
```

Environment options
- Option A: cookie-based (recommended when your app uses external OAuth or complex flows)
  - `SMOKE_BASE_URL` (e.g. https://staging.example.com)
  - `SMOKE_SESSION_COOKIE_NAME` (cookie name used for session)
  - `SMOKE_SESSION_COOKIE_VALUE` (cookie value / session token)

- Option B: form-based login (works if app exposes email/password form at `/login`)
  - `SMOKE_BASE_URL`
  - `SMOKE_ADMIN_EMAIL`
  - `SMOKE_ADMIN_PASSWORD`

Running

```bash
# example (cookie-based)
export SMOKE_BASE_URL="https://staging.example.com"
export SMOKE_SESSION_COOKIE_NAME="sb-session"
export SMOKE_SESSION_COOKIE_VALUE="<your-session-cookie>"
npx playwright test tests/e2e/smoke.spec.mjs --project=chromium --reporter=list

# example (form-based)
export SMOKE_BASE_URL="http://localhost:3000"
export SMOKE_ADMIN_EMAIL="admin@example.com"
export SMOKE_ADMIN_PASSWORD="hunter2"
npx playwright test tests/e2e/smoke.spec.mjs --project=chromium --reporter=list
```

Notes
- The test is intentionally tolerant: it checks for page responses and the presence of elements but avoids destructive assertions. For archive actions it intercepts the POST but does not force a rollback.
- If your app requires additional headers or CSRF tokens for form posts, use the cookie method or extend the test to fetch a CSRF token first.

CI Integration
- Add the install step to your CI pipeline, set the environment variables in CI secrets, and run the same `npx playwright test ...` command.
