# Story 3.1: Assessment Cycle and Property Assessment Management

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to create assessment cycles and property assessments,
so that the HOA can track dues owed by each property.

## Acceptance Criteria

1. Given an authorized admin creates an assessment cycle, when they provide type, period, due date, default amount, and currency, then the system stores the cycle scoped to the community, and the amount is stored in integer cents.
2. Given a property needs an assessment, when an authorized admin creates or generates the property assessment, then the assessment is linked to the property and optional cycle, and due date, amount, paid amount, balance, status, and description are stored.
3. Given a user without assessment management permission attempts to create or update assessments, when the action runs, then it is denied, and no assessment or property financial data is returned.

## Tasks / Subtasks

- [x] Add the assessment schema migration. (AC: 1, 2, 3)
  - [x] Add the next ordered migration after `202605100003_create_roles_and_profile_roles.sql`, likely `supabase/migrations/202605110001_create_assessment_cycles_and_assessments.sql`.
  - [x] Create `public.assessment_cycles` with `id`, `community_id`, `name`, `type`, `status`, `period_start`, `period_end`, `due_date`, `default_amount_cents`, `currency`, optional `late_fee`/`interest` JSON, `created_by`, `created_at`, and `updated_at`.
  - [x] Create `public.assessments` with `id`, `community_id`, `property_id`, optional `assessment_cycle_id`, `type`, `description`, `amount_cents`, `paid_cents`, `balance_cents`, `currency`, `due_date`, `status`, optional source workflow fields, `created_by`, `created_at`, and `updated_at`.
  - [x] Enforce integer cents, nonnegative amounts, `paid_cents <= amount_cents`, `balance_cents = amount_cents - paid_cents`, supported currency `USD`, supported cycle/assessment types, supported statuses, and same-community property/cycle relationships.
  - [x] Add indexes from the data model: cycle status/due, cycle type/period, assessment property/due, assessment status/due, and assessment cycle lookup.
  - [x] Enable RLS on both tables. Reads and writes must require explicit admin/board permission through policies or permission-checked RPCs; residents get assessment visibility in Story 3.2, not here.
  - [x] Add update triggers for `updated_at` consistent with existing migrations.
  - [x] Idempotently add a conservative assessment-management permission such as `admin.assessments.manage` to the seeded admin role. Do not grant it to residents.
- [x] Add permission-checked assessment management mutations. (AC: 1, 2, 3)
  - [x] Add server-only domain code, likely `server/services/payments/assessment-management.ts`, using the existing Supabase server client and `hasPermission()`.
  - [x] Implement typed functions for `createAssessmentCycle`, `createPropertyAssessment`, `generatePropertyAssessmentsForCycle`, and a narrow `updateAssessmentStatus`/`updateAssessment` path only for fields needed by this story.
  - [x] Prefer SQL RPCs for mutations that must be transactional, such as creating an assessment and updating property balance summary together.
  - [x] Validate all boundary input server-side: UUIDs, enum values, date strings, period ordering, positive integer cent amounts, paid/balance math, and currency.
  - [x] Require `admin.assessments.manage` for the target community before reading target property/cycle details or mutating financial records.
  - [x] Deny unauthenticated, unavailable-profile, and unauthorized users with generic privacy-safe states. Do not reveal whether a property, cycle, or assessment exists.
  - [x] Write audit intent through `writeAuditLog()` for cycle creation, assessment creation/generation, and assessment updates with actor, community, target type/id, before/after where available, and reason/metadata.
- [x] Keep property financial summaries coherent. (AC: 2)
  - [x] When an open/partially paid/overdue assessment is created or updated, keep `properties.current_balance_cents`, `properties.next_due_date`, and `properties.delinquency_status` consistent with assessment records.
  - [x] Do not overwrite resident membership permission booleans or property identity fields while updating financial summaries.
  - [x] If full recalculation is deferred, add an explicit safe helper/RPC boundary that later payment allocation code can reuse; do not leave hidden balance math duplicated in UI.
- [x] Preserve existing resident, guest, and payment-flow boundaries. (AC: 1, 2, 3)
  - [x] Do not add Stripe Checkout, Payment Element, payment records, payment allocations, webhook processing, receipt emails, or guest lookup behavior in this story.
  - [x] Do not build the full Epic 5 admin workspace shell. If no admin shell exists, provide server-side management primitives and tests; later admin UI stories can call them.
  - [x] Do not expose raw `account_number`, `public_payment_code`, `owner_display_name`, mailing address, resident emails/phones, payment history, private documents, messages, raw Supabase errors, or service-role details.
  - [x] Preserve existing resident portal pages, dashboard summary behavior, My Property privacy rules, and public Pay Dues placeholder/lookup boundaries.
  - [x] Do not create lien, fine, legal review, late-fee automation, or delinquency-reporting workflows beyond storing assessment data needed by later stories.
- [x] Extend verification. (AC: 1, 2, 3)
  - [x] Add `tests/assessment-management.test.mjs`.
  - [x] Test migration tables, constraints, indexes, RLS, update triggers, and conservative permission seed update.
  - [x] Test permission-checked RPC/service patterns: current profile, `hasPermission`, `admin.assessments.manage`, generic denial states, and no pre-denial financial data lookup.
  - [x] Test amount handling uses integer cents and does not use floats for money.
  - [x] Test same-community checks for property and cycle links.
  - [x] Test audit intent calls for create/generate/update actions.
  - [x] Test scope boundaries exclude Stripe, payments, payment allocations, webhooks, guest lookup, full admin UI, documents, messages, and service-role imports.
  - [x] Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.

### Review Findings

- [x] [Review][Patch] Direct assessment table writes can bypass audited RPCs and property summary recalculation [supabase/migrations/202605110001_create_assessment_cycles_and_assessments.sql:188]

## Dev Notes

Story 3.1 is the first Epic 3 slice. It should establish the dues/assessment foundation that later resident payment history, Stripe sessions, webhooks, manual payments, and delinquency reports will build on. Keep it server-side and financial-record focused: schema, permission-checked mutation primitives, balance-summary consistency, audit intent, and guardrail tests.

The current repo does not have a board/admin workspace route group yet. Do not invent the full admin shell here. Epic 5 owns the broader admin workspace experience. This story can satisfy "admin creates" through server-only services and/or server actions guarded by explicit permissions.

### Current Files To Update

- `supabase/migrations/`
  - Current state: migrations exist for profiles, properties/memberships, property invitation tokens, and roles/profile roles.
  - Change: add a new ordered migration for `assessment_cycles` and `assessments`.
  - Preserve: do not edit older migrations unless unavoidable. Use a follow-up migration to add `admin.assessments.manage` to the admin role.
- `server/services/auth/permissions.ts`
  - Current state: server-only `hasPermission()` plus role mutation helpers using Supabase RPC and generic privacy-safe outcomes.
  - Change: usually none. New assessment services should call `hasPermission({ communityId, permissionKey: "admin.assessments.manage" })`.
  - Preserve: no raw Supabase errors, no service-role client, and no client-side permission decisions.
- `server/services/audit/write-audit-log.ts`
  - Current state: server-only audit-intent interface returning `{ kind: "recorded" }`; persistent `audit_logs` table does not exist yet.
  - Change: usually none. Call this interface from assessment mutation services with enough detail for later persistence.
- `supabase/migrations/202605100001_create_properties_and_memberships.sql`
  - Current state: `properties` already includes `current_balance_cents`, `last_payment_at`, `next_due_date`, and `delinquency_status`.
  - Change: do not edit this migration. New assessment RPCs may update the existing `properties` summary columns.
  - Preserve: property RLS, active/deleted filters, account number privacy, and membership access rules.
- `app/(resident)/portal/(member)/payments/page.tsx`
  - Current state: resident payments page is still a permission-aware placeholder.
  - Change: none expected. Story 3.2 owns resident dues status/history.

### New Files Likely Needed

- `supabase/migrations/202605110001_create_assessment_cycles_and_assessments.sql`
  - Assessment cycle and property assessment schema, constraints, indexes, RLS, permission seed update, helper functions/RPCs if used.
- `server/services/payments/assessment-management.ts`
  - Server-only create/generate/update service with authorization, validation, Supabase RPC calls, typed results, and audit intent.
- `server/actions/assessments.ts`
  - Optional server action wrapper if implementation wants a UI-callable boundary now. Keep it thin and permission-checked through the service.
- `tests/assessment-management.test.mjs`
  - Node file-content guardrails matching the current test style.

### Assessment Data Contract

Use the canonical Postgres data model fields:

```ts
type AssessmentCycle = {
  id: string;
  communityId: string;
  name: string;
  type: "annual" | "quarterly" | "monthly" | "special";
  status: "draft" | "active" | "closed" | "archived";
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  defaultAmountCents: number;
  currency: "USD";
};

type Assessment = {
  id: string;
  communityId: string;
  propertyId: string;
  assessmentCycleId: string | null;
  type:
    | "regular_dues"
    | "special_assessment"
    | "late_fee"
    | "interest"
    | "fine"
    | "damage_assessment"
    | "manual_adjustment";
  description: string;
  amountCents: number;
  paidCents: number;
  balanceCents: number;
  currency: "USD";
  dueDate: string;
  status: "draft" | "open" | "partially_paid" | "paid" | "overdue" | "waived" | "disputed" | "void";
};
```

Rules:

- Store all money as integer cents. Never use floating point for money.
- `balance_cents` starts as `amount_cents - paid_cents`.
- New property assessments should normally start with `paid_cents = 0` and `status = "open"` unless explicitly created as draft.
- `assessment_cycle_id` may be null for one-off/manual assessments, but if supplied it must belong to the same community.
- `property_id` must point to an active, non-deleted property in the same community.
- Date-only values should remain date-only. Do not introduce timezone drift by formatting due dates as local midnight timestamps in UI or tests.
- Late fee and interest configuration may be stored, but automatic late-fee/interest assessment is out of scope unless explicitly limited to persistence only.

### Permission and Error Contract

Use typed privacy-safe results similar to existing services:

```ts
type AssessmentMutationResult =
  | { kind: "created"; id: string }
  | { kind: "updated"; id: string }
  | { kind: "generated"; count: number; cycleId: string }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: string }
  | { kind: "permission-denied"; message: string }
  | { kind: "invalid-input"; message: string; fieldErrors?: Record<string, string[]> }
  | { kind: "assessment-unavailable"; message: string };
```

Do not return property address, owner name, balance, account number, cycle details, assessment details, or Supabase error text in denial states.

### Architecture Compliance

- Follow the layered authorization order: authenticated user, active profile, community scope, role permission, property/cycle scope, then mutation-specific validation.
- Use `community_id` on every HOA-scoped row even though this is a single-community deployment today.
- Keep RLS enabled on public-schema tables created by raw SQL migrations.
- Use permission-checked SQL RPCs for transactional financial mutations where separate Supabase calls could leave `assessments` and `properties` summaries inconsistent.
- Keep service-role keys out of browser/client code. Current implementation should not need a service-role client.
- Use existing Supabase SSR server client from `lib/supabase/server.ts`; do not add another auth/client pattern.

### Legal and Compliance Guardrails

- North Carolina planning notes say assessments should be tracked at least annually after an assessment has been made, and past-due common expense assessments/installments may have interest only within association and legal limits.
- This story stores assessment schedules and property assessment records; it does not decide legal collections, create liens, send statutory notices, or automate late fees.
- Any future late-fee, interest, delinquency, lien-readiness, fine, or legal-sensitive workflow must keep configurable legal settings and review gates. Do not bury those decisions in this story's mutation helpers.

### Scope Boundary

In scope:

- `assessment_cycles` and `assessments` database foundation.
- Conservative `admin.assessments.manage` permission addition.
- Server-only admin assessment management services/actions.
- Create cycle, create single property assessment, generate cycle assessments for eligible properties, and narrow update/status behavior.
- Property balance summary consistency for created/updated assessments.
- Audit intent for sensitive financial mutations.
- Guardrail tests.

Out of scope:

- Resident dues status and payment history UI.
- Stripe Checkout or Payment Element sessions.
- Guest payment lookup/session flow.
- Stripe webhook processing, payment allocation, and receipt emails.
- Admin payment records/manual payments.
- Delinquency reports.
- Full board/admin workspace shell.
- Persistent audit log viewer.
- Legal notices, lien workflows, fine/suspension workflows, or automatic legal actions.

### Previous Story Intelligence

- Story 2.3 created `properties` and `property_memberships`, active-only property RLS, and property financial summary columns that assessment creation should keep coherent.
- Story 2.5 created role/profile-role tables, conservative default roles, `hasPermission()`, permission-gated RPC patterns, and a no-op audit-intent service. Reuse these patterns.
- Story 2.7 and Story 2.8 established resident-facing balance/property privacy boundaries. Do not expose financial data to unauthorized users while building admin assessment mutations.
- Story 2.8 review fixed an email fallback leak in resident linked member summaries. Avoid profile display fallbacks that can expose email in any assessment-related denial or summary output.
- Existing tests are fast Node `node:test` file-content guardrails and do not import TypeScript modules directly.
- The worktree contains many uncommitted Epic 1 and Epic 2 changes. Do not revert unrelated files.
- No `project-context.md` file was found during story creation.

### Current Local Technical Information

- Local stack from `package.json`: Next.js `^16.0.0`, React `^19.0.0`, TypeScript `^5.0.0`, Tailwind CSS `^4.0.0`, `@supabase/ssr` `^0.10.3`, and `@supabase/supabase-js` `^2.105.3`.
- Existing migrations use idempotent SQL, `public` tables, `app` helper schema, RLS policies, update triggers, and `public` RPC wrappers when functions are called from Supabase JS.
- `profile_roles.scope_id` uses the all-zero UUID sentinel for community scope; preserve that convention if adding scoped assessment permissions later.
- `writeAuditLog()` currently records intent only. That is acceptable for this story as long as call sites include complete financial mutation context for later persistence.

### Latest Technical Information

- Next.js App Router remains the active routing model for Server Components and server-side app workflows. Keep sensitive financial mutations server-side. Source: https://nextjs.org/docs/app
- Supabase documents that tables created by raw SQL in exposed schemas need RLS enabled and least-privilege policies/grants. Source: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase JavaScript calls Postgres functions through `supabase.rpc("function_name", args)`. Keep RPC functions in an exposed schema such as `public` when they are called this way. Source: https://supabase.com/docs/client/rpc
- Supabase warns that service-role/secret keys bypass RLS and must never be exposed on the frontend. Source: https://supabase.com/docs/guides/database/secure-data

### Project Context Reference

- No `project-context.md` file was found.

### References

- [Epics: Story 3.1](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/epics.md)
- [Data Model: Financial Tables](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md)
- [API Design: Cross-Cutting Requirements](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md)
- [Architecture: Property-Centered Design and Authorization](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md)
- [Compliance Notes: Assessment and Dues Calendar](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/planning-artifacts/compliance-calendar-and-warning-emails.md)
- [Tasks v1: Assessment Database and Admin Backend](/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks-v1.md)
- [Previous Story 2.5](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-5-role-and-permission-assignment-foundation.md)
- [Previous Story 2.8](/home/smount/Websites/SpringMeadowCommunity/_bmad-output/implementation-artifacts/2-8-resident-property-detail-view.md)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-05-11: Red phase confirmed `tests/assessment-management.test.mjs` failed before the assessment migration and service existed.
- 2026-05-11: Verification passed with `node --test tests/assessment-management.test.mjs`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.
- 2026-05-11: Code review patch resolved direct assessment table write bypass by keeping RLS read-only for managers and requiring RPC mutations; verification passed.

### Implementation Plan

- Add assessment schema, RLS, permission seed update, and transactional RPCs.
- Add server-only assessment management service/actions with validation, authorization, generic denial states, and audit intent.
- Add guardrail tests for schema, service boundaries, money handling, community scope, audit intent, and out-of-scope exclusions.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented `assessment_cycles` and `assessments` schema foundation with constraints, indexes, update triggers, RLS, same-community scope validation, and admin assessment-management permission seeding.
- Added transactional SQL RPCs for assessment cycle creation, property assessment creation, cycle assessment generation, assessment updates, and property financial summary recalculation.
- Added server-only assessment management service with permission checks, validation, typed privacy-safe outcomes, Supabase RPC calls, and audit-intent writes.
- Added Story 3.1 guardrail tests and preserved existing test coverage/build checks.
- Resolved code review finding by removing direct RLS write policies and adding a regression guard that assessment tables expose read-only manager policies while writes remain behind audited RPCs.

### File List

- `_bmad-output/implementation-artifacts/3-1-assessment-cycle-and-property-assessment-management.md`
- `docs/bmad/phase-4-tasks/stories/3-1-assessment-cycle-and-property-assessment-management.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `docs/bmad/phase-4-tasks/sprint-status.yaml`
- `supabase/migrations/202605110001_create_assessment_cycles_and_assessments.sql`
- `server/services/payments/assessment-management.ts`
- `tests/assessment-management.test.mjs`

### Change Log

- 2026-05-11: Created Story 3.1 context for assessment cycle and property assessment management.
- 2026-05-11: Implemented assessment schema, permission-checked management RPCs, server-only assessment service, audit intent, property balance summary recalculation, and verification guardrails.
- 2026-05-11: Addressed code review patch for direct table writes bypassing audited RPC and property-summary recalculation.
