---
title: '5.7 - Admin Data Tables and Operational Filters'
type: 'feature' # feature | bugfix | refactor | chore
created: '2026-08-22'
status: 'done' # draft | ready-for-dev | in-progress | in-review | done
baseline_commit: 'd448c4b'
review_loop_iteration: 0 # incremented by step-04 before each review loopback
context: [] # optional: `{project-root}/`-prefixed paths to project-wide standards/docs the implementation agent should load. Keep short — only what isn't already distilled into the spec body.
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The admin experience has a reusable table scaffold, but not a consistent contract for list-heavy operational pages. Without shared filtering, sorting, empty states, and error handling, different admin workflows drift into one-off implementations that are harder to scan, harder to maintain, and less accessible.

**Approach:** Standardize on one admin data-table pattern for search, sort, pagination, row actions, empty states, and accessible error presentation while keeping action visibility permission-aware and the UX consistent across properties, users, payments, documents, messages, and compliance records.

## Boundaries & Constraints

**Always:** Reuse the existing table scaffold as the canonical pattern; filter is case-insensitive across visible columns; sorting must be stable and deterministic; empty states and error states must be accessible and user-safe; row actions must only render when the user has permission; do not leak stack traces or authorization internals.

**Ask First:** If a specific list page needs non-standard pagination limits, custom export actions, or a row-action contract beyond the shared table API, confirm the exception before implementing the custom flow.

**Never:** Do not create a new backend contract or database model just to support the table UI; do not expose internal errors, role internals, or privileged data in client-visible messages; do not bypass the permission checks already enforced by the server-side services.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | List page has records with valid permissions | Search, sort, pagination, and row actions render consistently across the dataset | N/A |
| EMPTY_STATE | No records or no records match filters | Display a clear empty state with a helpful explanation and only permitted next actions | N/A |
| ERROR_STATE | List fetch or row action fails after validation | Show a consistent alert pattern with a human-readable message and no stack trace or auth detail | Return the user-safe message only |
| UNAUTHORIZED_ACTION | User lacks permission for a row action | Action does not render and no control is exposed | Silence the action; keep the table usable |

</frozen-after-approval>

## Code Map

- `components/admin/data-table/StandardTable.tsx` -- current shared admin table scaffold with search, sort, pagination, header keyboard semantics, and permission-driven row actions.
- `components/admin/data-table/standard-table-utils.js` -- shared filtering, sorting, pagination, empty-state, and error-state helpers that drive consistent behavior across table consumers.
- `app/(admin)/admin/data-tables/example/page.tsx` -- example admin list page showing the contract for real data loading and permission-gated action rendering.
- `tests/story-5-7-admin-data-tables.test.mjs` -- scaffold acceptance checkpoint describing the required story-level behavior for the reusable component.
- `tests/story-5-7-data-table-behaviors.test.mjs` -- expected behavior for filtering, sorting, and pagination utilities.
- `tests/story-5-7-data-table-empty-error.test.mjs` -- expected empty-state and user-safe error-state output.
- `tests/story-5-7-keyboard-focus.test.mjs` -- keyboard navigation and sort-toggle contract for headers.

## Tasks & Acceptance

**Execution:**
- [ ] `components/admin/data-table/StandardTable.tsx` -- harden the shared admin table contract around filter/search, stable sorting, pagination, accessible empty/error states, and keyboard-safe focus management -- ensures consistent list behavior across admin screens.
- [ ] `components/admin/data-table/standard-table-utils.js` -- finalize the filter/sort/pagination and empty/error helper defaults -- keeps the logic testable and consistent with the acceptance suite.
- [ ] `app/(admin)/admin/data-tables/example/page.tsx` -- validate the example admin list against the shared contract and permission-gated row actions -- confirms the pattern works in a realistic consumer context.
- [ ] `tests/story-5-7-*` -- expand the focused story tests to cover the standardized behavior and guardrails for empty, error, and permission surfaces -- locks the expected admin-table contract before broader rollout.

**Acceptance Criteria:**
- Given an admin opens a list page, when records are available, then the table supports column search, sorting, and pagination for that record type and shows only permitted actions.
- Given a list page has no records or no matching filters, when it renders, then it presents an empty state that explains the absence of results and offers only permitted next actions.
- Given validation or server action errors occur from a list action, when the error is displayed, then it uses the consistent accessible alert pattern and does not expose stack traces or authorization details.
- Given a keyboard-only user navigates a table, when they move between headers and trigger sort, then focus movement and sort toggles remain predictable and accessible.

## Spec Change Log

- 2026-08-23: Implementation completed and merged to `main` (commit 34766f4).

## Design Notes

The reusable data-table should stay a thin shared abstraction rather than a page-specific component. The most robust pattern is to keep stateful UX concerns in one shared component while leaving the data source, row actions, and permission checks to the consuming page. Empty-state and error messaging should remain generic and human-readable, with row actions supplied only by the parent when the permission check succeeds.

## Verification

**Commands:**
- `node --test tests/story-5-7-admin-data-tables.test.mjs tests/story-5-7-data-table-behaviors.test.mjs tests/story-5-7-data-table-empty-error.test.mjs tests/story-5-7-keyboard-focus.test.mjs` -- expected: all Story 5.7 acceptance-focused tests pass after implementation.

**Manual checks (if no CLI):**
- Open the example admin data-table page and confirm the table search, sort, and pagination controls work without exposing actions the current user cannot take.
- Confirm the empty state and error alert present accessible messaging and no sensitive internal details.
