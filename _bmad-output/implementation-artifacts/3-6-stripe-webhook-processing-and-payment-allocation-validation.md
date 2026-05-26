# Story Validation Report: 3.6 Stripe Webhook Processing and Payment Allocation

Date: 2026-05-13
Status: resolved after focused DS/CR pass

## Result

Story 3.6 had strong overall context and the local implementation surface already existed, but two story-level gaps needed attention before treating the story as fully validated.

Because this validation was run after implementation had already started, no story rewrite or implementation change was applied. This report focuses on create-story quality, workflow consistency, source coverage, and verification evidence.

## Resolution Update

The focused DS/CR pass on 2026-05-13 updated Story 3.6 context and implementation for both validation gaps:

- Payment-level idempotency now treats distinct Stripe success events for an already succeeded local payment as safe reference/event/audit updates only, without additional allocation or balance mutation.
- Stripe Connect/direct-account handling now uses top-level `event.account` as Stripe API request context and validates it against `community_settings.stripe_connected_account_id`.

Code review found one follow-up patch: permanent connected-account mismatch failures were recorded as retryable. The RPC now returns `retryable = false` for those monitorable business-rule failures.

## Source Coverage Checked

- Story 3.6 from `_bmad-output/implementation-artifacts/3-6-stripe-webhook-processing-and-payment-allocation.md`
- Epic 3 and Story 3.6 acceptance criteria from `_bmad-output/planning-artifacts/epics.md`
- Sprint status from `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Payment architecture and webhook reliability from `docs/bmad/phase-2-architecture/architecture.md`
- Stripe webhook API requirements from `docs/bmad/phase-3-design/api.md`
- Payments, allocations, payment events, and audit log data model from `docs/bmad/phase-3-design/data-model.md`
- Previous Stories 3.1 through 3.5, especially payment lifecycle and guest privacy boundaries
- Story 3.6 implementation files, migration, and guardrail tests already present in the worktree
- Current npm registry versions for Next.js, React, Supabase, and Stripe packages
- Official Stripe and Next.js docs for webhook signatures, Checkout fulfillment, Connect webhooks, and route handlers

## Findings

### Critical Issues

- Payment-level idempotency needs to be explicit. The story requires idempotency by Stripe event ID and mentions duplicate deliveries, but Stripe can emit multiple distinct successful event IDs for the same local payment, such as `checkout.session.completed` and `payment_intent.succeeded`. A later success event for an already succeeded local payment must be a payment-level no-op for allocations, including any previously unapplied remainder. The story should require tests proving that distinct success events for the same payment cannot allocate additional assessments later, double-count partial allocations, or mutate balances beyond the first completed payment processing pass.
- Stripe connected-account/direct mode is underspecified. Prior payment-session stories and `community_settings` support `stripe_account_mode = 'direct'` and `stripe_connected_account_id`, but Story 3.6 does not say how webhook processing handles top-level `event.account`, Connect webhook endpoint configuration, or Stripe API retrievals using the connected account context. The story should either mark connected-account webhook handling out of scope and enforce platform mode, or add explicit requirements and tests for selecting the right webhook endpoint/secret and passing connected-account context when retrieving Checkout Sessions, PaymentIntents, Charges, and balance transactions.

### Advisories

- Story validation is being run after implementation files already exist. The story is still marked `in-progress`, all task checkboxes remain unchecked, and the Dev Agent Record still contains placeholders. If dev-story has completed, the story record should be updated before code-review or completion tracking.
- Sprint tracking has mirror drift. `_bmad-output/implementation-artifacts/sprint-status.yaml` marks Story 3.6 as `in-progress`, while `docs/bmad/phase-4-tasks/sprint-status.yaml` still marks it `backlog`; no docs mirror story file for 3.6 was found. Treat `_bmad-output` as the active source of truth unless the mirror is reconciled.
- The story's test strategy matches the current project style: fast Node file-content guardrails. These are useful, but they do not exercise real Stripe webhook delivery, Stripe CLI signatures, Supabase RPC transaction behavior in a live database, RLS/service-role behavior, or Connect webhook delivery.
- The local stack notes are current: registry checks on 2026-05-13 returned `stripe` 22.1.1, `next` 16.2.6, `react` 19.2.6, `@supabase/supabase-js` 2.105.4, and `@supabase/ssr` 0.10.3. The installed build reports Next.js 16.2.4 through the lockfile; no upgrade is required for this story.

## Suggested Story Updates

- Add an explicit "payment-level idempotency" guardrail: once a local payment has a processed successful webhook event or existing allocations, subsequent successful events for the same payment must only persist safe references/event records and must not allocate additional funds or re-run balance mutation logic.
- Add tests for paired success events targeting the same local payment, including `checkout.session.completed` followed by `payment_intent.succeeded`, and the reverse order.
- Add tests for already succeeded payments with unapplied remainder so a later success event cannot apply that remainder to newly open assessments.
- Decide whether connected-account/direct Stripe mode is in scope. If in scope, require `event.account` validation, Connect endpoint configuration, connected-account API retrieval context, and safe storage or audit metadata for the account context. If out of scope, require platform-mode-only failure or ignore behavior that is explicit and monitorable.
- Add a production-readiness note for manual Stripe CLI testing and live Supabase migration/RPC verification before enabling the webhook endpoint for real HOA payments.

## Verification Run

- `npm test` - passed, 93 tests
- `npm run typecheck` - passed
- `npm run lint` - passed
- `npm run build` - passed
- `git diff --check` - passed
- `npm view stripe version` - 22.1.1
- `npm view next version` - 16.2.6
- `npm view react version` - 19.2.6
- `npm view @supabase/supabase-js version` - 2.105.4
- `npm view @supabase/ssr version` - 0.10.3

## External Sources Checked

- Stripe webhook signature verification: https://docs.stripe.com/webhooks/signature
- Stripe webhook handling and retries: https://docs.stripe.com/webhooks?lang=node
- Stripe Checkout fulfillment and delayed payment events: https://docs.stripe.com/checkout/fulfillment
- Stripe Connect webhooks: https://docs.stripe.com/connect/webhooks
- Next.js Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers

## Remaining Risk

Before production use, Story 3.6 still needs live verification with Stripe test-mode webhook delivery, Stripe CLI signature forwarding, Supabase migration/RPC behavior, service-role boundaries, and any intended Stripe Connect/direct-account setup.
