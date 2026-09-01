# Story 5.8: Audit Log Viewer

Status: done

## Story

As an admin,
I want a read-only audit log viewer,
so that sensitive operational changes remain reviewable without allowing destructive edits.

## Acceptance Criteria

1. Given an authorized user opens the audit log page, when audit records exist, then they can view actor, actor type, action, target table, target ID, timestamp, request metadata, reason, and before/after summaries when permitted.
2. Given an unauthorized user attempts to view audit logs, when the route or query runs, then access is denied and no audit records are returned.
3. Given an audit log exists, when a normal board/admin workflow attempts to delete or erase it, then the workflow does not provide that action and audit history remains append-only by application convention.

## Tasks / Subtasks

- [x] Add a permission-gated audit log reader service. (AC: 1, 2)
  - [x] Add `server/services/admin/audit-log-viewer.ts` as a server-only admin service.
  - [x] Resolve the default community slug `spring-meadow-community` and require a valid community row.
  - [x] Require an active profile via `getCurrentProfile()` and require `audit.logs.view` via `hasPermission({ communityId, permissionKey: "audit.logs.view" })`.
  - [x] Return safe unions such as `audit-logs`, `unauthenticated`, `profile-unavailable`, `permission-denied`, and `audit-unavailable`.
  - [x] Select audit row fields from `public.audit_logs` without exposing raw credentials, secrets, or internal service-role data.
  - [x] Normalize audit rows into a safe `AuditLogEntry` shape with summarized metadata and read-only fields.

- [x] Add the admin audit viewer page. (AC: 1, 2)
  - [x] Add `app/(admin)/admin/audit/page.tsx` as a server-rendered page read-only audit log viewer.
  - [x] Render the permission gate and safe access states before table data loads.
  - [x] Use `StandardTable` for list display with sortable columns and review-friendly summaries.
  - [x] Show time, action, actor, target, target ID, request, reason, before, after, and metadata columns.
  - [x] Keep the page explicitly non-destructive: no delete, erase, or archive actions are exposed.

- [x] Preserve privacy and scope boundaries. (AC: 1, 2, 3)
  - [x] Keep the viewer community-scoped and permission-scoped.
  - [x] Do not expose raw payloads, secrets, or service-role values in the table or summaries.
  - [x] Do not implement destructive admin actions or mutations in this story.

- [x] Add focused source tests. (AC: 1, 2, 3)
  - [x] Add `tests/audit-log-viewer.test.mjs`.
  - [x] Assert that the service and page exist and are permission-aware.
  - [x] Assert that the page shows reviewable fields but not destructive audit actions.

## Dev Notes

This story closes the admin audit gap by providing a secure, read-only operational trail for board/admin workflows. The code follows the established pattern used for other admin permission-gated services: resolve profile → resolve community → validate permission → query only the authorized community’s rows → return a safe union result.

### Relevant Files

- `server/services/admin/audit-log-viewer.ts`
- `app/(admin)/admin/audit/page.tsx`
- `components/admin/data-table/StandardTable.tsx`
- `tests/audit-log-viewer.test.mjs`
