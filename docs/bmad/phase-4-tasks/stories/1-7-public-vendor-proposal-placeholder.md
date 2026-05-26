# Story 1.7: Public Vendor Proposal Placeholder

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a vendor applicant,
I want to understand whether vendor proposal intake is available,
so that I know how to contact the HOA until the later vendor workflow exists.

## Acceptance Criteria

1. Given the vendor proposal module is not enabled for MVP, when a visitor looks for vendor proposal intake, then the public site routes them to approved public contact guidance, and no private vendor, board, contract, or invoice data is exposed.
2. Given a future feature flag enables vendor proposal intake, when the public navigation or contact page is configured to show it, then the design has an explicit public entry point ready for the later module, and the MVP implementation remains functional without that module.
3. Given a visitor submits a general vendor inquiry through the contact form, when the message is sent, then it is handled as a public contact request, and the visitor is not granted private vendor portal access.

## Tasks / Subtasks

- [x] Add public-safe vendor proposal placeholder configuration. (AC: 1, 2, 3)
  - [x] Add a small module such as `lib/public/vendor-proposals.ts` for public vendor proposal placeholder settings, route constants, enabled/disabled state, and copy.
  - [x] Model current MVP state as disabled by default because vendor proposal intake is later-phase scope.
  - [x] Include a future-facing enabled route constant, such as `/vendors/proposals`, without creating a real enabled workflow.
  - [x] Keep this module static/config-driven and easy to replace later with feature-flag or community settings data.
- [x] Add a public vendor proposal placeholder route or section. (AC: 1, 2)
  - [x] Create a public placeholder entry point such as `app/(public)/vendors/page.tsx` or `app/(public)/vendors/proposals/page.tsx`; keep it inside the `(public)` route group.
  - [x] Render clear guidance that vendor proposal intake is not available through an online module in MVP.
  - [x] Route visitors to `/contact` for current vendor or service inquiries.
  - [x] Do not add vendor proposal submission fields, file upload controls, contract views, invoice views, vendor login, or board/admin workflow links.
- [x] Add approved public contact guidance for vendor inquiries. (AC: 1, 3)
  - [x] Update `app/(public)/contact/page.tsx` only if useful to mention that vendors may use the general contact form for current inquiries.
  - [x] Preserve the existing contact form behavior and route: `POST /api/public/contact`.
  - [x] Do not add vendor-only fields to the contact form or create a separate vendor API route.
  - [x] Make clear that submitting a general vendor inquiry does not create vendor portal access.
- [x] Preserve the future module extension point without enabling private workflows. (AC: 2)
  - [x] If an entry card or link is added to public home/about content, keep it public-safe and route to the placeholder/contact guidance.
  - [x] Do not add the vendor placeholder to primary navigation unless the implementation keeps all nav destinations inside `(public)` and does not overcrowd or overflow mobile navigation.
  - [x] Do not create database tables, feature flag services, admin settings, vendor approval screens, invoice/bill workflows, uploads, or private document references.
- [x] Preserve accessibility, responsive layout, and public-data boundaries. (AC: 1, 2, 3)
  - [x] Use one page-level `h1`, semantic headings, readable body copy, meaningful link text, and visible focus states.
  - [x] Keep buttons/links stable on narrow screens and avoid text overflow or overlapping.
  - [x] Do not import Supabase clients, auth helpers, vendor services, board/admin services, invoice/payment services, document services, private queries, or file upload helpers.
  - [x] Do not display private vendor, board, contract, invoice, insurance/license attachment, approval, payment-detail, or portal-access data.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Extend `tests/public-shell.test.mjs` or add focused Node tests for the vendor placeholder route/config, contact fallback, future route constant, disabled-by-default behavior, and private-data guardrails.
  - [x] Add tests proving no vendor proposal API route, upload route, portal route, invoice route, board/admin workflow, or private vendor service is introduced.
  - [x] Add tests proving the public contact route remains the only current handling path for vendor inquiries.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
  - [x] Manually inspect the vendor placeholder/contact guidance on desktop and mobile for readable, reachable, non-overlapping controls.

### Review Findings

- [x] [Review][Patch] Broaden forbidden vendor workflow guardrail tests [tests/public-shell.test.mjs:414]

## Dev Notes

Story 1.7 is the final Epic 1 public-site placeholder story. Its job is to preserve a safe future vendor proposal path while keeping MVP behavior limited to public contact guidance. The implementation should be deliberately small and public-only.

The strongest constraint is scope control. Vendor proposal intake, approved vendor records, invoice submission, bill approval, contract visibility, vendor payment details, upload attachments, vendor roles, and vendor portal access are later work. This story should not create any real vendor workflow, private data model, admin view, or mutation endpoint.

### Current Files To Update

- `app/(public)/contact/page.tsx`
  - Current state: real public contact page with `ContactForm`, public-safe copy, and no vendor-specific private fields.
  - Possible change: add concise vendor/service inquiry guidance that still routes through the general public contact form.
  - Preserve: route path `/contact`, one page-level `h1`, `ContactForm`, public shell, and privacy-safe copy.
- `tests/public-shell.test.mjs`
  - Current state: lightweight Node file-content tests covering public shell, public routes, home/about, announcements, events, contact form/API, Pay Dues entry, staged lookup, and private-data guardrails.
  - This story should extend the same test style unless a better local test pattern is introduced.
- `lib/public/navigation.ts`
  - Current state: primary public navigation includes Home, About/Community Info, Announcements, Events, Documents/Public Resources, Contact, Pay Dues, and Login.
  - This story should not need to change primary navigation. If it does, all destinations must stay inside `(public)` and mobile nav must remain readable.
- `lib/public/community-content.ts`
  - Current state: home/about public entry cards include core public paths. It already mentions vendors in broad public audience copy.
  - Possible change: add a vendor/service inquiry card only if it improves discovery without adding private workflow language.

### New Files Likely Needed

- `lib/public/vendor-proposals.ts`
  - Public-safe placeholder settings, enabled/disabled helper, contact fallback route, and future proposal route constant.
- `app/(public)/vendors/page.tsx` or `app/(public)/vendors/proposals/page.tsx`
  - Public placeholder/guidance page for vendor proposal availability and contact fallback.

### Scope Boundary

In scope:

- Public vendor proposal placeholder configuration.
- Public placeholder route or public section explaining current availability.
- Contact fallback for vendor/service inquiries.
- Future-facing route constant or copy that preserves an extension point.
- Guardrail tests for public-only behavior and no private/vendor workflow creation.

Out of scope:

- Real vendor proposal submission form.
- Vendor proposal API route.
- File uploads or attachment handling.
- Vendor portal access or login.
- Approved vendor records.
- Board/admin proposal review or approval.
- Vendor invoices, bill approvals, contracts, insurance/license records, payment details, or audit logs.
- Database migrations, Supabase queries, auth role changes, feature flag services, or admin settings screens.

### Future Vendor Workflow Context To Respect

Later vendor proposal scope appears in Epic 8. Future vendor proposal design may include vendor name, contact information, work category, description, proposed amount/range, attachments, and insurance/license information. Later approved vendor workflows may include official vendor status, controlled portal access, invoice submission, bill approvals, comments, paid state, and permission-scoped records.

Story 1.7 must not implement those data fields or workflows. It may only leave a clear public entry point and contact fallback so future work has a safe place to attach.

### Technical Requirements

- Use Next.js + TypeScript App Router and the existing Tailwind CSS setup.
- Keep any vendor placeholder route inside `app/(public)`; do not create it under `(auth)`, `(resident)`, `(admin)`, `(vendor)`, or any route group that loses the public shell.
- Prefer Server Components and static public modules. This story should not need client state.
- Use a small `lib/public/*` module for configuration/copy rather than hardcoding everything directly into a page.
- Do not add dependencies, form libraries, schema libraries, upload libraries, database clients, email SDK changes, or vendor-specific service layers.
- Do not add server actions, route handlers, mutation endpoints, private queries, environment-variable-dependent vendor behavior, or feature flag infrastructure in this story.
- Do not add a `route.ts` at the same segment level as a `page.tsx`.

### Architecture Compliance

- Public visitors may read only public pages, public announcements, public events, public documents, and later public vendor proposal forms when implemented.
- MVP vendor proposal intake is not enabled; current handling must route through public contact guidance.
- General vendor inquiries submitted through the contact form remain public contact requests and must not grant vendor portal access.
- Private vendor, board, contract, invoice, payment, document, and approval workflows must remain hidden.
- Future vendor records and workflows must be community-scoped and permission-scoped; do not fake that infrastructure in this public placeholder.
- Document visibility includes a future `vendor` level, but public placeholder pages must not expose vendor-only documents or references to private storage paths.

### UX and Accessibility Requirements

- Use one page-level `h1` on any new vendor placeholder page.
- Provide concise copy that answers: whether online vendor proposal intake is available, what vendors should do now, and what submitting through contact does not provide.
- Use a clearly labeled contact action such as `Contact the HOA about vendor services`.
- If a future proposal entry action is shown, it must be visibly unavailable or routed to contact guidance while the module is disabled.
- Links/buttons must have visible focus states and text that fits on mobile.
- Avoid implementation jargon in visible page copy: do not mention story numbers, internal feature flags, database tables, private workflow names, or admin module internals.

### Testing Requirements

- Extend existing Node file-content tests rather than adding broad E2E infrastructure.
- Minimum checks:
  - Vendor placeholder page exists inside `app/(public)`.
  - `lib/public/vendor-proposals.ts` exists and models vendor proposal intake as disabled by default.
  - Placeholder route renders public guidance and a contact fallback.
  - Contact page or content includes vendor inquiry guidance only through general contact.
  - No vendor proposal API route, upload route, vendor portal route, invoice route, board/admin workflow, or private vendor service is added.
  - Vendor placeholder/contact files do not import `@/server/services`, `@/server/queries`, Supabase clients, auth helpers, board/admin services, payment/invoice services, document services, upload helpers, or private workflow internals.
  - Public vendor files do not display private terms/data such as private vendor, board contract, invoice, payment detail, approved vendor portal, insurance upload, license attachment, private documents, board-only, or admin-only as current rendered workflow.
- Required verification commands:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

### Previous Story Intelligence

- Story 1.1 established the public route group and `PublicNav`. A review finding moved `/login` into `(public)` after it dropped the public shell. Keep any vendor placeholder route inside `(public)`.
- Story 1.2 added real public home/about pages, shared static public content, a reusable empty-state component, and file-content tests.
- Story 1.3 added static public listing helpers plus privacy guardrails. Its review removed private-looking fixture data. Do not include private-looking vendor, contract, invoice, attachment, board, or approval fixture data.
- Story 1.4 added public events with deterministic helpers and public/private import guardrails. Continue the pattern of small public modules and focused Node tests.
- Story 1.5 added the public contact form and route handler. Vendor inquiries in Story 1.7 should reuse the general contact path; do not create a separate vendor mutation endpoint.
- Story 1.5 review fixed a production-safe delivery boundary: do not report success for workflows that do not really deliver/store data. Apply the same principle here: do not pretend a vendor proposal was submitted or queued.
- Story 1.6 added a public placeholder/entry pattern for later payment workflows. It also fixed a review finding where dynamic visible link text and `aria-label` diverged. Keep any dynamic labels aligned with accessible names.
- Existing tests are fast Node tests; they intentionally use file-content guardrails rather than importing TypeScript modules directly.
- The project currently has no `project-context.md`.

### Latest Technical Information

- Next.js Server Components can export static `metadata` when metadata does not depend on request data.
- Next.js route groups are folder names wrapped in parentheses; route group names are omitted from URLs, and routes in different groups must not resolve to the same URL path.
- Next.js Route Handlers use `route.ts` files for HTTP methods, but this story should not need a route handler.
- Current package versions use `next` `^16.0.0`, React `^19.0.0`, TypeScript `^5.0.0`, and Tailwind `^4.0.0`.
- Tailwind v4 is configured through `@tailwindcss/postcss` and `@import "tailwindcss";`; do not add Tailwind v3-style config unless a real need appears.

### Project Context Reference

- No `project-context.md` file was found.

### References

- [Epics: Story 1.7](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/epics.md)
- [Requirements: Vendor Applicant and Public Contact](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Architecture: Public Access and Future Modules](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Public Contact](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Tasks v1: Public Contact and Later Vendor Workflows](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Previous Story 1.6](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/stories/1-6-public-dues-payment-entry-point.md)
- [Later Story 8.5: Vendor Proposal and Approved Vendor Expansion Placeholder](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/epics.md)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npm test` red phase: failed on missing vendor placeholder config/page and contact guidance.
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run dev` with `curl` checks for `/vendors` and `/contact`

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Added static public vendor proposal placeholder settings with disabled-by-default MVP state, contact fallback, and future `/vendors/proposals` route constant.
- Added public `/vendors` placeholder page inside the `(public)` route group with one `h1`, visible focus styles, responsive button sizing, and no private workflow/data integrations.
- Updated the public contact page copy so vendor services inquiries remain general public contact requests and do not create portal access.
- Verified privacy guardrails, absence of vendor proposal API/private routes, and rendered route availability through tests, build, and local dev-server fetches.

### File List

- `_bmad-output/implementation-artifacts/1-7-public-vendor-proposal-placeholder.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/(public)/contact/page.tsx`
- `app/(public)/vendors/page.tsx`
- `docs/bmad/phase-4-tasks/sprint-status.yaml`
- `docs/bmad/phase-4-tasks/stories/1-7-public-vendor-proposal-placeholder.md`
- `lib/public/vendor-proposals.ts`
- `tests/public-shell.test.mjs`

### Change Log

- 2026-05-07: Created Story 1.7 context for public vendor proposal placeholder.
- 2026-05-07: Implemented public vendor proposal placeholder, contact fallback guidance, verification guardrails, and moved story to review.
- 2026-05-07: Addressed code review finding by broadening forbidden vendor workflow guardrail tests and moved story to done.
