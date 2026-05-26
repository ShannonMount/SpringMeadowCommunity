# Story 1.5: Public Contact Form with Bot Protection

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a public visitor,
I want to contact the HOA from the public website,
so that I can submit a message without needing a resident portal account.

## Acceptance Criteria

1. Given the visitor opens the public contact page, when the form loads, then it collects name, email, optional phone, message, and bot-protection token, and the form does not ask for or reveal private account information.
2. Given the visitor submits valid contact information with a valid Turnstile token, when the server receives the request, then the request is validated and routed to the configured email or inquiry workflow, and the visitor receives a privacy-safe success response.
3. Given the visitor submits invalid data, omits required fields, or fails bot protection, when the server rejects the request, then the form displays accessible field errors, and internal validation or security details are not exposed.

## Tasks / Subtasks

- [x] Replace the public contact placeholder with a real public contact page. (AC: 1, 3)
  - [x] Update `app/(public)/contact/page.tsx` so it no longer renders `PlaceholderPage`.
  - [x] Keep the route inside the existing `(public)` route group so it retains `PublicNav`.
  - [x] Add clear public contact copy that invites general HOA messages without asking for account number, property address, dues balance, resident details, or private document references.
- [x] Build an accessible public contact form. (AC: 1, 3)
  - [x] Add a small client component such as `components/public/contact-form.tsx` for form state, submission status, and Turnstile token capture.
  - [x] Collect `name`, `email`, optional `phone`, `message`, and a Turnstile response token. Use the Turnstile field name `cf-turnstile-response` or map it to `turnstileToken` before POSTing.
  - [x] Associate every label with its field, expose inline errors with `aria-describedby`, use `aria-invalid` where appropriate, and send form-level status updates through an `aria-live` region.
  - [x] Keep submit controls keyboard reachable and visibly focused.
- [x] Add shared validation and response helpers. (AC: 1, 2, 3)
  - [x] Add a small module such as `lib/public/contact.ts` for public contact request types, validation rules, public-safe error messages, and success copy.
  - [x] Validate required name, email, message, reasonable length limits, optional phone length/characters, and presence of bot-protection token.
  - [x] Return field-level errors for visitor-correctable problems without exposing validator internals, Turnstile failure codes, stack traces, email provider details, IP data, or rate-limit internals.
- [x] Add the public contact route handler. (AC: 2, 3)
  - [x] Add `app/api/public/contact/route.ts` implementing `POST /api/public/contact`.
  - [x] Parse JSON request bodies matching the API design: `communitySlug`, `name`, `email`, optional `phone`, `message`, and `turnstileToken`.
  - [x] Validate input before delivery and return privacy-safe JSON for success and failure.
  - [x] Do not add a `route.ts` at the same segment level as a `page.tsx`; keep the API route under `app/api/public/contact/route.ts`.
- [x] Add Turnstile verification guardrails. (AC: 1, 2, 3)
  - [x] Add a server-only helper such as `server/public/turnstile.ts` with `verifyTurnstile(token: string, remoteIp?: string): Promise<boolean>`.
  - [x] Use Cloudflare Siteverify server-side validation when `TURNSTILE_SECRET_KEY` is configured.
  - [x] Include a deterministic non-production/test fallback only if needed for local tests; do not bypass Turnstile in production.
  - [x] Treat failed, missing, expired, reused, or malformed tokens as the same public-safe bot-protection error.
- [x] Add a minimal contact delivery abstraction. (AC: 2)
  - [x] Add a server-only helper such as `server/public/contact-routing.ts` that represents the configured email or inquiry workflow.
  - [x] Because Resend and database-backed inquiry storage are not implemented yet, keep this abstraction small and explicit: queue/log in development/test, and fail safely in production if no configured delivery path exists.
  - [x] Do not import Supabase clients, payment services, document services, resident/property/board/admin services, or future message-thread services in this story.
- [x] Preserve privacy, abuse, and public-data boundaries. (AC: 1, 2, 3)
  - [x] Do not collect account number, property address, dues balance, owner name, payment history, private document IDs, resident contact data, board-only context, or admin-only context.
  - [x] Do not disclose whether an email belongs to a resident, whether a property exists, whether a board member received the message, or whether a private workflow was created.
  - [x] Keep response copy generic: accepted/sent on success, correctable public messages on user error, and a generic retry/contact-later message on delivery failure.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Extend `tests/public-shell.test.mjs` or add focused Node tests for contact page replacement, form fields, accessible error/status patterns, API route presence, Turnstile helper presence, validation helper behavior, and private-data guardrails.
  - [x] Add tests or guardrails proving private account/property/payment/document fields are not present in the contact page, contact validation module, or API route.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
  - [x] Manually inspect the contact page on desktop and mobile for readable, reachable, non-overlapping form controls and errors.

### Review Findings

- [x] [Review][Patch] Production contact routing can report success without delivering or storing the request [server/public/contact-routing.ts:11]

## Dev Notes

Story 1.5 builds on the completed public shell and the public static page/listing pattern from Stories 1.1 through 1.4. The contact route already exists at `/contact`, but it currently renders the generic placeholder component. This story should turn it into a real public form while introducing the first public mutation endpoint in a controlled way.

### Current Files To Update

- `app/(public)/contact/page.tsx`
  - Current state: renders `PlaceholderPage` with title `Contact`.
  - This story changes it into a real public contact page.
  - Preserve: route path `/contact` and public layout/navigation inherited from `app/(public)/layout.tsx`.
- `tests/public-shell.test.mjs`
  - Current state: lightweight Node file-content tests covering the public shell, public routes, home/about content, announcements, events, empty states, and public/private guardrails.
  - This story should extend the same test style unless a better local test pattern is introduced.
- `app/(public)/layout.tsx`
  - Current state: wraps public routes with `PublicNav`.
  - This story should not need to modify it.
- `components/public/public-nav.tsx` and `lib/public/navigation.ts`
  - Current state: `/contact` already appears in public navigation.
  - This story should not need to change navigation labels or hrefs.

### New Files Likely Needed

- `components/public/contact-form.tsx`
  - Use a Client Component only for interactive form state, Turnstile token capture, pending state, and accessible success/error feedback.
- `lib/public/contact.ts`
  - Public-safe request/response types, validation helpers, length limits, and user-facing copy.
- `app/api/public/contact/route.ts`
  - Route Handler for `POST /api/public/contact`.
- `server/public/turnstile.ts`
  - Server-only Turnstile Siteverify helper.
- `server/public/contact-routing.ts`
  - Server-only minimal delivery/inquiry abstraction.

### API Contract

Implement the route from the API design:

```http
POST /api/public/contact
```

Request shape:

```ts
{
  communitySlug: string
  name: string
  email: string
  phone?: string
  message: string
  turnstileToken: string
}
```

Success response:

```ts
{ ok: true }
```

Failure responses should be JSON, public-safe, and suitable for rendering accessible field/form errors. A suggested shape:

```ts
{
  ok: false
  errors?: {
    name?: string
    email?: string
    phone?: string
    message?: string
    turnstileToken?: string
    form?: string
  }
}
```

### Technical Requirements

- Use Next.js + TypeScript App Router and the existing Tailwind CSS setup.
- Keep `app/(public)/contact/page.tsx` as a Server Component that imports a focused client form component if interactivity is needed.
- Implement `POST /api/public/contact` with a Route Handler under `app/api/public/contact/route.ts`, matching architecture guidance for public forms.
- Use Web `Request`/`Response` or `NextRequest`/`NextResponse`; keep responses JSON and privacy-safe.
- Do not add broad form libraries, schema libraries, email SDKs, or database clients unless the repo already has them. The current package set has only Next, React, TypeScript, and Tailwind.
- Use native TypeScript validation for this story unless the project already introduces a validation library before implementation.
- Configure Turnstile with environment variables:
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` for the client widget site key.
  - `TURNSTILE_SECRET_KEY` for server-side Siteverify.
  - Optional `CONTACT_TO_EMAIL` or equivalent only if the delivery abstraction needs a configured recipient.
- Never expose secret keys, validation error codes, provider details, stack traces, IP addresses, or hidden workflow details to the browser.
- Keep rate-limiting hooks minimal. A real persistent rate limiter can be deferred, but the route and tests should leave an obvious place to add IP/email rate limiting later.

### Architecture Compliance

- Public visitors may submit only public contact requests. They must not read or infer private resident, property, board, payment, document, or admin data.
- Public form mutations must use bot protection.
- Cloudflare Turnstile must be verified server-side; the client widget alone is not sufficient protection.
- The API design states public contact behavior: verify Turnstile token, validate input, send email via Resend or create internal message/inquiry record, and rate limit by IP/email.
- Since Resend, Supabase inquiry records, and message-thread workflows are later work in this repo, implement only the smallest delivery abstraction needed to satisfy the configured email/inquiry workflow boundary without inventing broader messaging/admin systems.
- Do not create resident portal messaging, board inbox, admin screens, database migrations, Supabase clients, Resend integration, or persistent audit logs in this story unless those dependencies already exist locally before development starts.

### UX and Accessibility Requirements

- Use one page-level `h1`.
- Provide concise guidance that the form is for general HOA contact and not for private account lookups.
- Fields:
  - Name: required text input.
  - Email: required email input.
  - Phone: optional tel input.
  - Message: required textarea.
  - Turnstile: visible widget or privacy-safe bot-protection placeholder when unconfigured in local development.
- Errors:
  - Field errors must be adjacent or clearly associated with fields.
  - Form-level errors and success messages must use an `aria-live` region.
  - Do not rely on color alone.
- Mobile:
  - Labels, inputs, textarea, Turnstile area, errors, and submit button must not overlap or clip at narrow widths.
  - Controls should have stable spacing and readable text.

### Testing Requirements

- Extend existing Node file-content tests rather than adding broad E2E infrastructure.
- Minimum checks:
  - `app/(public)/contact/page.tsx` no longer renders `PlaceholderPage`.
  - Contact page renders a single `h1`, references the contact form, and preserves public-shell navigation.
  - Contact form includes name, email, optional phone, message, Turnstile token handling, submit status, `aria-live`, `aria-invalid`, and `aria-describedby`.
  - `app/api/public/contact/route.ts` exists, exports `POST`, validates request data, calls `verifyTurnstile`, and returns public-safe JSON.
  - `server/public/turnstile.ts` exists and calls Cloudflare Siteverify when `TURNSTILE_SECRET_KEY` is configured.
  - Contact files do not import `@/server/services`, `@/server/queries`, Supabase clients, payment services, document services, resident/property/board/admin services, or private workflow internals.
  - Contact page/form/API do not include private fields or phrases such as account number, property address, dues balance, owner name, payment history, private documents, resident contact data, or board-only/admin-only workflow details.
  - Empty/error/success copy is privacy-safe and does not disclose whether a resident, property, email, board inbox, or private workflow exists.
- Required verification commands:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

### Previous Story Intelligence

- Story 1.1 established the public route group and `PublicNav`. A review finding moved `/login` into `(public)` after it dropped the public shell. Keep `/contact` inside `(public)` and do not create a duplicate route in another group.
- Story 1.2 added real public home/about pages, shared static public content, a reusable empty-state component, and file-content tests.
- Story 1.3 added a static public listing pattern plus privacy guardrails. Its review removed private-looking fixture data. Do not include private-looking fields, IDs, labels, hrefs, workflow names, or paths in public contact fixtures or tests.
- Story 1.4 added public events with deterministic helpers and strong public/private import guardrails. Continue the pattern of small public modules, explicit helper names, and focused Node tests.
- Existing tests are fast Node tests; they intentionally use file-content guardrails rather than importing TypeScript modules directly.
- The project currently has no `project-context.md`.

### Latest Technical Information

- Next.js Route Handlers are defined as `route.ts` files inside `app` and support HTTP methods such as `POST`; they are the App Router equivalent of API routes in the older Pages Router.
- Next.js public form implementations can use Server Actions, but this project's architecture and API design specify a Route Handler for public forms and integrations.
- Cloudflare Turnstile requires server-side Siteverify validation. Tokens can be forged, expire after five minutes, and are single-use, so client-side widget completion alone is not protection.
- Cloudflare Siteverify endpoint: `POST https://challenges.cloudflare.com/turnstile/v0/siteverify`. Required parameters are `secret` and `response`; `remoteip` is optional.
- Current package versions use `next` `^16.0.0`, React `^19.0.0`, TypeScript `^5.0.0`, and Tailwind `^4.0.0`.
- Tailwind v4 is configured through `@tailwindcss/postcss` and `@import "tailwindcss";`; do not add Tailwind v3-style config unless a real need appears.

### Project Context Reference

- No `project-context.md` file was found.

### References

- [Epics: Story 1.5](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/epics.md)
- [Requirements: Public Contact and Bot Protection](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Architecture: Public Forms and Security Controls](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Public Contact Form](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Tasks v1: Public Contact Page/Form](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Previous Story 1.4](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/stories/1-4-public-events-listing.md)
- Next.js Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- Next.js Forms Guide: https://nextjs.org/docs/app/guides/forms
- Cloudflare Turnstile Server-Side Validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-06: Red phase confirmed with `npm test` failing before contact form, validation, API route, Turnstile, and routing helpers existed.
- 2026-05-06: Green/refactor validation passed with `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- 2026-05-06: Render check passed by serving the production build on port 3001 and fetching `/contact`; output included public nav, contact form fields, bot-protection placeholder, and accessible status markup.
- 2026-05-06: API smoke check against production build confirmed missing/unverified bot protection returns a public-safe field error when live Turnstile secrets are not configured.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Replaced the `/contact` placeholder with a public contact page that remains in the public route group.
- Added an accessible client contact form with name, email, optional phone, message, Turnstile response token handling, inline field errors, pending/success/error state, and an `aria-live` status region.
- Added public-safe validation helpers, API route handler for `POST /api/public/contact`, server-only Turnstile Siteverify helper, and minimal server-only contact routing abstraction.
- Added guardrail tests for contact page replacement, form accessibility, validation helper shape, API route behavior, server-only helpers, and private-data boundaries.
- Resolved code review finding by making the temporary contact routing abstraction fail safely in production until a real delivery or inquiry workflow exists.

### File List

- `app/(public)/contact/page.tsx`
- `components/public/contact-form.tsx`
- `lib/public/contact.ts`
- `app/api/public/contact/route.ts`
- `server/public/turnstile.ts`
- `server/public/contact-routing.ts`
- `tests/public-shell.test.mjs`
- `docs/bmad/phase-4-tasks/stories/1-5-public-contact-form-with-bot-protection.md`
- `_bmad-output/implementation-artifacts/1-5-public-contact-form-with-bot-protection.md`
- `docs/bmad/phase-4-tasks/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-06: Created Story 1.5 context for public contact form with bot protection.
- 2026-05-06: Implemented public contact form with validation, Turnstile guardrails, route handler, routing abstraction, tests, and moved story to review.
- 2026-05-06: Addressed Story 1.5 code review finding for production contact routing.
