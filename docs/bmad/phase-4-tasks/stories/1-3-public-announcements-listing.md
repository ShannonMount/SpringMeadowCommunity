# Story 1.3: Public Announcements Listing

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a public visitor,
I want to view official announcements marked public,
so that I can stay informed without needing portal access.

## Acceptance Criteria

1. Given published public announcements exist, when a visitor opens the public announcements page, then only announcements with public visibility and published status are displayed, and private, resident-only, board-only, admin-only, and property-specific announcements are excluded.
2. Given a public announcement has a publish date, expiration date, pinned state, or attachment, when the announcement is displayed, then the listing respects publish/expiration rules, highlights pinned announcements, and exposes only public-safe attachment links.
3. Given no public announcements are available, when the page loads, then a clear empty state is displayed, and no authorization details or private record counts are exposed.

## Tasks / Subtasks

- [x] Replace the public announcements placeholder with an official listing page. (AC: 1, 2, 3)
  - [x] Update `app/(public)/announcements/page.tsx` so it no longer renders `PlaceholderPage`.
  - [x] Add a public page header, short explanatory copy, and accessible list/empty-state regions.
  - [x] Keep the page inside the existing `(public)` route group so it retains `PublicNav`.
- [x] Add public-safe announcement data and filtering logic. (AC: 1, 2, 3)
  - [x] Add a small static/config module, such as `lib/public/announcements.ts`, with announcement records that model the future data contract.
  - [x] Include representative records for public published, pinned public published, future publish date, expired, archived, resident-only, board-only, property-specific, and draft announcements.
  - [x] Add a helper such as `getVisiblePublicAnnouncements(now?: Date)` that returns only `visibility === "public"`, `status === "published"`, `publishAt <= now`, and non-expired records.
  - [x] Sort pinned announcements first, then newest publish date first.
- [x] Render announcement metadata and public-safe attachment links. (AC: 2)
  - [x] Show title, summary/body excerpt, publish date, optional expiration label, and a visible pinned indicator.
  - [x] Render only attachments explicitly marked public-safe, using normal public links.
  - [x] Do not generate signed URLs, reference private document buckets, or expose private attachment IDs.
- [x] Add a polished empty state. (AC: 3)
  - [x] Provide a clear empty state when the filtered public announcement list is empty.
  - [x] Keep the empty state generic and privacy-safe; do not mention hidden/private counts, authorization, roles, or filtering internals.
- [x] Preserve accessibility, responsive layout, and public-data boundaries. (AC: 1, 2, 3)
  - [x] Use one page-level `h1`, clear section headings, semantic list/article markup, and meaningful link text.
  - [x] Ensure announcement cards remain readable on mobile and keyboard focus states are visible for links.
  - [x] Do not import `@/server/services`, `@/server/queries`, Supabase clients, auth helpers, resident/property/board/payment/document services, or admin workflows.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Extend `tests/public-shell.test.mjs` or add focused Node tests for public announcement filtering, pinned/date ordering, empty-state support, public-safe attachments, and private-data import guardrails.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
  - [x] Manually inspect the announcements page on desktop and mobile for readable, non-overlapping content.

### Review Findings

- [x] [Review][Patch] Static announcement fixture includes private-only labels and a private document path [lib/public/announcements.ts:41]

## Dev Notes

Story 1.3 builds on the completed public shell plus public home/about work. The announcements route already exists at `/announcements`, but it currently renders the generic placeholder component. This story should turn it into a real public listing surface while staying static/config-driven because the database, admin publishing workflow, document storage, and public content query layer are later work.

### Current Files To Update

- `app/(public)/announcements/page.tsx`
  - Current state: renders `PlaceholderPage` with title `Announcements`.
  - This story changes it into a real public announcements listing page.
  - Preserve: route path `/announcements` and public layout/navigation inherited from `app/(public)/layout.tsx`.
- `tests/public-shell.test.mjs`
  - Current state: lightweight Node file-content tests covering public shell, public routes, home/about content, empty-state support, image alt text, and private import guardrails.
  - This story should extend the same test style unless a better local test pattern is introduced.
- `lib/public/community-content.ts`
  - Current state: shared public-safe static content used by home/about.
  - This story can add a separate `lib/public/announcements.ts`; avoid overloading community content with announcement-specific filtering rules.

### Project Structure Notes

- Keep route code in `app/(public)/announcements/page.tsx`.
- Prefer announcement data and filtering in `lib/public/announcements.ts`.
- Add presentational components under `components/public/` only if they reduce repeated markup or improve readability.
- Do not create API routes, server actions, Supabase queries, admin screens, document upload logic, or database migrations in this story.
- Do not move `/announcements` out of `(public)`.

### Technical Requirements

- Use Next.js + TypeScript App Router and the existing Tailwind CSS setup.
- Keep the page as a Server Component. This story should not require client state.
- Use native `Date` comparisons for static announcement filtering. Make the filter helper accept `now?: Date` so tests can be deterministic.
- Use public-safe data shape fields such as:
  - `title`
  - `body` or `summary`
  - `visibility`
  - `status`
  - `pinned`
  - `publishAt`
  - `expiresAt`
  - `attachments?: { label: string; href: string; isPublic: boolean }[]`
- Public display must exclude hidden records by rule, not by comments or manual page omissions.
- Do not include owner names, property addresses, account numbers, dues balances, payment history, board-only information, private document IDs, or private attachment paths.

### Architecture Compliance

- Public visitors may read only public pages, public announcements, public events, public documents, and later public vendor proposal forms.
- Public announcements must be published and public. Resident-only, board-only, property-specific, draft, archived, expired, and future-published records must not render.
- Public-safe attachments may render as normal public links only. Private document downloads require later server-side permission checks and signed URLs.
- The future data model for announcements includes `visibility`, `status`, `pinned`, `publish_at`, `expires_at`, and `attachment_document_ids`; this story should mirror those concepts without implementing the database.
- Later Epic 4/admin stories own announcement creation, lifecycle management, auditing, resident-visible display, and database-backed queries.

### Library / Framework Requirements

- Current package versions use `next` `^16.0.0`, React `^19.0.0`, TypeScript `^5.0.0`, and Tailwind `^4.0.0`.
- Tailwind v4 is configured through `@tailwindcss/postcss` and `@import "tailwindcss";`; do not add Tailwind v3-style config unless a real need appears.
- Next.js static `metadata` exports are supported in Server Components and are appropriate when metadata does not depend on request data.
- Keep link text meaningful; avoid "click here" and ensure attachment links describe the destination.

### Testing Requirements

- Extend the existing Node test suite rather than adding broad E2E infrastructure.
- Minimum checks:
  - `app/(public)/announcements/page.tsx` no longer renders `PlaceholderPage`.
  - `lib/public/announcements.ts` exists and exports deterministic filter/sort behavior.
  - Public listing excludes non-public, draft, archived, expired, and future announcements.
  - Pinned public announcements sort before unpinned announcements.
  - Attachments render only when marked public-safe.
  - Empty-state copy exists and does not expose private counts, roles, or authorization details.
  - Public announcement files do not import private server services, private queries, auth helpers, Supabase clients, or document signed URL helpers.
- Required verification commands:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

### Previous Story Intelligence

- Story 1.1 established the public route group and `PublicNav`. A review finding moved `/login` into `(public)` after it dropped the public shell. Keep public navigation destinations inside `(public)`.
- Story 1.2 added real public home/about pages, shared static public content, a reusable empty-state component, and file-content tests.
- Existing tests are fast Node tests; they are intentionally focused on file structure, public-safe content, and guardrails.
- The project currently has no `project-context.md`.
- A stale Next dev-server lock was seen during Story 1.2 preview, but `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` passed.

### Latest Technical Information

- Next.js Server Components can export a static `metadata` object for page metadata when metadata does not depend on request information.
- Next.js route groups are folder names wrapped in parentheses; route group names are not included in the URL. Routes in different groups must not resolve to the same URL path.
- Tailwind v4 with Next.js uses `tailwindcss` plus `@tailwindcss/postcss`, with Tailwind imported via `@import "tailwindcss";`.

### Project Context Reference

- No `project-context.md` file was found.

### References

- [Epics: Story 1.3](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/epics.md)
- [Requirements: Announcements](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Architecture: Public Access and Documents](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Announcements](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Announcements](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Tasks v1: Public Announcements Page](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Previous Story 1.2](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/stories/1-2-public-home-and-community-information-pages.md)
- Next.js Metadata API: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- Next.js Route Groups: https://nextjs.org/docs/app/api-reference/file-conventions/route-groups
- Tailwind CSS v4 PostCSS Install: https://tailwindcss.com/docs/installation/using-postcss

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npm test` failed first because Story 1.3 tests referenced the missing `lib/public/announcements.ts`, then passed after adding the module and page.
- `npm test` initially could not import `.ts` directly from the `.mjs` test runner, so announcement tests were adjusted to the existing file-content guardrail style.
- `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` passed after implementation.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Replaced the announcements placeholder with an official public listing page using semantic sections, announcement cards, public attachment links, and a privacy-safe empty state.
- Added static public announcement data plus helpers for public visibility, published status, publish/expiration windows, pinned-first sorting, public-safe attachments, and date formatting.
- Extended the public shell test suite with announcement page, filtering, sorting, attachment, empty-state, and private-data guardrails.
- Resolved code review finding by removing private-looking attachment fixture data from the public announcement module.
- Verification passed: `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### File List

- `app/(public)/announcements/page.tsx`
- `lib/public/announcements.ts`
- `tests/public-shell.test.mjs`

### Change Log

- 2026-05-05: Created Story 1.3 context for public announcements listing.
- 2026-05-05: Implemented Story 1.3 public announcements listing with static public-safe filtering, metadata display, attachments, empty state, and tests.
- 2026-05-05: Addressed Story 1.3 code review finding by removing private attachment fixture data and strengthening tests.
