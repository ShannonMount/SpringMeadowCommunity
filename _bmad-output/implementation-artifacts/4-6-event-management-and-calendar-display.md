# Story 4.6: Event Management and Calendar Display

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a board/admin user,
I want to create and manage events with visibility controls,
so that public visitors, residents, and board/admin users see the right calendar items.

## Acceptance Criteria

1. Given a board/admin user has event management permission, when they create or update an event, then they can set title, description, type, visibility, start/end time, all-day state, location, related meeting/compliance links, and status, and cancelled and archived events are handled consistently.
2. Given a resident opens resident events or dashboard, when events are queried, then upcoming resident-visible events are displayed in list or calendar form, and board-only and admin-only events are excluded.
3. Given a public visitor opens public events, when events are queried, then only public events are displayed, and private calendar data is not exposed.

## Tasks / Subtasks

- [x] Add event schema, permission seed, authorization helper, and RPCs. (AC: 1, 2, 3)
  - [x] Add the next ordered migration after `supabase/migrations/202605110013_announcement_management_and_display.sql`, likely `supabase/migrations/202605110014_event_management_and_calendar_display.sql`.
  - [x] Create event visibility/status/type definitions deliberately. Visibility should match the current data model: `public`, `resident`, `board`, and `admin`. Status should include `scheduled`, `cancelled`, `completed`, and `archived`. Types should include at least `hoa_meeting`, `board_meeting`, `community_event`, `pool`, `maintenance_window`, `dues_deadline`, and `other`.
  - [x] Create `public.events` with `community_id`, title, description, type, visibility, `starts_at`, `ends_at`, `all_day`, location, `related_meeting_id`, `related_compliance_event_id`, status, creator/updater/canceller/archiver metadata, and timestamps.
  - [x] Do not add foreign keys to `meetings` or `compliance_calendar_events` unless those tables exist in the current migration chain. Store nullable UUID link fields only; later meeting/compliance stories can add real relationships.
  - [x] Add indexes for calendar/feed queries: `(community_id, visibility, starts_at)`, `(community_id, status, starts_at)`, `(community_id, type, starts_at)`, and any bounded search/filter indexes needed by the RPC.
  - [x] Enable RLS, revoke direct table grants from `anon` and `authenticated`, and expose all access through security-definer RPCs with explicit `search_path`.
  - [x] Seed `admin.events.manage` onto the appropriate system roles, following the 4.5 announcement pattern. Board users may manage events only if they have this permission; route location alone is not authorization.
  - [x] Add `app.can_read_event(target_event_id uuid)` or equivalent. Public users may read only non-archived public events. Residents may read non-archived public and resident events when they have active membership in the same community. Board/admin users with event permission may read all authorized community event records.
  - [x] Add safe JSON helpers/RPC return shapes for event records. Public and resident callers must not receive internal `related_meeting_id`, `related_compliance_event_id`, raw profile IDs, audit IDs, role permissions, raw SQL errors, owner names, account numbers, payment data, or private document/storage fields.
  - [x] Add RPCs for `list_events`, `create_event`, `update_event`, `cancel_event`, and `archive_event`. Mutating RPCs must check `admin.events.manage`, validate community scope, validate timestamps and enum values, and return safe status unions.
  - [x] Implement audit logging in exactly one layer. Prefer best-effort SQL audit insertion inside the mutation RPCs, using `exception when others then null`, and do not duplicate audit writes from the TypeScript service.
- [x] Add a server-only event service. (AC: 1, 2, 3)
  - [x] Add `server/services/events/event-management.ts` with `import "server-only"`.
  - [x] Follow the safe union-result style used by `server/services/announcements/announcement-management.ts` and the document/payment services.
  - [x] Validate title, description, type, visibility, status, all-day flag, start/end timestamps, location, optional related IDs, page size, page offset, search query, and filters before calling RPCs.
  - [x] Preserve HOA-local time handling for admin `datetime-local` inputs by converting values as `America/New_York`, following the fixed announcement action pattern. Do not pass browser-local `datetime-local` strings directly to `new Date(...)`.
  - [x] Use `createClient()` for user-scoped RPC calls. Do not direct-query `events` from public/resident/client-facing code.
  - [x] Return safe event records and typed states only: `records`, `record`, `created`, `updated`, `cancelled`, `archived`, `invalid-input`, `unauthenticated`, `profile-unavailable`, `permission-denied`, and `events-unavailable`.
  - [x] Keep service-role clients, raw SQL errors, permission internals, related private IDs for non-managers, owner/profile data, account numbers, payment details, and audit IDs out of returned results.
- [x] Add admin event actions and management page. (AC: 1)
  - [x] Add `server/actions/events.ts` with `"use server"` actions for create/update/cancel/archive, using redirect outcomes like the announcement and admin payment actions.
  - [x] Add `app/(admin)/admin/events/page.tsx` for a compact operational management page. Use the current admin documents/payments/delinquency/announcements pages as layout and safe-message precedents.
  - [x] Provide create/edit controls for title, description, type, visibility, start date/time, end date/time, all-day state, location, related meeting ID, related compliance event ID, and status.
  - [x] Include compact lifecycle actions for cancel and archive on records returned by authorized listing. If status is editable, ensure cancel/archive actions still use the service/RPC path and audit trail.
  - [x] Add filters/pagination for status, visibility, type, query, and date window as needed for admin scanning.
  - [x] Render only generic action messages such as created/updated/cancelled/archived/invalid/denied/unavailable. Do not render raw errors, audit internals, or authorization details.
- [x] Replace public event display with database-backed public-safe listing. (AC: 3)
  - [x] Update `app/(public)/events/page.tsx` to call the server-only event service from the server component instead of `lib/public/events.ts` static fixtures.
  - [x] Preserve route `/events`, metadata, semantic layout, accessible headings, `<time dateTime>` markup, cancelled status context, empty state, and contact fallback.
  - [x] Public output must include only `public` visibility events that are not archived. It may include upcoming/current events plus a small recent-completed/cancelled window if the current public UX keeps that behavior.
  - [x] Do not expose resident/board/admin labels, private counts, private event categories, related meeting/compliance IDs, profile IDs, audit data, raw SQL errors, or private workflow paths in public markup.
  - [x] Remove, delete, or narrow `lib/public/events.ts` only if tests are updated precisely to preserve Story 1.4's privacy intent.
- [x] Add resident event display and dashboard integration. (AC: 2)
  - [x] Update `app/(resident)/portal/(member)/events/page.tsx` from placeholder to authorized resident event listing.
  - [x] Use existing membership gate patterns from `app/(resident)/portal/(member)/documents/page.tsx`, `app/(resident)/portal/(member)/announcements/page.tsx`, and `getResidentPortalMemberships()`.
  - [x] List upcoming/current public and resident-visible non-archived events. Exclude board-only, admin-only, archived, and internal link data.
  - [x] Update `server/services/auth/resident-dashboard.ts` so upcoming dashboard events come from the event service instead of static `lib/resident/dashboard-content.ts`.
  - [x] Stop using `getDashboardEvents()` from `lib/resident/dashboard-content.ts`; delete or narrow that file only if announcement dashboard behavior from Story 4.5 stays intact.
  - [x] Keep dashboard event lists small, sorted by `startsAt`, and generic when event data is unavailable. Do not fail the whole dashboard just because the event list is temporarily unavailable.
  - [x] Do not render property account numbers, owner names, payment details, private document metadata, related meeting/compliance IDs, audit data, or raw errors in resident event surfaces.
- [x] Preserve boundaries and avoid scope creep. (AC: 1, 2, 3)
  - [x] Do not implement compliance calendar workflows, compliance reminders, meeting notice windows, minutes, attendance, RSVP, recurring events, iCal export, email/push notifications, or legal-sensitive calendar rules in this story.
  - [x] Do not implement property-specific events unless the data model and acceptance criteria are explicitly changed. Current event visibility has no `property_specific` value.
  - [x] Do not create event document upload, image upload, rich text, Markdown rendering, or attachment workflows.
  - [x] Do not import `createServiceRoleClient`, Storage bucket names, document download internals, payment services, Stripe services, Resend services, or compliance workflow internals into public/resident pages or client components.
  - [x] Do not weaken existing public document, announcement, resident dashboard, payment, auth, or role guardrails.
  - [x] Because Story 4.5 is still marked `in-progress`, check its current files before implementing and do not assume review findings are done unless the current code proves it.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add `tests/event-management.test.mjs`.
  - [x] Test the migration creates the event table, event enum/check constraints, permission seed, RLS/revokes, indexes, `app.can_read_event`, safe list/mutation RPCs, best-effort audit behavior, and no broad table grants.
  - [x] Test the migration does not create foreign keys to not-yet-existing `meetings` or `compliance_calendar_events` tables unless those tables are present in the current repo.
  - [x] Test the service is server-only, validates inputs, calls event RPCs through `createClient()`, returns safe unions, handles unauthenticated/profile/permission states, and avoids raw errors, service-role keys, storage fields, account numbers, owner data, payment data, audit IDs, and private related IDs.
  - [x] Test admin actions and page include create/update/cancel/archive controls with safe redirect outcomes and America/New_York conversion for `datetime-local` values.
  - [x] Test public events use the database-backed service, preserve public-only/non-archived filtering, status/type labels, empty state, `<time>` markup, and no private metadata leakage.
  - [x] Test resident events and dashboard use authorized event service results, include public/resident upcoming events, exclude board/admin/archived records, and do not rely on static event fixtures.
  - [x] Update `tests/public-shell.test.mjs` and `tests/resident-dashboard-summary.test.mjs` only where Story 4.6 intentionally replaces static event fixtures; keep their original privacy intent intact.
  - [x] Run `node --test tests/event-management.test.mjs`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Review Findings

- [x] [Review][Patch] Admin event filters parse `datetime-local` values in the server timezone instead of `America/New_York` [app/(admin)/admin/events/page.tsx:510]

## Dev Notes

Story 4.6 turns the event placeholder and static public/resident event fixtures into the database-backed content workflow. It should mirror the successful shape of Story 4.5 announcements, but it must not copy 4.5 blindly: events have time ranges, all-day behavior, cancellation, archived hiding, and future links to meetings/compliance records that should remain inert UUID fields until those modules exist.

### Current Files To Update

- `lib/public/events.ts`
  - Current state: static in-memory event fixtures with public filtering helpers, event labels, and date/time formatting. It intentionally includes resident, board, admin, cancelled, completed, and archived sample records to prove public filtering.
  - Change: replace static data usage with database-backed service calls, or narrow the file to public-safe formatting/type helpers if useful.
  - Preserve: public pages must not expose resident, board, admin, archived, private meeting/compliance, property, payment, document, or workflow details.
- `app/(public)/events/page.tsx`
  - Current state: server component using `getVisiblePublicEvents()` from `lib/public/events.ts`; renders public event cards, type/status labels, cancelled styling, `<time>` markup, and empty state.
  - Change: call the new event service with public/non-archived filters and render returned public-safe records.
  - Preserve: route `/events`, metadata, public shell, semantic list/article/dl structure, visible cancellation context, and generic empty state.
- `app/(resident)/portal/(member)/events/page.tsx`
  - Current state: placeholder under the active-member resident portal shell.
  - Change: render authorized resident event list/calendar-like view for upcoming/current public and resident-visible events.
  - Preserve: member-only route group, no client-side authorization source of truth, no board/admin/private details.
- `server/services/auth/resident-dashboard.ts`
  - Current state: server-only resident dashboard service. Announcements are now DB-backed through Story 4.5, while upcoming events still come from `getDashboardEvents()` static fixtures.
  - Change: fetch dashboard events through the new event service after membership resolution.
  - Preserve: property summary authorization, balance/pay gates, announcement behavior from 4.5, safe dashboard union results, and no raw database errors.
- `lib/resident/dashboard-content.ts`
  - Current state: static dashboard event helper importing `publicEvents`; announcement helpers have already been removed or stopped after 4.5.
  - Change: stop using static event fixtures for dashboard event data. Remove the event helper if no remaining import uses it.
  - Preserve: do not reintroduce static announcement fixture logic removed by 4.5.
- `server/services/announcements/announcement-management.ts`, `server/actions/announcements.ts`, and `app/(admin)/admin/announcements/page.tsx`
  - Current state: closest working pattern for DB-backed content management, validation, safe union results, admin redirect outcomes, `datetime-local` conversion, and public/resident display integration.
  - Change: do not edit unless a shared helper is truly needed. Use these as implementation precedent for events.
- `tests/public-shell.test.mjs`
  - Current state: still asserts public events come from static `getVisiblePublicEvents()` and `lib/public/events.ts`.
  - Change: update event-related assertions to the new service/RPC-backed behavior while keeping public privacy guardrails.
- `tests/resident-dashboard-summary.test.mjs`
  - Current state: still asserts dashboard event summaries come from `lib/resident/dashboard-content.ts` and static `publicEvents`.
  - Change: update event-related assertions to the new event service while preserving dashboard privacy and small-list guardrails.

### New Files Likely Needed

- `supabase/migrations/202605110014_event_management_and_calendar_display.sql`
- `server/services/events/event-management.ts`
- `server/actions/events.ts`
- `app/(admin)/admin/events/page.tsx`
- `tests/event-management.test.mjs`

Optional only if it reduces duplication without moving authorization client-side:

- `server/services/events/event-formatting.ts`
- `components/public/event-list.tsx`
- `components/resident/resident-event-list.tsx`

Do not add event authorization or protected data fetching under `lib/public`, public/resident client components, or browser Supabase helpers.

### Suggested Service Contract

Use a narrow contract similar to:

```ts
type EventVisibility = "public" | "resident" | "board" | "admin";
type EventStatus = "scheduled" | "cancelled" | "completed" | "archived";
type EventType =
  | "hoa_meeting"
  | "board_meeting"
  | "community_event"
  | "pool"
  | "maintenance_window"
  | "dues_deadline"
  | "other";

type EventRecord = {
  id: string;
  communityId: string;
  title: string;
  description: string | null;
  type: EventType;
  visibility: EventVisibility;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  location: string | null;
  relatedMeetingId: string | null;
  relatedComplianceEventId: string | null;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
};
```

Public and resident callers should receive `relatedMeetingId` and `relatedComplianceEventId` as `null` or omitted. Admin callers may receive them for management if authorized.

Mutation results should return safe unions: `created`, `updated`, `cancelled`, `archived`, `invalid-input`, `unauthenticated`, `profile-unavailable`, `permission-denied`, and `events-unavailable`.

### Authorization And Display Rules

- Public visitors may see only `visibility = public` events where `status <> archived`. Do not reveal that resident, board, admin, archived, or internal events exist.
- Resident event pages may show public and resident events for active members in the same community, excluding board/admin/archived records.
- Resident dashboard should show only a small upcoming list, sorted by `startsAt`, normally `status = scheduled` and `starts_at`/`ends_at` not already past.
- Public listing may keep Story 1.4's useful UX of upcoming/current events first plus recent completed/cancelled public events. Keep the display window bounded and do not show archived events.
- Board/admin management should be permission-backed by `admin.events.manage`. The page route alone is not authorization.
- `ends_at` must be null or after `starts_at`. All-day events still need valid start time storage; UI may render them as all-day and avoid misleading time ranges.
- Related meeting/compliance IDs are internal references. They are admin inputs only in this story and should not be linked to non-existent pages.
- Cancelled events should remain visible to public/residents when otherwise relevant, with clear visible status text. Archived events should be hidden from public/resident surfaces.

### Public, Resident, And Admin UI Rules

- Public page: keep the existing editorial, scannable public event list. It is not a landing page and should render actual event records immediately.
- Resident events page: keep the resident portal style, with compact event cards or a simple list/calendar-like grouping by date. Avoid a heavy calendar library unless the repo already has one.
- Resident dashboard: keep event summaries short. Do not add interactivity that requires a client component unless the event page itself needs it.
- Admin page: compact operational form plus list is enough. Use native inputs, selects, checkboxes, `datetime-local`, textarea, and action buttons.
- Use `America/New_York` for displayed event dates/times and admin date/time form round-trips.
- Use a single page-level `h1`, clear section headings, semantic lists/articles, machine-readable `<time dateTime="...">`, visible focus states, and no overlapping text at mobile widths.
- Do not use visible UI text to explain database permissions, implementation status, test strategy, or internal filtering rules.

### Previous Story Intelligence

- Story 1.4 created the static public event listing in `lib/public/events.ts` and `app/(public)/events/page.tsx`. 4.6 may replace the static source, but must preserve public-only filtering, archived exclusion, cancelled status context, date/time formatting, semantic markup, and private-data guardrails.
- Story 2.7 added resident dashboard events from static helpers. 4.6 should move dashboard events to the DB-backed event service without changing dues/payment/property summary behavior.
- Story 4.3 and 4.4 established the rule that pages may render authorized records but must not leak private storage, IDs, counts, or existence through UI failure states. Apply the same discipline to private events and related links.
- Story 4.5 announcement management is the closest content-management precedent. Reuse its server-only RPC/service/page/action style, but do not repeat resolved 4.5 issues: no property/related ID leaks to public/resident callers, no double audit writes, and no timezone-dependent `datetime-local` handling.
- Story 4.5 is currently marked `in-progress` in sprint status. Before implementing 4.6, read current 4.5 files and tests rather than assuming the story artifact exactly matches the code.
- Existing tests are fast `node:test` source-inspection guardrails. Add focused event tests and narrowly update older static-event expectations.

### Testing Requirements

- Follow the repo's existing `node:test` source-inspection style. There is no live Supabase integration harness.
- Include ordering/negative assertions where they prevent real mistakes:
  - Mutating RPCs must check `admin.events.manage` before insert/update/cancel/archive.
  - Audit insertion must be best effort and not duplicated in the TypeScript service.
  - Event service must validate input before `.rpc(...)`.
  - Public/resident/client-facing files must not import `createServiceRoleClient`, storage internals, payment services, Resend services, `audit_logs`, or admin permission strings.
- Update public event tests from static fixture expectations to service/RPC-backed expectations. Keep assertions for public-only filtering, archived exclusion, cancelled labels, type/status labels, empty state, `<time>` markup, and privacy-safe content.
- Update dashboard tests from static fixture expectations to event-service expectations. Keep assertions for public/resident visibility only, small upcoming limit, board/admin exclusion, and generic errors.
- Required verification commands:
  - `node --test tests/event-management.test.mjs`
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `git diff --check`

### Current Local Technical Information

- Current dependencies from `package.json`: Next.js `^16.0.0`, React `^19.0.0`, `@supabase/ssr` `^0.10.3`, `@supabase/supabase-js` `^2.105.3`, Stripe `^22.1.1`, Resend `^6.12.3`, Tailwind CSS `^4.0.0`, and TypeScript `^5.0.0`.
- `package.json` scripts: `npm test` runs `node --test tests/*.test.mjs`; `npm run lint` delegates to `npm run typecheck`; `npm run build` uses Next/Turbopack.
- No `project-context.md` file was found during story creation.
- Git history only shows initial scaffold commits; current story files, migrations, services, pages, and tests are more useful than commit history.
- The workspace already has many pre-existing modified/untracked files from earlier stories. Do not revert unrelated changes.
- No `public.events` table or event RPCs exist yet. The current event implementation is static fixture data only.
- The current latest migration is `supabase/migrations/202605110013_announcement_management_and_display.sql`.

### Latest Technical Information

- Next.js forms can invoke Server Actions through `action` and button-level `formAction`; authorization must still be checked inside the Server Action because those endpoints are callable directly. Source: https://nextjs.org/docs/app/guides/forms
- Supabase recommends enabling Row Level Security on exposed-schema tables and granting only the minimum role permissions needed. Source: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase JavaScript calls Postgres functions with `supabase.rpc(functionName, args)`, matching the current service/RPC pattern. Source: https://supabase.com/docs/reference/javascript/rpc

### Project Structure Notes

- Event database/RPC changes belong in a new ordered migration. Do not edit historical migrations for convenience.
- Server-only event business logic belongs under `server/services/events/...` with `import "server-only"`.
- Admin event form actions belong under `server/actions/events.ts`.
- Public display belongs in `app/(public)/events/page.tsx`; resident display belongs in `app/(resident)/portal/(member)/events/page.tsx`; admin management belongs in `app/(admin)/admin/events/page.tsx`.
- Static verification belongs in `tests/event-management.test.mjs`, with precise updates to existing public/dashboard tests.
- Do not place private event authorization, mutation logic, or protected Supabase calls in `lib/public`, client components, or browser-accessible helpers.

### Project Context Reference

- No `project-context.md` file was found.

### References

- [Epics: Story 4.6](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Requirements: Events and Public Privacy](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Architecture: Public, Resident, and Board/Admin Access](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [Data Model: Events](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [API Design: Events API](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Tasks: TASK-DB-013, TASK-FE-008, TASK-PAGE-004, TASK-PAGE-010, TASK-PAGE-023, TASK-CONTENT-002](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Previous Story 4.5](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/4-5-announcement-management-and-resident-public-display.md)
- [Previous Public Event Story 1.4](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/1-4-public-events-listing.md)
- [Resident Dashboard Story 2.7](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-7-resident-dashboard-summary.md)
- [Public Events Page](/home/smount/Websites/SpringMeadowCommunity/app/(public)/events/page.tsx)
- [Public Event Fixture](/home/smount/Websites/SpringMeadowCommunity/lib/public/events.ts)
- [Resident Events Page](/home/smount/Websites/SpringMeadowCommunity/app/(resident)/portal/(member)/events/page.tsx)
- [Resident Dashboard Service](/home/smount/Websites/SpringMeadowCommunity/server/services/auth/resident-dashboard.ts)
- [Resident Dashboard Content Helper](/home/smount/Websites/SpringMeadowCommunity/lib/resident/dashboard-content.ts)
- [Announcement Service Pattern](/home/smount/Websites/SpringMeadowCommunity/server/services/announcements/announcement-management.ts)
- [Announcement Actions Pattern](/home/smount/Websites/SpringMeadowCommunity/server/actions/announcements.ts)
- [Announcement Admin Page Pattern](/home/smount/Websites/SpringMeadowCommunity/app/(admin)/admin/announcements/page.tsx)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `node --test tests/event-management.test.mjs`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented the event management schema/RPC layer with event enums, permission seeding, RLS, safe JSON return shapes, public/resident read authorization, mutation RPCs, and best-effort SQL audit logging.
- Added the server-only event service and admin event actions/page with America/New_York `datetime-local` conversion, safe redirects, lifecycle controls, filtering, and pagination.
- Replaced static public event fixtures with DB-backed public event listing while retaining public-safe formatting helpers, empty states, status labels, and semantic `<time>` markup.
- Added resident event listing and moved resident dashboard event summaries to the event service with small, sorted, public/resident-only upcoming event results.
- Updated event, public shell, resident dashboard, and announcement guardrail tests to reflect the DB-backed event workflow and removal of static dashboard event fixtures.

### File List

- `app/(admin)/admin/events/page.tsx`
- `app/(public)/events/page.tsx`
- `app/(resident)/portal/(member)/events/page.tsx`
- `_bmad-output/implementation-artifacts/4-6-event-management-and-calendar-display.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `lib/public/events.ts`
- `lib/resident/dashboard-content.ts` (deleted)
- `server/actions/events.ts`
- `server/services/auth/resident-dashboard.ts`
- `server/services/events/event-management.ts`
- `supabase/migrations/202605110014_event_management_and_calendar_display.sql`
- `tests/announcement-management.test.mjs`
- `tests/event-management.test.mjs`
- `tests/public-shell.test.mjs`
- `tests/resident-dashboard-summary.test.mjs`

### Change Log

- 2026-05-16: Created Story 4.6 context for event management and calendar display.
- 2026-05-16: Completed event management and calendar display implementation; moved story to review.
