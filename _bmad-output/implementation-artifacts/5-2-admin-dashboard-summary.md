# Story 5.2: Admin Dashboard Summary

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a board/admin user,
I want an operations dashboard,
so that I can quickly see the state of properties, payments, documents, messages, compliance deadlines, and overdue work.

## Acceptance Criteria

1. Given a board/admin user has dashboard permission, when the dashboard loads, then it displays permission-scoped summaries for properties, payments, documents, messages, compliance deadlines, and overdue tasks, and all data is scoped to the current community.
2. Given a summary area has no available records, when the dashboard renders, then it displays a useful empty state and avoids exposing unauthorized counts or internal query details.
3. Given a user lacks permission for a dashboard section, when the dashboard renders, then that section is hidden or replaced with a permission-aware state, and unauthorized data is not fetched for display.

## Tasks / Subtasks

- [x] Add a server-only admin dashboard summary service. (AC: 1, 2, 3)
  - [x] Add `server/services/admin/dashboard-summary.ts` with `import "server-only"`.
  - [x] Treat Story 5.1's `board.workspace.access` as the dashboard permission. Do not add a new dashboard permission or role migration unless the product owner explicitly asks.
  - [x] Resolve the default `spring-meadow-community` community using the same user-scoped Supabase pattern as `server/services/auth/admin-workspace.ts`; do not use `createServiceRoleClient`.
  - [x] Return safe discriminated unions such as `dashboard`, `unauthenticated`, `profile-unavailable`, `permission-denied`, `dashboard-unavailable`, and optionally `section-unavailable`.
  - [x] Gate each data section before querying it. Payments must require `admin.payments.manage`; documents must require `admin.documents.manage` or `board.documents.view`; messages must require `admin.messages.manage`; audit/log/monitoring data is out of scope for this story.
  - [x] Do not fetch or return raw private fields: owner names, account numbers, public payment codes, guest payer contact fields, message bodies, document storage paths/buckets, Stripe identifiers, audit row internals, raw Supabase errors, or provider secrets.

- [x] Add a safe aggregate backend for dashboard summaries. (AC: 1, 2, 3)
  - [x] Prefer one focused migration/RPC, for example `supabase/migrations/202605110018_admin_dashboard_summary.sql` with `public.get_admin_dashboard_summary(target_community_slug text default 'spring-meadow-community') returns jsonb`.
  - [x] Make the RPC `security definer`, explicitly check `app.current_profile_id()` and `app.has_permission(target_community_id, 'board.workspace.access')`, revoke public execution, and grant execute only to `authenticated`.
  - [x] Compute only aggregate counts/status totals for authorized sections. Do not return row-level property, payment, document, or message records.
  - [x] Property summary may be gated by workspace access for this story because no separate property read/manage permission exists yet; keep it aggregate-only: active property count, inactive/archived count, due-soon/overdue/delinquent/lien-review counts, and next due date count are sufficient.
  - [x] Payments summary must only compute when `app.has_permission(target_community_id, 'admin.payments.manage')`; suggested aggregates: pending count, failed count, succeeded payments in the last 30 days, succeeded amount in the last 30 days, and manual/offline payments pending review if derivable.
  - [x] Documents summary must only compute when the actor can manage or view board documents; suggested aggregates: active document count, expiring soon count, board/admin/property-specific count, and recently uploaded count.
  - [x] Messages summary must only compute when `admin.messages.manage` is present; suggested aggregates: open count, pending board count, pending resident count, unassigned count, and oldest open timestamp if useful.
  - [x] Compliance deadlines and overdue compliance tasks are not backed by migrations yet; Story 6.1 owns `compliance_calendar_events` and `compliance_tasks`. For 5.2, return a permission-aware `not_configured` or empty-state section without querying missing tables or creating the compliance schema early.
  - [x] Overdue work may include existing overdue property/assessment signals from `properties.delinquency_status`, `properties.next_due_date`, and unpaid `assessments` if the dashboard actor has workspace access. Do not duplicate the full delinquency report UI from Story 3.9.

- [x] Replace the minimal `/admin` landing page with the real summary UI. (AC: 1, 2, 3)
  - [x] Update `app/(admin)/admin/page.tsx` to call the new dashboard service from a Server Component.
  - [x] Keep the route under the existing `app/(admin)/admin/layout.tsx` guard and `components/admin/admin-workspace-nav.tsx` navigation from Story 5.1.
  - [x] Render a compact operational dashboard, not a landing page: concise heading, grid or bands of summary metrics, section links to existing admin pages, and empty/permission states.
  - [x] Use existing admin visual language: dense but readable, restrained borders, `rounded-sm`, no marketing hero, no nested cards, no decorative gradients/orbs, and no in-app instructional prose about how the dashboard works.
  - [x] Keep the layout stable on mobile and desktop: fixed/consistent stat tile dimensions, wrapping labels, `min-w-0`, no text overflow, and focus-visible links/buttons.
  - [x] Add `app/(admin)/admin/loading.tsx` only if the dashboard has enough runtime data to benefit from a meaningful loading state. If added, keep it lightweight and server-rendered.

- [x] Preserve section privacy and scope boundaries. (AC: 1, 2, 3)
  - [x] If a section permission is missing, do not call that section's query path or RPC branch for display data.
  - [x] Permission-denied sections should render either no section or neutral copy such as "Not available for your role"; never show hidden counts as zero.
  - [x] Empty states for authorized sections should distinguish "no records yet" from "not configured yet" without exposing table names, SQL errors, policy details, or internal statuses.
  - [x] Keep all aggregates community-scoped by `community_id` resolved from `spring-meadow-community`.
  - [x] Do not change existing admin management pages, resident dashboard behavior, public/guest payment surfaces, document download flows, message contents, payment workflows, or auth redirects unless a focused integration issue requires it.

- [x] Add focused static/source tests. (AC: 1, 2, 3)
  - [x] Add `tests/admin-dashboard-summary.test.mjs`.
  - [x] Test that the dashboard service is server-only, uses `getCurrentProfile`/`hasPermission` or the dashboard RPC with equivalent checks, resolves the Spring Meadow community, returns safe unions, and does not import service-role clients.
  - [x] Test that the migration/RPC checks `board.workspace.access`, gates payments/documents/messages with their existing permission keys, revokes public execution, grants authenticated execution, scopes all aggregates by `community_id`, and does not return forbidden private columns.
  - [x] Test that `app/(admin)/admin/page.tsx` imports the dashboard service, renders useful authorized empty states, renders permission-aware states, and no longer contains the Story 5.1 minimal placeholder copy.
  - [x] Test that unauthorized sections are gated before fetching: no direct UI-level fetching from `payments`, `documents`, or `message_threads`; section data must come from the service/RPC result.
  - [x] Add negative assertions that public, guest, resident, shared client, and admin navigation files do not import the dashboard summary service or new dashboard-only internals.
  - [x] Run `node --test tests/admin-dashboard-summary.test.mjs`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.

### Review Findings

- [x] [Review][Patch] Document dashboard counts include visibilities not readable by board-document viewers [supabase/migrations/202605110018_admin_dashboard_summary.sql:128]

## Dev Notes

Story 5.2 converts the safe shell from Story 5.1 into an actual operations dashboard. The highest-risk implementation mistakes are leaking aggregate counts for sections the actor cannot access, querying tables that do not exist yet for compliance work, and accidentally exposing row-level private data while building "summary" UI.

### Current State To Preserve

- `app/(admin)/admin/layout.tsx`
  - Current state: server layout calls `getAdminWorkspaceContext()` before rendering children; redirects unauthenticated users to `/login?next=/admin`; renders generic denied/unavailable states; wraps the workspace with a single `<main>`.
  - Preserve: layout owns the route guard and main landmark. Do not fetch dashboard summaries in the layout because Next loading UI cannot cover uncached layout work in the same route segment.

- `server/services/auth/admin-workspace.ts`
  - Current state: server-only workspace context resolves `spring-meadow-community`, requires active profile plus `board.workspace.access`, and builds permission-aware navigation using existing keys.
  - Preserve: navigation remains safe, minimal, and not authoritative in the browser. The dashboard service can reuse the same permission constants/patterns but should not add raw role rows or permissions arrays to UI.

- `app/(admin)/admin/page.tsx`
  - Current state: intentionally minimal placeholder created by Story 5.1 and explicitly avoided fetching dashboard counts.
  - Change: replace this with the real dashboard summary. Keep it a Server Component.

- `components/admin/admin-workspace-nav.tsx`
  - Current state: isolated client component for mobile menu state and active link styling only.
  - Preserve: do not add Supabase, server service imports, direct permission checks, or dashboard data fetching to this component.

- Existing admin pages:
  - `app/(admin)/admin/payments/page.tsx`
  - `app/(admin)/admin/delinquency/page.tsx`
  - `app/(admin)/admin/documents/page.tsx`
  - `app/(admin)/admin/announcements/page.tsx`
  - `app/(admin)/admin/events/page.tsx`
  - `app/(admin)/admin/messages/page.tsx`
  - Current state: server-rendered operational pages with their own service calls, filters, notices, and authorization checks.
  - Preserve: do not refactor these pages while adding the dashboard. Link to them from dashboard sections when available.

### Suggested Output Contract

Use a narrow, UI-friendly contract so the page never receives private rows:

```ts
type DashboardSectionState = "available" | "empty" | "not_configured" | "permission_denied";

type AdminDashboardSummary = {
  communityId: string;
  communitySlug: string;
  generatedAt: string;
  sections: {
    properties: {
      state: DashboardSectionState;
      activeCount: number;
      overdueCount: number;
      delinquentCount: number;
      lienReviewCount: number;
    };
    payments: {
      state: DashboardSectionState;
      pendingCount: number;
      failedCount: number;
      succeededLast30DaysCount: number;
      succeededLast30DaysAmountCents: number;
    };
    documents: {
      state: DashboardSectionState;
      activeCount: number;
      expiringSoonCount: number;
      restrictedCount: number;
      recentUploadCount: number;
    };
    messages: {
      state: DashboardSectionState;
      openCount: number;
      pendingBoardCount: number;
      unassignedCount: number;
    };
    compliance: {
      state: DashboardSectionState;
      upcomingCount: number;
      overdueCount: number;
    };
  };
};
```

The exact shape can differ, but it must remain aggregate-only, community-scoped, and permission-scoped. Do not return generic `Record<string, unknown>` blobs to the page when a typed result is practical.

### Permission Mapping

- Dashboard access: `board.workspace.access` from Story 5.1.
- Properties aggregate: use dashboard/workspace access only for this story, aggregate-only. Story 5.3 can introduce richer property management permissions and UI later.
- Payments aggregate: `admin.payments.manage`.
- Documents aggregate: `admin.documents.manage` or `board.documents.view`.
- Messages aggregate: `admin.messages.manage`.
- Compliance aggregate: render `not_configured` until Story 6.1 adds the compliance schema and permissions.
- Audit logs, webhook/email/job monitoring, settings, role assignment, and CRUD actions are out of scope.

### Existing Tables And Fields

- `properties`: `community_id`, `status`, `deleted_at`, `current_balance_cents`, `last_payment_at`, `next_due_date`, `delinquency_status`.
- `assessments`: `community_id`, `property_id`, `balance_cents`, `due_date`, `status`.
- `payments`: `community_id`, `property_id`, `payer_type`, `amount_cents`, `currency`, `method`, `status`, `paid_at`, `created_at`, `updated_at`.
- `documents`: `community_id`, `visibility`, `category`, `status`, `effective_date`, `expiration_date`, `created_at`, `updated_at`, `deleted_at`.
- `message_threads`: `community_id`, `property_id`, `category`, `status`, `assigned_to`, `last_message_at`, `closed_at`, `created_at`, `updated_at`.
- Compliance calendar tables are documented but not migrated yet. Do not select from `compliance_calendar_events` or `compliance_tasks` in Story 5.2 unless this repo has since added those migrations before implementation begins.

### Architecture Compliance

- Follow Next.js App Router route groups under `app/(admin)/admin`.
- Keep business logic in `server/services/...`; use a migration-backed RPC if direct RLS-safe aggregate access would become duplicated or awkward.
- Use user-scoped Supabase clients from `lib/supabase/server.ts`; service role remains reserved for jobs, webhooks, storage signing, or already-justified trusted flows.
- Keep authorization layered: proxy verifies session, layout verifies workspace access, dashboard service/RPC verifies dashboard and section access.
- Keep all core records community-scoped and avoid hardcoding Spring Meadow values outside the existing default slug/config pattern.
- Do not weaken existing RLS policies or grant broad direct table access just to count dashboard records.

### UI Requirements

- The dashboard should feel like an operations surface, not a marketing page: compact stat summaries, clear section headings, short status labels, and direct links to existing pages.
- Use useful empty states: "No active messages", "No failed payments", "No documents expiring soon", "Compliance tracking has not been configured yet".
- Avoid table names, SQL/RPC names, permission key names, stack traces, and raw errors in the UI.
- Do not use nested cards. If using metric cards, they should be repeated items in an unframed page layout with restrained borders and radius no larger than existing `rounded-sm`.
- Make all links and controls keyboard focus-visible; ensure long labels wrap cleanly on mobile.

### Latest Technical Information

- Local dependencies in `package.json`: Next `^16.0.0`, React `^19.0.0`, `@supabase/ssr` `^0.10.3`, `@supabase/supabase-js` `^2.105.3`, Tailwind `^4.0.0`, TypeScript `^5.0.0`.
- Official Next App Router docs currently support database access directly from Server Components, with the reminder that credentials/query logic stay out of the client bundle and authorization is still required. Keep `/admin` data fetching server-side.
- Official Next loading docs say `loading.tsx` provides instant route-segment fallback, but uncached data in a layout can block navigation before the same segment loading state appears. Keep summary fetching in `page.tsx`, not the admin layout.
- Official Supabase RLS docs reinforce enabling RLS on exposed-schema tables, using security-definer helpers carefully, and never exposing service keys in the browser. Dashboard aggregates should preserve that model.
- Official Supabase JavaScript docs document `select(..., { count: 'exact', head: true })` for row counts, but this repo's admin aggregate work is safer as a permission-checked RPC because current RLS policies do not grant board/admin direct select access to every aggregate source.

### Previous Story Intelligence

- Story 5.1 intentionally deferred real dashboard summaries and created only a placeholder `/admin` page. This story owns replacing that placeholder.
- Story 5.1 established the admin shell, safe redirect handling, server layout guard, and client-only nav. Do not move dashboard data into the nav or layout.
- Story 3.9 created delinquency reporting with `board.delinquency.view`; use its existence as context, but do not duplicate the full report or expose lien-review detail beyond safe counts.
- Stories 3.8, 4.3, 4.5, 4.6, and 4.8 created admin pages with existing permission-backed services. Reuse their destinations and permission keys instead of inventing parallel management flows.
- Story 4.9 protected message visibility and internal notes. Dashboard message aggregates must never include message bodies or internal-note text.

### Testing Requirements

- Follow the existing source-inspection test style with `node:test`, `assert`, `readFileSync`, `existsSync`, recursive file listing helpers, and regex assertions.
- Add positive tests for the service, migration/RPC, page, empty states, section permission states, and dashboard route.
- Add negative privacy tests across dashboard files and client-facing public/resident/shared files.
- Run the focused test first, then the full suite and quality commands listed in Tasks.

### Project Structure Notes

- Add `server/services/admin/` if it does not exist; keep dashboard-specific service code there rather than under `server/services/auth`.
- Keep `app/(admin)/admin/page.tsx` as the only dashboard route for this story.
- Keep tests in `tests/admin-dashboard-summary.test.mjs`.
- Optional migration should be the next timestamped SQL file after `202605110017_message_visibility_history_and_notifications.sql`.
- No `project-context.md` file was found under the project root during story creation.

### References

- [Epic 5 and Story 5.2 Source](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Previous Story 5.1](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/5-1-board-admin-workspace-shell-and-navigation.md)
- [Architecture: Authorization and Board/Admin Access](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [Architecture: Board/Admin Navigation](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [API Design: Cross-Cutting Requirements and Admin/Compliance APIs](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Data Model: Properties, Payments, Documents, Messages, Compliance, Audit](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [Requirements: Board/Admin Goals and Admin Tools](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md)
- [Compliance Dashboard Requirements](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/compliance-calendar-and-warning-emails.md)
- [Admin Workspace Context](/home/smount/Websites/SpringMeadowCommunity/server/services/auth/admin-workspace.ts)
- [Admin Layout](/home/smount/Websites/SpringMeadowCommunity/app/(admin)/admin/layout.tsx)
- [Admin Dashboard Placeholder](/home/smount/Websites/SpringMeadowCommunity/app/(admin)/admin/page.tsx)
- [Admin Navigation Component](/home/smount/Websites/SpringMeadowCommunity/components/admin/admin-workspace-nav.tsx)
- [Admin Payments Service](/home/smount/Websites/SpringMeadowCommunity/server/services/payments/admin-payment-management.ts)
- [Document Metadata Service](/home/smount/Websites/SpringMeadowCommunity/server/services/documents/document-metadata.ts)
- [Admin Message Inbox Service](/home/smount/Websites/SpringMeadowCommunity/server/services/messages/admin-message-inbox.ts)
- [Delinquency Reporting Service](/home/smount/Websites/SpringMeadowCommunity/server/services/payments/delinquency-reporting.ts)
- [Next.js Fetching Data Docs](https://nextjs.org/docs/app/getting-started/fetching-data)
- [Next.js loading.js Docs](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
- [Supabase Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase JavaScript Select/Count Docs](https://supabase.com/docs/reference/javascript/select)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `node --test tests/admin-dashboard-summary.test.mjs` - passed.
- `npm test` - passed.
- `npm run typecheck` - passed.
- `npm run lint` - passed.
- `npm run build` - passed.
- `git diff --check` - passed.
- Code review fix verification: `node --test tests/admin-dashboard-summary.test.mjs`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check` passed.

### Completion Notes List

- Story context created from active BMad output artifacts and current codebase analysis.
- Compliance dashboard data is explicitly constrained to a not-configured/empty state until Epic 6 creates the compliance schema.
- Dashboard summary is scoped as aggregate-only and permission-gated to avoid row-level data leakage.
- Added a server-only dashboard summary service that resolves Spring Meadow, checks workspace access, maps safe RPC aggregates into typed section states, and avoids service-role access.
- Added a permission-gated aggregate RPC for property, payment, document, message, compliance, and overdue-work summaries with section-specific permission branches.
- Replaced the `/admin` placeholder with a compact Server Component dashboard using permission-aware and empty states.
- Added source-inspection coverage for the service, migration/RPC, page, privacy boundaries, and client-facing import isolation.
- Addressed code review finding by scoping board-document viewer dashboard counts to public, board, and property-specific document visibilities while preserving full counts for document managers.

### File List

- `_bmad-output/implementation-artifacts/5-2-admin-dashboard-summary.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `app/(admin)/admin/page.tsx`
- `server/services/admin/dashboard-summary.ts`
- `supabase/migrations/202605110018_admin_dashboard_summary.sql`
- `tests/admin-dashboard-summary.test.mjs`

### Change Log

- 2026-05-17: Implemented Story 5.2 admin dashboard summary and marked ready for review.
- 2026-05-17: Addressed code review finding and marked story done.
