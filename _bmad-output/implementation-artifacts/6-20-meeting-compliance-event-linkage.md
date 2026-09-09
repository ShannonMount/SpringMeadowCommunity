# Story 6.20: Meeting Compliance Event Linkage

Status: ready-for-dev

## Story

As a board/admin manager,
I want each annual meeting tied to its compliance obligation,
so that calendar deadlines remain synchronized with meeting changes.

## Acceptance Criteria

1. Given an annual meeting is created, then the workflow creates or links one community-scoped compliance event with type `annual_meeting` and the meeting due date.
2. Given the meeting date or status changes, then the linked event is updated without creating duplicate events.
3. Given the meeting or event belongs to another community, then the mutation is rejected and neither record is exposed.

## Tasks / Subtasks

- [ ] Define the meeting-to-event relationship and uniqueness guarantee.
- [ ] Create/update the annual-meeting compliance event transactionally.
- [ ] Synchronize due date and completion/cancellation status.
- [ ] Add linkage, duplicate-prevention, cross-community, and rollback tests.

## Dev Notes

Use the compliance event foundation from Stories 6.1 and 6.2. Story 6.4 owns the meeting workflow; Story 6.20 isolates the synchronization contract for implementation and testing.
