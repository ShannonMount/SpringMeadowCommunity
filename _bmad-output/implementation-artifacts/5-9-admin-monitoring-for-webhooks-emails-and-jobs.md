# Story 5.9: Admin Monitoring for Webhooks, Emails, and Jobs

Status: done

## Story

As an admin,
I want visibility into failed webhooks, failed email delivery, and scheduled job failures,
so that operational problems can be detected and corrected.

## Acceptance Criteria

1. Given payment webhook events are received, when an admin with monitoring permission views webhook status, then they can see received, processed, failed, and ignored event summaries and raw sensitive payloads are not exposed unnecessarily.
2. Given email send attempts are logged, when an admin views email status, then they can see queued, sent, delivered, bounced, failed, or suppressed statuses with related records when permitted and recipient details are scoped to authorized workflows.
3. Given compliance or reminder jobs run, when failures occur, then the system exposes enough job status or error information for admin review and no secrets or private service credentials are displayed.

## Tasks / Subtasks

- [x] Add a permission-gated monitoring summary service. (AC: 1, 2, 3)
  - [x] Add `server/services/admin/monitoring-summary.ts` as a server-only monitoring service.
  - [x] Resolve the default community slug `spring-meadow-community` and require `board.workspace.access` before returning operational status.
  - [x] Query `payment_events` and `email_logs` for the current community, then summarize counts and recent failures.
  - [x] Normalize counts, timestamps, and recent failures into a safe `AdminMonitoringSummary` structure.
  - [x] Sanitize failure summaries to redact URLs, secret-like keys, and obviously sensitive material before exposing them in the UI.
  - [x] Return safe union results for `monitoring`, `unauthenticated`, `profile-unavailable`, `permission-denied`, and `unavailable` states.

- [x] Add the admin monitoring page. (AC: 1, 2, 3)
  - [x] Add `app/(admin)/admin/monitoring/page.tsx` as the operational monitoring dashboard.
  - [x] Render metric tiles for webhook and email status counts plus recent failure summaries.
  - [x] Display recent webhook and email failures in a compact list format with timestamps and sanitized summaries.
  - [x] Add a safe back-to-dashboard action and generic access-denied copy when the user lacks access.

- [x] Preserve privacy and scope boundaries. (AC: 1, 2, 3)
  - [x] Do not expose raw recipient emails, payloads, or secret material in summaries.
  - [x] Redact provider URLs, token-like strings, and secret-bearing fields before serializing admin-visible strings.
  - [x] Keep the monitoring service scoped to the current community and workspace permission model.

- [x] Add focused source tests. (AC: 1, 2, 3)
  - [x] Add `tests/admin-monitoring.test.mjs`.
  - [x] Assert monitoring requires workspace access and aggregates status counts.
  - [x] Assert the service and page do not expose credential or raw payload values.

## Dev Notes

The monitoring story is intended to give board/admin users enough operational context to diagnose webhook and email issues without leaking credentials or raw provider payloads. The implementation intentionally reports high-level counts and sanitized failure summaries rather than inner payload content, which keeps the surface useful while maintaining the privacy guardrails already established in earlier admin stories.

### Relevant Files

- `server/services/admin/monitoring-summary.ts`
- `app/(admin)/admin/monitoring/page.tsx`
- `server/services/auth/admin-workspace.ts`
- `tests/admin-monitoring.test.mjs`
