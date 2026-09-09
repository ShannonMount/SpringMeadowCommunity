# Story 6.18: Meeting Settings Dependency Contract

Status: ready-for-dev

## Story

As a board/admin manager,
I want annual meeting workflows to use community settings safely,
so that missing or changed defaults do not produce silent deadline errors.

## Acceptance Criteria

1. Given meeting notice settings exist, when an annual meeting is created or updated, then the workflow reads the current community values without rewriting unrelated existing records.
2. Given settings are missing or unavailable, when a meeting workflow runs, then it uses documented North Carolina defaults or returns a safe unavailable state according to configuration.
3. Given notice settings change, then existing meeting windows remain unchanged unless an explicit recalculation action is requested.

## Tasks / Subtasks

- [ ] Define the dependency contract between community settings and annual meetings.
- [ ] Implement safe defaults and unavailable-state handling.
- [ ] Add explicit recalculation semantics for existing meetings.
- [ ] Test missing settings, changed settings, and no-silent-rewrite behavior.

## Dev Notes

Coordinate with Story 5.6, which owns the admin settings surface. Do not duplicate `community_settings` storage.
