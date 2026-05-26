# Story 1.4: Public Events Listing

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a public visitor,
I want to view public community events,
so that I can see relevant HOA meetings, community events, and public deadlines.

## Acceptance Criteria

1. Given public events exist, when a visitor opens the public events page, then only events marked public are displayed, and resident-only, board-only, and admin-only events are excluded.
2. Given an event includes date, time, location, description, type, and status, when the event appears in the list or calendar view, then the visitor can understand when and where the event occurs, and cancelled or archived events are handled according to their status.
3. Given the visitor uses a small screen or keyboard navigation, when they browse events, then event content remains readable, reachable, and non-overlapping.

## Tasks / Subtasks

- [x] Replace the public events placeholder with an official event listing page. (AC: 1, 2, 3)
  - [x] Update `app/(public)/events/page.tsx` so it no longer renders `PlaceholderPage`.
  - [x] Add a public page header, explanatory copy, and semantic event list or calendar-style sections.
  - [x] Keep the page inside the existing `(public)` route group so it retains `PublicNav`.
- [x] Add public-safe event data and filtering logic. (AC: 1, 2)
  - [x] Add a small static/config module, such as `lib/public/events.ts`, with event records that model the future data contract.
  - [x] Include representative records for public scheduled events, public cancelled events, completed public events, archived public events, resident-only events, board-only events, admin-only events, and future public deadlines.
  - [x] Add a helper such as `getVisiblePublicEvents(now?: Date)` that returns only public events that should be visible on the public page.
  - [x] Sort upcoming/current public events first by start date, and keep cancelled public events visible only when they are otherwise in the display window.
- [x] Render complete public event details. (AC: 2, 3)
  - [x] Show event title, type label, date, time or all-day label, location when public-safe, description, and status.
  - [x] Visibly distinguish cancelled events without hiding the cancellation context.
  - [x] Do not render archived events on the public listing.
- [x] Add a polished empty state. (AC: 3)
  - [x] Provide a clear empty state when there are no visible public events.
  - [x] Keep the empty state generic and privacy-safe; do not mention hidden/private counts, authorization, roles, or filtering internals.
- [x] Preserve accessibility, responsive layout, and public-data boundaries. (AC: 1, 2, 3)
  - [x] Use one page-level `h1`, clear section headings, semantic list/article markup, meaningful link text, and machine-readable `<time dateTime="...">` elements.
  - [x] Ensure event cards remain readable on mobile and keyboard focus states are visible for any links.
  - [x] Do not import `@/server/services`, `@/server/queries`, Supabase clients, auth helpers, resident/property/board/payment/document services, admin workflows, or compliance workflow internals.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Extend `tests/public-shell.test.mjs` or add focused Node tests for public event filtering, status handling, date/time rendering helpers, empty-state support, and private-data import guardrails.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
  - [x] Manually inspect the events page on desktop and mobile for readable, non-overlapping content.

## Dev Notes

Story 1.4 builds on the public shell plus the static/config-driven listing pattern established in Story 1.3. The events route already exists at `/events`, but it currently renders the generic placeholder component. This story should turn it into a real public listing surface while staying static/config-driven because the database, admin event workflow, resident dashboard event display, and public content query layer are later work.

### Current Files To Update

- `app/(public)/events/page.tsx`
  - Current state: renders `PlaceholderPage` with title `Events`.
  - This story changes it into a real public events listing page.
  - Preserve: route path `/events` and public layout/navigation inherited from `app/(public)/layout.tsx`.
- `tests/public-shell.test.mjs`
  - Current state: lightweight Node file-content tests covering public shell, public routes, home/about content, announcement listing guardrails, empty-state support, and private import guardrails.
  - This story should extend the same test style unless a better local test pattern is introduced.
- `lib/public/announcements.ts`
  - Current state: static public announcement data plus deterministic visibility/sort helpers.
  - Reuse the pattern, not the module. Add separate event logic in `lib/public/events.ts`.

### Project Structure Notes

- Keep route code in `app/(public)/events/page.tsx`.
- Prefer event data and filtering in `lib/public/events.ts`.
- Add presentational components under `components/public/` only if they reduce repeated markup or improve readability.
- Do not create API routes, server actions, Supabase queries, admin screens, compliance calendar screens, document upload logic, or database migrations in this story.
- Do not move `/events` out of `(public)`.

### Technical Requirements

- Use Next.js + TypeScript App Router and the existing Tailwind CSS setup.
- Keep the page as a Server Component. This story should not require client state.
- Use native `Date` comparisons for static event filtering. Make filter/sort helpers accept `now?: Date` so tests can be deterministic.
- Use public-safe data shape fields aligned with the future model:
  - `title`
  - `description`
  - `type`
  - `visibility`
  - `startsAt`
  - `endsAt`
  - `allDay`
  - `location`
  - `status`
- Public display must exclude hidden records by rule, not by comments or manual page omissions.
- Do not include owner names, property addresses, account numbers, dues balances, payment history, board-only context, admin-only context, private document IDs, meeting IDs, compliance event IDs, or private workflow paths.

### Architecture Compliance

- Public visitors may read only public pages, public announcements, public events, public documents, and later public vendor proposal forms.
- Public events must be public. Resident-only, board-only, admin-only, and archived records must not render.
- Cancelled public events may render when they are still relevant to public visitors, but must be clearly marked cancelled.
- The future data model for events includes `type`, `visibility`, `starts_at`, `ends_at`, `all_day`, `location`, `related_meeting_id`, `related_compliance_event_id`, and `status`; this story should mirror public-safe concepts without implementing the database or exposing related private IDs.
- Later Epic 4/admin stories own event creation, lifecycle management, resident-visible display, calendar management, and database-backed queries.

### Library / Framework Requirements

- Current package versions use `next` `^16.0.0`, React `^19.0.0`, TypeScript `^5.0.0`, and Tailwind `^4.0.0`.
- Tailwind v4 is configured through `@tailwindcss/postcss` and `@import "tailwindcss";`; do not add Tailwind v3-style config unless a real need appears.
- Next.js static `metadata` exports are supported in Server Components and are appropriate when metadata does not depend on request data.
- Next.js route groups are organizational and omitted from URLs; avoid conflicting routes in other groups.
- Use `<time dateTime="...">` for event dates/times where practical.

### Testing Requirements

- Extend the existing Node test suite rather than adding broad E2E infrastructure.
- Minimum checks:
  - `app/(public)/events/page.tsx` no longer renders `PlaceholderPage`.
  - `lib/public/events.ts` exists and exports deterministic filter/sort/format helpers.
  - Public listing excludes resident-only, board-only, admin-only, and archived events.
  - Cancelled public events are represented and visibly marked when rendered.
  - Event detail fields include type, date/time or all-day label, location, description, and status.
  - Empty-state copy exists and does not expose private counts, roles, authorization details, or filtering internals.
  - Public event files do not import private server services, private queries, auth helpers, Supabase clients, compliance internals, or document signed URL helpers.
- Required verification commands:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

### Previous Story Intelligence

- Story 1.1 established the public route group and `PublicNav`. A review finding moved `/login` into `(public)` after it dropped the public shell. Keep public navigation destinations inside `(public)`.
- Story 1.2 added real public home/about pages, shared static public content, a reusable empty-state component, and file-content tests.
- Story 1.3 added the static public listing pattern in `lib/public/announcements.ts`, deterministic visibility/sort helpers, metadata display, public-safe links, and stronger private-data guardrails.
- Story 1.3 code review removed private-looking attachment fixture data. Do not include private-looking fixture IDs, labels, hrefs, meeting IDs, compliance IDs, document paths, or workflow paths in public event data.
- Existing tests are fast Node tests; they are intentionally focused on file structure, public-safe content, and guardrails.
- The project currently has no `project-context.md`.

### Latest Technical Information

- Next.js Server Components can export a static `metadata` object for page metadata when metadata does not depend on request information.
- Next.js route groups are folder names wrapped in parentheses; route group names are not included in the URL. Routes in different groups must not resolve to the same URL path.
- Tailwind v4 with Next.js uses `tailwindcss` plus `@tailwindcss/postcss`, with Tailwind imported via `@import "tailwindcss";`.

### Project Context Reference

- No `project-context.md` file was found.

### References

- [Epics: Story 1.4](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/epics.md)
- [Requirements: Events](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Architecture: Public Access](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Events](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Events](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Tasks v1: Public Events Page](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Previous Story 1.3](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/stories/1-3-public-announcements-listing.md)
- Next.js Metadata API: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- Next.js Route Groups: https://nextjs.org/docs/app/api-reference/file-conventions/route-groups
- Tailwind CSS v4 PostCSS Install: https://tailwindcss.com/docs/installation/using-postcss

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-05: Red phase confirmed with `npm test` failing before `lib/public/events.ts` existed and before the placeholder was replaced.
- 2026-05-05: Green/refactor validation passed with `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- 2026-05-05: Render check passed by serving the production build on port 3001 and fetching `/events`; output included public nav, event cards, `<time>` markup, cancelled/completed/scheduled labels, and no hidden event records.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Replaced the `/events` placeholder with a static public events listing that keeps the route inside the public shell.
- Added public-safe event fixtures, deterministic visibility/window filtering, upcoming-first sorting, status/type labels, and date/time formatting helpers.
- Rendered full public event details with semantic list/article/dl markup, machine-readable times, cancelled event styling, and a privacy-safe empty state.
- Extended public shell tests for event rendering, filter/sort behavior, status handling, empty state copy, and private import/content guardrails.

### File List

- `app/(public)/events/page.tsx`
- `lib/public/events.ts`
- `tests/public-shell.test.mjs`
- `docs/bmad/phase-4-tasks/stories/1-4-public-events-listing.md`
- `_bmad-output/implementation-artifacts/1-4-public-events-listing.md`
- `docs/bmad/phase-4-tasks/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-05: Created Story 1.4 context for public events listing.
- 2026-05-05: Implemented public events listing and moved story to review.
