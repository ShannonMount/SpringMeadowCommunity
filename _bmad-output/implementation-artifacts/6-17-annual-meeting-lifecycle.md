# Story 6.17: Annual Meeting Lifecycle

Status: ready-for-dev

## Story

As a board/admin manager,
I want explicit annual meeting lifecycle states and transitions,
so that meeting obligations cannot move silently between incompatible states.

## Acceptance Criteria

1. Given an annual meeting is created, then its status is one of `draft`, `scheduled`, `notice_pending`, `notice_sent`, `held`, `cancelled`, or `completed`.
2. Given a meeting status changes, when the transition is invalid, then the mutation is rejected with no partial update.
3. Given a meeting is held, cancelled, or completed, then the related compliance obligation is updated consistently and the transition metadata is preserved.

## Tasks / Subtasks

- [ ] Add the lifecycle enum/check and transition validation.
- [ ] Define valid transition rules and test every terminal-state boundary.
- [ ] Synchronize lifecycle changes with the linked compliance event.
- [ ] Preserve actor, timestamp, and reason metadata for transitions.

## Dev Notes

Keep later notice delivery, minutes, and agenda flags in Story 6.5. This story owns only the meeting lifecycle contract.
