# Story 2.1: Resident Authentication Entry and Session Handling

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a resident,
I want to log in securely,
so that I can access private portal features tied to my authorized property records.

## Acceptance Criteria

1. Given a resident opens the login page, when they enter valid credentials or complete the configured Supabase Auth flow, then the system creates a valid authenticated session, and the resident is routed to the resident portal.
2. Given a resident enters invalid credentials or an expired login link, when authentication fails, then the login page displays a privacy-safe accessible error message, and no account existence or private property information is exposed.
3. Given an unauthenticated visitor attempts to access a resident route, when the route guard evaluates the request, then the visitor is redirected to login, and the private route content is not rendered.

## Tasks / Subtasks

- [x] Add Supabase SSR auth dependencies and configuration. (AC: 1, 2, 3)
  - [x] Install `@supabase/supabase-js` and `@supabase/ssr`.
  - [x] Add a client-safe Supabase browser client helper under `lib/supabase/client.ts`.
  - [x] Add a server-only Supabase client helper under `lib/supabase/server.ts` or `server/services/supabase/server.ts`, following the existing project import style.
  - [x] Add a proxy/session refresh helper under `lib/supabase/proxy.ts` or equivalent, and wire it through root `proxy.ts`.
  - [x] Read only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in browser/client helpers; do not introduce or expose a service-role key in this story.
  - [x] Add a minimal `.env.example` or local env documentation for those two public Supabase variables if no project env example exists; do not create the full future env schema for Stripe, Resend, Turnstile, cron, or service-role secrets in this story.
- [x] Replace the public login placeholder with a real auth entry page. (AC: 1, 2)
  - [x] Update `app/(public)/login/page.tsx`; keep the `/login` URL inside the public route group so the existing public shell/navigation still renders.
  - [x] Build an accessible login form for the configured Supabase Auth method. Email/password is acceptable for this story; magic link may be added if the Supabase project settings require it.
  - [x] Use semantic labels, required/error states, one page-level `h1`, visible focus styles, keyboard-operable controls, and non-overlapping responsive layout.
  - [x] On success, route the resident to the resident portal entry route.
  - [x] On failure, show a generic privacy-safe error such as "We could not sign you in with those details." Do not reveal whether an account exists.
- [x] Add login/logout server actions or route-handler equivalents. (AC: 1, 2)
  - [x] Add a server action module such as `server/actions/auth.ts` or `app/(public)/login/actions.ts`.
  - [x] Implement sign-in through the server Supabase client so cookies/session state are handled server-side.
  - [x] Add logout behavior that signs the user out and redirects to `/login` or `/`.
  - [x] Normalize Supabase Auth errors into privacy-safe UI state; do not pass raw provider errors or stack traces to rendered UI.
- [x] Handle auth callback and expired-link states for configured link-based flows. (AC: 1, 2)
  - [x] If magic link, email confirmation, OAuth, or password recovery is enabled for the Supabase project, add a callback route such as `app/auth/callback/route.ts` or the project-standard equivalent to exchange the returned code for a session.
  - [x] Redirect successful callbacks to the resident portal entry route or the safe `next` path if one is validated.
  - [x] Redirect failed, missing-code, expired-link, or invalid-link callbacks back to `/login` with a generic error state.
  - [x] If this implementation intentionally supports email/password only, document that choice in completion notes and make sure no link-based UI is presented without callback support.
- [x] Add the first resident portal protected route surface. (AC: 1, 3)
  - [x] Create the smallest resident portal landing route needed for successful auth redirection, such as `app/(resident)/portal/page.tsx`.
  - [x] Keep it free of private property, payment, document, board, and membership data because profile/property resolution belongs to Stories 2.2 and 2.3.
  - [x] If a resident layout is added, include only public-safe shell text and a logout action; do not build the full resident dashboard navigation yet.
- [x] Protect resident routes before render. (AC: 3)
  - [x] Add root `proxy.ts` using the Next.js 16 Proxy convention, not deprecated `middleware.ts`.
  - [x] Match the resident route path(s), for example `/portal/:path*`.
  - [x] Verify the user with Supabase server-side token validation before allowing resident route rendering.
  - [x] Redirect unauthenticated requests to `/login`, preserving an optional return path if implemented without leaking private URLs or data.
  - [x] Do not rely on client-only checks to protect resident content.
- [x] Preserve public-site behavior and privacy boundaries. (AC: 1, 2, 3)
  - [x] Keep existing public navigation labels and route destinations working.
  - [x] Preserve `app/(public)/layout.tsx`, `components/public/public-nav.tsx`, and existing public pages unless the login page needs a targeted update.
  - [x] Do not import private property/payment/document/board queries into public pages.
  - [x] Do not implement profiles, property memberships, roles, resident dashboard data, dues status, payment history, private documents, or invitations in this story.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add or extend focused Node tests for required auth files, login form accessibility markers, generic error copy, protected route existence, proxy route matching, and public/private data guardrails.
  - [x] Add tests or assertions proving no password hashes, raw credentials, service-role keys, profile/property queries, dues balance, payment history, or private document data are exposed in login/resident shell files.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
  - [x] Manually verify `/login` and the protected resident route in desktop and mobile widths.

## Dev Notes

Story 2.1 starts Epic 2 and crosses from the public website into authenticated resident access. Its job is authentication entry and session handling only. It should establish the Supabase SSR auth foundation, replace the placeholder login page, and prove unauthenticated users cannot render resident routes.

The most important scope boundary: authentication is not authorization. A valid Supabase session may enter the resident route surface, but Stories 2.2 through 2.5 own application profile resolution, property membership, invitations, roles, and permission assignment. Do not fake private resident data to make the portal feel complete.

### Current Files To Update

- `app/(public)/login/page.tsx`
  - Current state: renders `<PlaceholderPage title="Login" />`.
  - Change: replace with the real login entry UI.
  - Preserve: URL `/login`, public route group placement, public navigation shell, privacy-safe public context.
- `tests/public-shell.test.mjs`
  - Current state: fast Node file-content tests covering public shell, public pages, contact, payment placeholder, vendor placeholder, and privacy guardrails.
  - Change: extend or add a focused companion test file for auth/session guardrails. Keep the test style lightweight unless the project already has a better local pattern by implementation time.
- `package.json` and `package-lock.json`
  - Current state: Next.js `^16.0.0`, React `^19.0.0`, TypeScript `^5.0.0`, Tailwind `^4.0.0`; no Supabase packages yet.
  - Change: add Supabase SSR/client packages only. Avoid unrelated dependency churn.
- `.env.example` or equivalent env documentation
  - Current state: no env example file was found.
  - Change: add only the public Supabase URL/publishable key names needed for this story, unless the project has introduced a standard env documentation location by implementation time.
- `app/(public)/layout.tsx`, `components/public/public-nav.tsx`, `lib/public/navigation.ts`
  - Current state: public shell/nav patterns are established and tested.
  - Change: only if required to keep login accessible. Preserve all required public navigation labels.

### New Files Likely Needed

- `lib/supabase/client.ts`
  - Browser/client-component Supabase client using `createBrowserClient`.
- `lib/supabase/server.ts`
  - Server Component, Server Action, and Route Handler Supabase client using cookies.
- `lib/supabase/proxy.ts`
  - Session refresh/protection helper called by root `proxy.ts`.
- `proxy.ts`
  - Next.js 16 Proxy entry point. Use this instead of `middleware.ts`.
- `server/actions/auth.ts` or `app/(public)/login/actions.ts`
  - Login/logout server actions. Pick the local structure that keeps auth business logic server-side and reusable.
- `app/auth/callback/route.ts` or equivalent
  - Required if the configured Supabase flow uses magic links, email confirmation, OAuth, password recovery, or any link/code callback. It should exchange the auth code server-side and handle expired/invalid links with a generic redirect.
- `app/(resident)/portal/page.tsx`
  - Minimal protected resident landing route after successful login.
- Optional `app/(resident)/layout.tsx`
  - Only if useful for a small protected resident shell/logout control.

### Scope Boundary

In scope:

- Supabase SSR auth client setup.
- Login UI and login submission flow.
- Logout action.
- Auth callback handling when a configured Supabase flow returns a code or link.
- Session refresh/protection through server-side Proxy/session guard.
- Minimal protected resident route target.
- Generic accessible error states.
- Tests for auth file presence, route protection, privacy-safe errors, and no private-data leakage.

Out of scope:

- Supabase database migrations.
- `profiles` table, profile creation, or `getCurrentProfile()`.
- Property membership model or property authorization helpers.
- Invitation acceptance.
- Role/permission assignment.
- Resident dashboard data, dues status, payments, documents, messages, announcements/events inside the portal.
- Admin/board auth flows or MFA enforcement.
- Service-role client usage.
- Guest payment auth changes.

### Technical Requirements

- Use Next.js + TypeScript App Router.
- Use Supabase Auth for identity and sessions; do not implement custom password storage.
- Use `@supabase/ssr` for SSR cookie integration and `@supabase/supabase-js` for Supabase client functionality.
- Keep credentials in Supabase Auth. Application tables must not store passwords or hashes.
- Prefer server actions or route handlers for auth mutations so cookie/session state is controlled server-side.
- Add callback handling for any enabled link-based Supabase flow. Do not display or link to magic-link/password-recovery/OAuth behavior unless the callback path exists and handles expired or invalid links safely.
- Resident route protection must happen before private route content renders. A client-side redirect alone is not sufficient.
- Use `proxy.ts` for Next.js 16 request-time routing checks. Do not add new `middleware.ts`.
- Do not use or expose a Supabase service-role key. Service-role usage is reserved for later trusted server code, jobs, webhooks, and storage signing.
- Keep error messages generic and privacy-safe for invalid credentials, expired links, missing sessions, and denied access.
- Avoid caching personalized auth responses in a way that could leak another user's session.
- Keep full environment validation/schema work scoped to the later backend foundation unless it already exists. This story only needs enough env documentation or tiny helper validation to avoid confusing setup failures for Supabase Auth.

### Architecture Compliance

- The architecture requires Supabase Auth for identity, server-side session checks for private routes, and application profile data outside Supabase Auth metadata. This story implements only the identity/session layer.
- Private actions and routes must read the Supabase session server-side before private route access.
- Layered authorization remains future work: authenticated user, community scope, role/permission, property membership, and workflow-specific checks. Do not collapse those future layers into this login story.
- Public visitors and guest payers do not need resident accounts. Do not force public pages, contact, vendor placeholder, or public pay-dues placeholder behind login.
- Guest payment flows must remain isolated from authenticated resident account flows.
- Supabase RLS is a later defense-in-depth requirement once private tables exist. This story should not create tables just to satisfy RLS.

### UX and Accessibility Requirements

- The login page must keep one page-level `h1`.
- Inputs must have labels, not placeholder-only labels.
- Error messages must be readable by assistive technologies, ideally connected with `aria-describedby` and/or `role="alert"` for submission-level failures.
- Submit and logout controls must be keyboard-operable and show visible focus states.
- Layout must work on mobile without overlapping controls or clipped text.
- Visible copy must avoid implementation jargon such as "Supabase", "JWT", "proxy", story numbers, table names, or auth internals.
- Do not display account existence, property address, owner name, dues balance, payment history, private document, board/admin, or membership state information on login failure.

### Testing Requirements

- Follow the existing lightweight Node test pattern where practical.
- Minimum checks:
  - `app/(public)/login/page.tsx` no longer renders `PlaceholderPage`.
  - Login page includes accessible form structure: labels, required email field, password or magic-link field/state, submit button, and generic error copy.
  - Supabase SSR helpers exist and use publishable/client-safe environment variables for browser code.
  - If a link/code callback route is implemented, invalid or expired callbacks redirect to `/login` with generic error handling and do not expose provider internals.
  - If no link/code callback route is implemented, tests or completion notes show that the visible login UI is email/password-only and does not present unsupported link-based auth.
  - Root `proxy.ts` exists and matches the resident portal route(s).
  - Resident protected route exists and contains no private operational data.
  - Public shell navigation and public routes still pass existing tests.
  - Login/auth files do not contain password-hash storage, service-role key reads, private property/payment/document queries, dues balance/payment history, `property_memberships`, private document paths, board/admin data, raw Supabase error rendering, or unvalidated external redirect targets.
- Required verification commands:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

### Previous Story Intelligence

- Story 1.1 established the public route group and `PublicNav`. Review later found that placing `/login` under `(auth)` dropped the public shell; the current project has `/login` in `app/(public)/login/page.tsx`. Keep it there.
- Stories 1.2 through 1.7 used small static/config modules and fast Node file-content tests. Continue that practical test style for guardrails.
- Story 1.5 added `POST /api/public/contact` with Turnstile handling. Do not mix public contact/bot-protection behavior into resident login unless explicitly needed; login-adjacent abuse protection can be considered later.
- Story 1.6 and 1.7 intentionally avoided real payment/vendor workflows while adding public entry points. Apply the same discipline here: add only enough resident route shell to prove redirect/session behavior.
- Story 1.7 broadened guardrail tests to catch private workflow leakage. This story should similarly test against accidental profile/property/payment/document leakage.
- Existing tests are file-content based and do not import TypeScript modules directly.
- The project currently has no `project-context.md`.
- Recent git history is only scaffold commits; the worktree has many uncommitted Epic 1 changes. Do not revert unrelated dirty files.

### Latest Technical Information

- Supabase's current Next.js SSR guidance uses `@supabase/ssr` and `@supabase/supabase-js`, with browser and server client helpers. Browser helpers use `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Supabase notes that Server Components cannot write cookies, so a request-time Proxy should refresh Auth tokens and pass refreshed cookies to both Server Components and the browser.
- Supabase warns that server code should not trust `auth.getSession()` for page/data protection because cookie data can be spoofed; use server-side token validation such as `auth.getClaims()` according to current docs.
- Next.js 16 renamed Middleware to Proxy. Use root `proxy.ts`; Proxy can redirect before routes render, but it should stay focused and not become a full data-fetching authorization layer.
- Next.js redirect utilities vary by location: use `redirect()` in Server Components/Server Actions/Route Handlers, and `NextResponse.redirect()` in Proxy.
- Supabase link-based flows return auth codes/tokens through callback URLs. The app must exchange those server-side, allow only safe same-origin redirects, and collapse invalid or expired links to the same privacy-safe login error path used for invalid credentials.

### Project Context Reference

- No `project-context.md` file was found.

### References

- [Epics: Story 2.1](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Architecture: Authentication Architecture](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [Architecture: Authorization Architecture](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Authentication and Cross-Cutting Requirements](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Auth Model and Password Security](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Tasks v1: Supabase Auth Setup](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Previous Story 1.7](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/1-7-public-vendor-proposal-placeholder.md)
- Supabase Next.js SSR Auth: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase SSR Advanced Guide: https://supabase.com/docs/guides/auth/server-side/advanced-guide
- Next.js Proxy: https://nextjs.org/docs/app/getting-started/proxy
- Next.js Proxy File Convention: https://nextjs.org/docs/app/building-your-application/routing/middleware

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Red phase: `npm test` failed on missing auth/session implementation while existing public shell tests passed.
- Green phase: `npm test`
- Verification: `npm run typecheck`
- Verification: `npm run lint`
- Verification: `npm run build`
- Manual smoke: local dev server with dummy public Supabase env; `GET /login` returned 200 and unauthenticated `HEAD /portal` returned 307 to `/login?next=%2Fportal`.

### Implementation Plan

- Add Supabase SSR/browser/proxy helpers and public env documentation.
- Replace the public login placeholder with a server-action-backed email/password form.
- Add privacy-safe sign-in/sign-out actions and code callback handling.
- Add a minimal protected resident portal entry route without profile/property data.
- Add file-content guardrail tests matching the existing project test style.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story validation completed on 2026-05-08; added callback-flow and env-documentation guardrails before dev.
- Installed `@supabase/supabase-js` and `@supabase/ssr`.
- Added Supabase browser, server, and proxy helpers using public URL/publishable key env variables only.
- Replaced the login placeholder with an accessible email/password form and generic privacy-safe auth error rendering.
- Added server actions for resident sign-in/sign-out and an auth callback route for code/link flows with safe redirects.
- Added root `proxy.ts` protecting `/portal/:path*` via `auth.getClaims()` before resident content renders.
- Added a minimal `/portal` resident landing page with logout and no private profile/property/payment/document data.
- Added auth-session guardrail tests and verified all required commands pass.

### File List

- `.env.example`
- `_bmad-output/implementation-artifacts/2-1-resident-authentication-entry-and-session-handling.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/(public)/login/page.tsx`
- `app/(resident)/portal/page.tsx`
- `app/auth/callback/route.ts`
- `docs/bmad/phase-4-tasks/sprint-status.yaml`
- `docs/bmad/phase-4-tasks/stories/2-1-resident-authentication-entry-and-session-handling.md`
- `lib/supabase/client.ts`
- `lib/supabase/config.ts`
- `lib/supabase/proxy.ts`
- `lib/supabase/server.ts`
- `package-lock.json`
- `package.json`
- `proxy.ts`
- `server/actions/auth.ts`
- `tests/auth-session.test.mjs`

### Change Log

- 2026-05-08: Created Story 2.1 context for resident authentication entry and session handling.
- 2026-05-08: Implemented Story 2.1 resident authentication entry, Supabase SSR session helpers, protected portal route, callback handling, auth guardrail tests, and moved story to review.
