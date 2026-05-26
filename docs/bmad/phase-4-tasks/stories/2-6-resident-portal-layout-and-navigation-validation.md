# Story Validation Report: 2.6 Resident Portal Layout and Navigation

Date: 2026-05-11
Status: passed with fixes applied

## Result

Story 2.6 is ready for dev.

## Source Coverage Checked

- Epic 2 and Story 2.6 acceptance criteria from `_bmad-output/planning-artifacts/epics.md`
- Resident goals, dashboard/navigation requirements, and accessibility requirements from `docs/bmad/phase-1-requirements/requirements.md`
- Next.js route grouping, resident access, and authorization architecture from `docs/bmad/phase-2-architecture/architecture.md`
- Cross-cutting auth, authorization, validation, and error-shape requirements from `docs/bmad/phase-3-design/api.md`
- Property membership and role model context from `docs/bmad/phase-3-design/data-model.md`
- Existing portal, invitation acceptance, property membership, role permission, and public navigation code patterns in the current codebase
- Previous Story 2.5 review findings and Story 2.4 invitation acceptance redirect corrections

## Fixes Applied

- Clarified that the original `app/(resident)/portal/page.tsx` must be removed or relocated after moving the portal home into the `(member)` route group, preventing duplicate `/portal` App Router pages.
- Added an explicit prohibition against an active-membership-gated `app/(resident)/portal/layout.tsx`, which would accidentally block `/portal/invitations/accept`.
- Tightened the member shell guidance to use `getCurrentPropertyMemberships()` or a shared helper as the source of truth, avoiding duplicated profile/membership queries in each child page.
- Resolved the navigation-versus-permission ambiguity by requiring all seven top-level nav destinations for active members while enforcing Payments/Documents restrictions inside route content.
- Added multi-property capability aggregation: Payments and Documents availability must be derived across the full active membership list.
- Strengthened tests to catch duplicate route definitions, invitation-route wrapping regressions, and membership-list capability aggregation.

## Remaining Risk

- Story 2.5 still has unresolved code-review findings in role mutation audit/scope behavior. Story 2.6 avoids those mutation paths, so implementation can proceed, but later admin/role UI work should not assume those findings are fixed.
- This story intentionally creates placeholder resident portal destinations only. Dashboard data, payment flows, documents, messages, and full property details remain future stories.
