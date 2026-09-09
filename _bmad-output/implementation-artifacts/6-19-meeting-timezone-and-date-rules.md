# Story 6.19: Meeting Timezone and Date Rules

Status: ready-for-dev

## Story

As a board/admin manager,
I want meeting notice calculations to respect the community timezone,
so that statutory notice dates are predictable at day boundaries.

## Acceptance Criteria

1. Given a meeting date/time and community timezone, when notice dates are calculated, then the 60-day and 10-day offsets are calculated in the community timezone before being stored as timezone-aware timestamps.
2. Given a meeting occurs near a UTC day boundary, then the displayed and stored notice dates remain on the correct local calendar dates.
3. Given an invalid timezone or date value is supplied, then the mutation is rejected without persisting a partial meeting.

## Tasks / Subtasks

- [ ] Define timezone source and validation rules.
- [ ] Implement timezone-aware 60/10-day calculations.
- [ ] Add boundary, daylight-saving, and invalid-input tests.
- [ ] Document timestamp/display conversion expectations for the admin UI.
