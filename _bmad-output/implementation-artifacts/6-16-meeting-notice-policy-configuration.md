# Story 6.16: Meeting Notice Policy Configuration

Status: ready-for-dev

## Story

As a board/admin manager,
I want to configure how out-of-window annual meeting notices are handled,
so that notice policy is explicit and auditable.

## Acceptance Criteria

1. Given a community has meeting notice settings, when an authorized admin or manager reads them, then the system returns earliest/latest notice days and an out-of-window policy of `warn` or `block`.
2. Given the policy is `block`, when notice is attempted outside the calculated window, then the notice is rejected before persistence.
3. Given the policy is `warn`, when notice is attempted outside the window, then an explicit override reason is required and persisted with the notice attempt.

## Tasks / Subtasks

- [ ] Add validated community notice policy settings with a default of `block`.
- [ ] Enforce `warn` and `block` behavior in the notice mutation.
- [ ] Persist override reason and actor metadata for allowed out-of-window notices.
- [ ] Add unauthorized, in-window, blocked, warning, and override tests.

## Dev Notes

Use `admin.meetings.manage`; the seeded `admin` and `manager` roles have this permission. Reuse existing community settings rather than creating a second configuration surface.
