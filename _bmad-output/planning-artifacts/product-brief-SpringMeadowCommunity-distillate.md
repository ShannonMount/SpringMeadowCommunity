---
title: "Product Brief Distillate: Spring Meadow Community"
type: llm-distillate
source: "product-brief-SpringMeadowCommunity.md"
created: "2026-04-30T20:22:28-0400"
purpose: "Token-efficient context for downstream PRD creation"
---

# Product Brief Distillate: Spring Meadow Community

## Product Intent

- Build a real North Carolina HOA website for Spring Meadow Community that combines public community information with a private resident and board operations portal.
- Use the first HOA implementation as a reusable prototype for future HOA customers with configurable branding, dues rules, documents, roles, workflows, and amenities.
- Treat the product as a community operations system, not just a brochure website.

## Core Model

- Product should be property-centered: each property address is the durable account/record.
- Multiple users can be linked to one property, such as husband/wife or co-owners with separate logins.
- A user can hold multiple roles, such as resident plus board member or resident plus pool worker.
- Guest payers can pay toward a property by address and/or account number but cannot view balance, owner names, payment history, documents, or private account data.

## MVP Scope Signals

- Public HOA information pages.
- Resident login.
- Resident dashboard with exactly these first-screen priorities: dues status, pay dues button, HOA announcements, upcoming events.
- Online dues payments through Stripe.
- Guest dues payments with receipt-only visibility.
- Payment records for authorized residents, board members, and admins.
- Document library with privacy levels: public, resident, board, vendor, property-specific, admin.
- HOA announcements.
- Event calendar.
- Resident-to-board communication.
- Admin tools for users, properties, payments, documents, announcements, events, and messages.
- Compliance calendar and warning emails for meetings, records, annual financial statement, records requests, assessments, delinquency, and legal-sensitive workflows.

## Later Scope Signals

- Moderated community posts.
- Maintenance requests.
- Architectural requests.
- Vendor proposal intake where any vendor can submit a public proposal.
- Approved vendor portal where official vendors can submit bills.
- Board bill approval and payment tracking.
- Board meeting agendas, draft notes, approved minutes, attendance, motions, votes, and attachments.
- Pool maintenance module with worker name, daily checklist, chemical readings, timestamped proof photos, alerts, and board/admin review.
- Fine, suspension, damage assessment, lien-preparation, and foreclosure-related tracking with legal-review gates.
- Multi-HOA onboarding, community settings, branding, feature flags, and pricing tools.

## North Carolina Compliance Context

- Key law for planned communities is North Carolina Planned Community Act, Chapter 47F; confirm community applicability, creation date, declaration, and bylaws.
- If legally a condominium, Chapter 47C may apply instead.
- Annual association meeting required at least once each year under G.S. 47F-3-108.
- Association meeting notice generally must be sent not less than 10 and not more than 60 days before the meeting.
- Meeting notice must state time, place, and agenda items, including general nature of declaration/bylaw amendments, budget changes, and director/officer removal proposals.
- Executive board meetings are held as bylaws provide, and at regular intervals owners must have opportunity to attend a portion and speak.
- Association must keep financial records sufficiently detailed to comply with Chapter 47F.
- Financial and other records, including association and executive board meeting records, must be reasonably available to owners/authorized agents as required by bylaws and Chapter 55A if applicable.
- Annual income/expense statement and balance sheet must be available to all lot owners at no charge within 75 days after fiscal year close.
- Statement of unpaid assessments and other charges against a lot must be furnished within 10 business days after request.
- Assessments must be made at least annually after an assessment has been made.
- Past-due common expense assessments/installments may bear interest at an association-established rate not exceeding 18% per year, subject to declaration/community applicability details.
- Fines/suspension workflow generally requires notice of charge, opportunity to be heard and present evidence, notice of decision, and appeal rights unless declaration provides specific procedure.
- Appeal from adjudicatory panel decision must be delivered within 15 days after decision.
- Unpaid assessment attributable to a lot for 30 days or longer can become lien when claim of lien is filed.
- Before lien filing, association must make reasonable and diligent efforts to confirm owner mailing address.
- At least 15 days before filing a lien, association must mail statement of assessment amount due to required addresses.
- Lien enforcement proceedings must be instituted within three years after filing or lien is extinguished.

## Compliance Calendar Requirements

- Create calendar events and warning emails for annual meetings, special meetings, board meetings, owner comment opportunities, annual financial statement, optional audit/review/compilation, records requests, unpaid assessment statements, dues cycles, delinquency, lien preparation, fines, and suspension.
- Meeting reminders: annual meeting scheduling, notice window open, final notice deadline, upload notes/minutes, approve/publish minutes.
- Annual financial statement reminders: fiscal year close, 45/30/15/5 days before due, due today, overdue.
- Records request reminders: new request, due soon, due tomorrow, due today, overdue.
- Lien preparation reminders: 30 days overdue, address verification incomplete, 15-day pre-lien waiting period, ready for legal review, three-year enforcement deadline reminders.
- Fine/suspension reminders: hearing prep, hearing date, decision notice, appeal window.
- Recipient defaults: secretary/admin for meetings and records, treasurer/president/admin for finances, president/treasurer/secretary/admin/legal reviewer for lien/fine/suspension workflows.
- Escalation states: informational, warning, critical, overdue, legal-sensitive.

## Financial Safeguards

- Prevent one-person financial control.
- Sensitive financial actions should require approval workflows.
- Vendor creation, vendor payment details, bill approvals, refunds, reserve transfers, and manual adjustments should be audited.
- Immutable audit logs should record who created, changed, approved, paid, deleted, or changed visibility on sensitive records.
- Every board member should have appropriate read-only financial visibility.
- Monthly reconciliation checklist should compare bank/payment processor records, dues collected, bills paid, outstanding invoices, manual adjustments, and reserve transfers.
- Annual audit/review/compilation workflow should support provider, scope, documents requested, due date, final report, and board review.

## Technical Decisions

- Recommended stack: Next.js + TypeScript + Supabase + Stripe + Cloudflare + Resend.
- UI can use Tailwind CSS plus shadcn/ui.
- Supabase Postgres fits property-centered data, permissions, payments, documents, compliance workflows, and audit logs.
- Supabase Auth can handle user identity; Row Level Security can support property-based authorization.
- Supabase Storage is acceptable for MVP document storage; Cloudflare R2 may be better for multi-HOA scale or large image/document storage.
- Stripe should process payments; app should not store payment card/bank details directly.
- Encourage ACH for dues because Stripe ACH can be cheaper for larger payments; card and ACH availability should be product-configurable.
- Cloudflare should handle DNS/CDN/bot protection; Turnstile can protect public forms, guest payment, login, and vendor proposal forms.
- Resend handles transactional email and warning emails.
- Vercel + Supabase is fastest for first production deployment; Cloudflare Pages/Workers + Supabase may lower hosting cost.

## Hosting and Pricing Assumptions

- 200-resident HOA capacity is modest; traffic spikes likely occur around dues deadlines, announcements, meetings, and document access.
- Estimated infrastructure for one HOA: approximately $30-$75/month depending on hosting and email.
- Vercel + Supabase rough cost: $45/month without paid email, $65/month with paid email.
- Cloudflare + Supabase rough cost: $30/month without paid email, $50/month with paid email.
- DigitalOcean VPS can be cheaper on paper but has higher maintenance/security burden.
- Recommended annual product pricing for up to 200 homes:
  - Launch/Core: $999/year.
  - Sustainable Core: $1,200/year.
  - Standard: $1,800/year.
  - Compliance/Operations: $2,400/year.
- Payment processor fees should be passed through to payer or HOA, not absorbed into subscription.

## Guardrails

- The product should not automatically file liens, impose legal actions, foreclose, or act as legal counsel.
- Legal-sensitive workflows should warn, document, route for review, and require board/legal approval gates.
- Workflow reminders are operational aids and must be configurable because bylaws, declarations, and laws may differ.
- Pool workflows should document maintenance and proof, but not replace legal compliance, local health rules, certified operator requirements, or insurance requirements.

## Open Questions For PRD

- Is Spring Meadow Community a planned community under Chapter 47F or condominium under Chapter 47C?
- Was the community created before or after January 1, 1999, and does the declaration affect Chapter 47F applicability?
- What are the actual bylaws/declaration requirements for meetings, notice, records, assessments, fines, and liens?
- Should the MVP include ACH, card, or both?
- Should admin users be able to manually record check/cash payments in MVP?
- Who can invite additional users to a property?
- Does the HOA need renter/tenant access separate from owner access?
- What payment processor fee policy should be used: payer pays fees, HOA absorbs fees, or configurable?
- Should board communication be threaded messages or simpler contact requests in MVP?
- Who should act as legal/compliance reviewer?
- Should the app generate legal document templates or only maintain checklists and records for externally prepared documents?
