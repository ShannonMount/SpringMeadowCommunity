---
title: "Spring Meadow Community Requirements"
status: "draft"
phase: "phase-1-requirements"
created: "2026-04-30"
updated: "2026-04-30"
source_artifacts:
  - "_bmad-output/planning-artifacts/product-brief-SpringMeadowCommunity.md"
  - "_bmad-output/planning-artifacts/product-brief-SpringMeadowCommunity-distillate.md"
  - "_bmad-output/planning-artifacts/research/domain-hoa-community-website-research-2026-04-30.md"
  - "_bmad-output/planning-artifacts/research/technical-hoa-website-stack-hosting-pricing-research-2026-04-30.md"
  - "_bmad-output/planning-artifacts/compliance-calendar-and-warning-emails.md"
output_conventions:
  architecture: "/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md"
  api: "/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md"
  data_model: "/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md"
  tasks: "/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks.md"
legal_note: "Product planning artifact only; not legal advice."
---

# Spring Meadow Community Requirements

## 1. Product Overview

Spring Meadow Community is a full-stack HOA community website and operations portal for a real North Carolina homeowners association. The product combines a public community information website with a private resident portal and a board/admin operations workspace.

The first version must prioritize resident self-service, dues payments, document access, official announcements, upcoming events, resident-to-board communication, and board compliance reminders. The product should also be designed so this first HOA deployment can become a reusable prototype for future HOA customers.

## 2. Goals

### 2.1 Resident Goals

- Residents can log in securely.
- Residents can see dues status immediately after login.
- Residents can pay dues online.
- Residents can view official HOA announcements.
- Residents can view upcoming events.
- Residents can access documents they are authorized to see.
- Residents can communicate with the HOA board.

### 2.2 Board/Admin Goals

- Board/admin users can manage properties, users, payments, documents, announcements, events, and resident messages.
- Board/admin users can preserve records and meeting documentation.
- Board/admin users receive warning emails for legally important deadlines.
- Board/admin users can track compliance workflows without relying on memory or scattered spreadsheets.
- Board/admin users can review payment and document history with auditability.
- Board/admin users can reduce the risk of missed notices, poor recordkeeping, and financial misuse.

### 2.3 Business Goals

- The first deployment serves Spring Meadow Community.
- The implementation should support future reuse for other HOAs.
- The product should be affordable to host for a community of roughly 200 residents/homes.
- The product should support future annual SaaS pricing tiers.

## 3. Users and Roles

### 3.1 Public Visitor

A public visitor can access public HOA information without logging in. This may include prospective buyers, realtors, residents who are not logged in, vendors, or general community visitors.

### 3.2 Guest Payer

A guest payer can make a dues payment toward a property using property address and/or account number. A guest payer must not see account balance, owner names, payment history, private documents, resident contact information, or any private property information. A guest payer receives only a receipt for the transaction they completed.

### 3.3 Resident

A resident has an individual login linked to one or more properties. Multiple residents may be linked to the same property and share property-level information such as dues status, payment history, documents, and board communications.

### 3.4 Board Member

A board member may also be a resident. Board members can access board workflows, records, messages, compliance calendar items, and administrative views according to their assigned permissions.

### 3.5 Admin

An admin can manage users, properties, roles, documents, payments, announcements, events, compliance settings, and system configuration.

### 3.6 Vendor Applicant

A vendor applicant can submit a public proposal for work. Vendor applicants do not automatically receive access to private vendor workflows.

### 3.7 Approved Vendor

An approved vendor has an official working relationship with the HOA and can later submit invoices/bills through a controlled portal workflow.

### 3.8 Pool Worker

A pool worker can submit pool maintenance logs when the pool module is implemented. A pool worker may also be a resident.

### 3.9 Legal/Compliance Reviewer

A legal or compliance reviewer can review sensitive workflows before external action. This role may be assigned to a board member, property manager, attorney, or other approved reviewer.

## 4. Core Product Model

### 4.1 Property-Centered Accounts

The system must treat each property address as the durable operational record.

Requirements:

- A property can have multiple linked users.
- A user can be linked to multiple properties.
- Dues, documents, requests, messages, and payment history should attach primarily to the property.
- User permissions should determine which property records a user can access.
- Board/admin roles should be separate from property membership.

### 4.2 Role and Permission Model

The system must support role-based access control and property-specific authorization.

Minimum roles:

- Public visitor
- Guest payer
- Resident
- Board member
- Admin
- Vendor applicant
- Approved vendor
- Pool worker
- Legal/compliance reviewer

Users may hold multiple roles at the same time.

## 5. MVP Scope

The MVP must include:

- Public HOA information pages.
- Resident login.
- Property-centered accounts with multiple users per property.
- Resident dashboard.
- Online dues payments.
- Guest dues payments.
- Payment records.
- Document library with privacy levels.
- HOA announcements.
- Event calendar.
- Resident-to-board communication.
- Admin tools for users, properties, payments, documents, announcements, events, and messages.
- Compliance calendar and warning emails for North Carolina HOA operations.
- Board workflow foundations for meetings, records requests, annual financial statement availability, assessment cycles, and delinquency tracking.

## 6. Functional Requirements

### 6.1 Public Website

REQ-PUB-001: The system must provide public HOA information pages.

REQ-PUB-002: The public website must not expose private resident, property, board, payment, or document data.

REQ-PUB-003: The public website should support community overview content.

REQ-PUB-004: The public website should support public contact information or a public contact form.

REQ-PUB-005: The public website should support public announcements if marked public by an authorized admin.

REQ-PUB-006: The public website should support public event listings if marked public by an authorized admin.

REQ-PUB-007: The public website should support vendor proposal intake in a later phase.

### 6.2 Authentication and Accounts

REQ-AUTH-001: The system must allow residents to log in securely.

REQ-AUTH-002: The system must allow admins to create or manage property records.

REQ-AUTH-003: The system must allow multiple users to be linked to one property.

REQ-AUTH-004: The system must allow one user to be linked to multiple properties.

REQ-AUTH-005: The system must prevent users from accessing properties they are not authorized to view.

REQ-AUTH-006: The system must support role assignment for board members, admins, vendors, pool workers, and legal/compliance reviewers.

REQ-AUTH-007: The system should support invitation-based onboarding for property users.

REQ-AUTH-008: The system should support admin-managed user/property linking.

### 6.3 Resident Dashboard

REQ-DASH-001: The resident dashboard must show dues status.

REQ-DASH-002: The resident dashboard must show a pay dues button.

REQ-DASH-003: The resident dashboard must show HOA announcements.

REQ-DASH-004: The resident dashboard must show upcoming events.

REQ-DASH-005: The resident dashboard must not expose board-only, admin-only, vendor-only, or unrelated property data.

REQ-DASH-006: The resident dashboard should provide navigation to documents, payments, property information, and board communication.

### 6.4 Payments

REQ-PAY-001: The system must allow authorized property users to pay dues online.

REQ-PAY-002: The system must allow guest payers to pay dues using property address and/or account number.

REQ-PAY-003: Guest payers must receive only a receipt for their own transaction.

REQ-PAY-004: Guest payers must not see account balance, owner names, payment history, private documents, or resident contact information.

REQ-PAY-005: Authorized property users must be able to view payment history for their property.

REQ-PAY-006: Board/admin users must be able to view payment records according to permissions.

REQ-PAY-007: The system must track payment status, including submitted, succeeded, failed, refunded, adjusted, or manually recorded.

REQ-PAY-008: The system must store payment processor references such as Stripe session or payment intent IDs.

REQ-PAY-009: The system must support card payments through Stripe.

REQ-PAY-010: The system should support ACH payments through Stripe if enabled.

REQ-PAY-011: The system should allow payment processor fees to be passed through to payer or HOA based on configuration.

REQ-PAY-012: The system should support manual recording of check/cash/offline payments if included in MVP configuration.

REQ-PAY-013: The system must not store raw card or bank account details.

### 6.5 Assessments and Dues

REQ-ASMT-001: The system must support annual assessment schedules.

REQ-ASMT-002: The system should support monthly, quarterly, annual, and special assessment schedules.

REQ-ASMT-003: Assessment records must attach to properties.

REQ-ASMT-004: The system must track due date, amount, paid amount, balance, status, and payment history.

REQ-ASMT-005: The system should track late fees or interest according to configured governing documents and applicable law.

REQ-ASMT-006: The system should generate delinquency reports for board/admin review.

### 6.6 Documents

REQ-DOC-001: The system must provide a document library.

REQ-DOC-002: Documents must have visibility levels.

Minimum visibility levels:

- Public
- Resident
- Board
- Vendor
- Property-specific
- Admin

REQ-DOC-003: The system must prevent users from accessing documents outside their permission scope.

REQ-DOC-004: The system must support property-specific documents.

REQ-DOC-005: The system must support resident-visible documents.

REQ-DOC-006: The system must support board-only documents.

REQ-DOC-007: The system must support admin-only documents.

REQ-DOC-008: The system should support document categories such as governing documents, bylaws, meeting minutes, financial notices, dues notices, property notices, architectural approvals, violation records, vendor contracts, pool records, and forms.

REQ-DOC-009: The system should support document effective dates and expiration dates.

REQ-DOC-010: The system should audit uploads, edits, deletions, downloads, and visibility changes for sensitive documents.

### 6.7 Announcements

REQ-ANN-001: Board/admin users must be able to create HOA announcements.

REQ-ANN-002: Announcements must support visibility targeting.

REQ-ANN-003: Resident-visible announcements must appear on the resident dashboard.

REQ-ANN-004: Public announcements may appear on the public website if marked public.

REQ-ANN-005: Announcements should support publish date, expiration date, pinned status, and attachments.

### 6.8 Events

REQ-EVT-001: Board/admin users must be able to create events.

REQ-EVT-002: Upcoming events must appear on the resident dashboard.

REQ-EVT-003: Events must support date, time, location, description, and visibility.

REQ-EVT-004: Events should support HOA meetings, board meetings, community events, pool events/closures, maintenance windows, and dues deadlines.

### 6.9 Resident-to-Board Communication

REQ-MSG-001: Residents must be able to send messages to the HOA board.

REQ-MSG-002: Messages must be linked to the sending user and property.

REQ-MSG-003: Board/admin users must be able to review and respond to resident messages.

REQ-MSG-004: Messages should support categories such as dues, documents, maintenance, architectural, complaint, and general question.

REQ-MSG-005: The system must preserve message history according to retention settings.

### 6.10 Admin Tools

REQ-ADM-001: Admin users must be able to manage properties.

REQ-ADM-002: Admin users must be able to manage users.

REQ-ADM-003: Admin users must be able to link users to properties.

REQ-ADM-004: Admin users must be able to manage roles and permissions.

REQ-ADM-005: Admin users must be able to manage documents.

REQ-ADM-006: Admin users must be able to manage announcements.

REQ-ADM-007: Admin users must be able to manage events.

REQ-ADM-008: Admin users must be able to review payment records.

REQ-ADM-009: Admin users must be able to configure compliance calendar settings.

## 7. North Carolina Compliance Requirements

These requirements are operational aids and are not legal advice. The system must be configurable because actual duties depend on North Carolina law, governing documents, bylaws, declarations, and legal review.

### 7.1 Compliance Calendar

REQ-COMP-001: The system must provide a board/admin compliance calendar.

REQ-COMP-002: The compliance calendar must support statutory, bylaw, board-configured, and manually created deadlines.

REQ-COMP-003: The compliance calendar must support warning emails.

REQ-COMP-004: Compliance calendar items must support status values such as upcoming, in progress, ready for review, completed, blocked, deferred, overdue, and legal review required.

REQ-COMP-005: The system must record completion evidence for compliance tasks.

REQ-COMP-006: The system must support escalation levels: informational, warning, critical, overdue, and legal-sensitive.

### 7.2 Annual Association Meeting

REQ-MTG-001: The system must support creation of annual association meetings.

REQ-MTG-002: The system must track that at least one association meeting is scheduled each year.

REQ-MTG-003: The system must calculate the meeting notice window using configurable rules.

REQ-MTG-004: For North Carolina default configuration, the notice window must show earliest allowed notice date as meeting date minus 60 days and latest allowed notice date as meeting date minus 10 days.

REQ-MTG-005: The system must warn if notice is attempted outside the configured notice window.

REQ-MTG-006: Meeting notices must include time, place, and agenda.

REQ-MTG-007: The system must flag agenda items involving declaration/bylaw amendments, budget changes, or director/officer removal.

REQ-MTG-008: The system must track notice method, notice content, recipients, and sent timestamp.

REQ-MTG-009: The system must support draft notes, approved minutes, attendance, motions, votes, and attachments.

### 7.3 Executive Board Meetings

REQ-BMTG-001: The system must support recurring executive board meetings.

REQ-BMTG-002: The system must track whether a board meeting includes an owner comment opportunity.

REQ-BMTG-003: The system should warn if owner comment opportunity is overdue according to configured interval.

REQ-BMTG-004: The system must separate board-only notes from resident-visible meeting records.

### 7.4 Annual Financial Statement and Balance Sheet

REQ-FIN-001: The system must allow configuration of fiscal year close date.

REQ-FIN-002: The system must create an annual financial statement deadline based on fiscal year close.

REQ-FIN-003: For North Carolina default configuration, the annual income and expense statement and balance sheet deadline must be fiscal year close plus 75 days.

REQ-FIN-004: The system must track preparation, board review, upload, resident availability, and completion status.

REQ-FIN-005: The annual financial statement task must not be marked complete until the required documents are resident-accessible or otherwise completed according to configuration.

### 7.5 Records Requests

REQ-REC-001: The system must support owner or authorized-agent records requests.

REQ-REC-002: A records request must track requester, property, requested documents, request date, assigned user, due date, response, attachments, and status.

REQ-REC-003: The system must support a special unpaid assessment statement request type.

REQ-REC-004: For North Carolina default configuration, unpaid assessment statement requests must be due within 10 business days after receipt.

REQ-REC-005: The system must support warning emails before records request due dates and daily overdue reminders until resolved.

### 7.6 Audit, Review, or Compilation Workflow

REQ-AUD-001: The system must support optional audit, review, or compilation workflows.

REQ-AUD-002: The workflow must track who voted to require the audit/review/compilation.

REQ-AUD-003: The workflow must track provider, scope, requested documents, target due date, status, and final report.

REQ-AUD-004: The final report should be linkable to the document library with appropriate visibility.

REQ-AUD-005: The system should remind the board to review fidelity/crime insurance coverage during the annual audit cycle.

### 7.7 Delinquency and Lien Preparation

REQ-LIEN-001: The system must support delinquency tracking for unpaid assessments.

REQ-LIEN-002: The system must create lien-readiness tasks only after configured delinquency criteria are met.

REQ-LIEN-003: For North Carolina default configuration, lien-readiness review may begin after an assessment remains unpaid for at least 30 days.

REQ-LIEN-004: The system must require address verification before pre-lien notice.

REQ-LIEN-005: Address verification must track physical lot address, owner address of record, county tax record address if different, and registered agent address if owner is a corporation or LLC.

REQ-LIEN-006: The system must track pre-lien statement mailing date.

REQ-LIEN-007: For North Carolina default configuration, the system must prevent ready-for-legal-review status until at least 15 days after pre-lien statement mailing.

REQ-LIEN-008: If a lien is filed externally, the system must track lien filing date.

REQ-LIEN-009: If a lien is filed externally, the system must create a three-year enforcement deadline reminder from filing date.

REQ-LIEN-010: The system must require legal/compliance review before filing, foreclosure-related tracking, or other legal-sensitive action.

REQ-LIEN-011: The system must not automatically file liens.

### 7.8 Fines and Suspension

REQ-FINE-001: The system should support violation, fine, and suspension workflows in a later phase.

REQ-FINE-002: The workflow must track notice of charge, hearing date, evidence, decision, decision notice, appeal deadline, and appeal status.

REQ-FINE-003: For North Carolina default configuration, the workflow must create a 15-day appeal deadline after decision.

REQ-FINE-004: The system must not allow a fine or suspension workflow to be marked complete without required notice, opportunity to be heard, decision notice, and legal/compliance review status.

## 8. Financial Safeguards

REQ-SAFE-001: The system must keep audit logs for sensitive financial and administrative actions.

REQ-SAFE-002: Audit logs must record actor, action, target record, timestamp, previous value where appropriate, new value where appropriate, and source context.

REQ-SAFE-003: Board/admin users must not be able to erase audit history through normal application workflows.

REQ-SAFE-004: The system should support two-person approval for sensitive actions in later phases.

Sensitive actions include:

- Vendor creation
- Vendor payment detail changes
- Bill approvals
- Refunds
- Reserve transfers
- Manual payment adjustments
- Document visibility changes
- Legal-sensitive workflow completion

REQ-SAFE-005: The system should provide read-only financial visibility for board members according to permissions.

REQ-SAFE-006: The system should support monthly reconciliation workflows in a later phase.

REQ-SAFE-007: The system should support annual audit/review/compilation package exports in a later phase.

## 9. Later-Phase Functional Areas

### 9.1 Community Posts

REQ-POST-001: Residents should be able to submit community posts in a later phase.

REQ-POST-002: Community posts must require moderation before publication.

REQ-POST-003: Board/admin users must be able to approve, reject, or request revisions.

REQ-POST-004: Board/admin announcements must remain distinct from resident community posts.

### 9.2 Maintenance Requests

REQ-MAINT-001: Residents should be able to submit maintenance requests in a later phase.

REQ-MAINT-002: Maintenance requests should support category, property/common-area indicator, description, photos, status, assignment, and resolution notes.

### 9.3 Architectural Requests

REQ-ARCH-001: Residents should be able to submit architectural requests in a later phase.

REQ-ARCH-002: Architectural requests should support request type, property link, description, attachments/plans, review status, board/committee notes, decision date, and approval/denial letter.

### 9.4 Vendor Workflows

REQ-VEND-001: Any vendor should be able to submit a proposal publicly in a later phase.

REQ-VEND-002: Vendor proposals should include vendor name, contact information, work category, description, proposed amount or range, attachments, and insurance/license information where relevant.

REQ-VEND-003: Board/admin users should be able to approve a vendor as an official vendor.

REQ-VEND-004: Approved vendors should be able to submit invoices/bills through the portal.

REQ-VEND-005: Vendor invoices should include invoice number, amount, due date, work category, attachments, related project/request, and status.

REQ-VEND-006: Board/admin users should be able to approve, reject, mark paid, or comment on vendor invoices according to permissions.

### 9.5 Pool Maintenance

REQ-POOL-001: The system should support a pool maintenance module in a later phase.

REQ-POOL-002: Pool workers should be assignable without requiring a separate account type.

REQ-POOL-003: Pool maintenance logs should include worker name, date, timestamp, daily checklist, chemical readings, proof photos, optional condition photos, and notes.

REQ-POOL-004: Chemical reading fields should support free chlorine or sanitizer reading, pH, total alkalinity, stabilizer/cyanuric acid if used, calcium hardness if tracked, water temperature if useful, and water clarity.

REQ-POOL-005: Board/admin users should be able to review pool logs.

REQ-POOL-006: The system should alert when daily maintenance logs are missing.

REQ-POOL-007: The system should alert when chemical readings are outside configured ranges.

REQ-POOL-008: Chemical thresholds must be configurable and should not be hardcoded without confirming local health code, pool type, chemical system, and HOA policy.

## 10. Nonfunctional Requirements

### 10.1 Security

REQ-NFR-SEC-001: The system must enforce authentication for private portal access.

REQ-NFR-SEC-002: The system must enforce authorization for property-specific records.

REQ-NFR-SEC-003: The system must enforce authorization for role-specific features.

REQ-NFR-SEC-004: The system must protect private documents using private storage and signed access or equivalent controls.

REQ-NFR-SEC-005: The system must verify payment processor webhooks.

REQ-NFR-SEC-006: The system should use bot protection on public forms, guest payments, and login-adjacent flows.

REQ-NFR-SEC-007: The system must maintain audit logs for sensitive actions.

### 10.2 Privacy

REQ-NFR-PRIV-001: The system must prevent guest payers from seeing private property information.

REQ-NFR-PRIV-002: The system must prevent residents from seeing other properties' private records unless explicitly authorized.

REQ-NFR-PRIV-003: The system must separate public, resident, board, vendor, property-specific, and admin document visibility.

REQ-NFR-PRIV-004: The system should support retention policies for messages, documents, payment records, and compliance records.

### 10.3 Reliability and Backup

REQ-NFR-REL-001: The production system must use managed database backups or an equivalent backup strategy.

REQ-NFR-REL-002: The system should support recovery of critical records.

REQ-NFR-REL-003: The system should monitor failed payment webhooks, failed email delivery, and background job failures.

### 10.4 Performance and Capacity

REQ-NFR-PERF-001: The system must support at least 200 residents/homes for the first community.

REQ-NFR-PERF-002: The system should be designed for traffic spikes around dues deadlines, announcements, meetings, and document access.

REQ-NFR-PERF-003: The resident dashboard should load quickly under expected community usage.

### 10.5 Accessibility

REQ-NFR-A11Y-001: The public website and resident portal should target WCAG 2.1 AA accessibility practices.

REQ-NFR-A11Y-002: Payment, document, dashboard, and admin workflows should be keyboard navigable.

REQ-NFR-A11Y-003: Form errors and warnings should be readable by assistive technologies.

### 10.6 Maintainability

REQ-NFR-MAINT-001: The system should use TypeScript for type safety.

REQ-NFR-MAINT-002: The system should use a relational data model suitable for properties, users, payments, documents, compliance workflows, and audit logs.

REQ-NFR-MAINT-003: The system should keep legal/compliance deadlines configurable.

REQ-NFR-MAINT-004: The system should keep future multi-HOA support in mind without overcomplicating the first release.

## 11. Technical Direction

The recommended stack is:

- Next.js
- TypeScript
- Tailwind CSS and a reusable component system
- Supabase Postgres
- Supabase Auth
- Supabase Storage for MVP documents
- Stripe for payments
- Cloudflare for DNS/CDN/bot protection
- Resend for transactional and warning emails

Hosting options:

- Vercel plus Supabase for fastest first production deployment.
- Cloudflare Pages/Workers plus Supabase for lower managed hosting cost.

The architecture document must be saved to:

`/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md`

The API and data model documents must be saved to:

`/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md`

`/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md`

The task breakdown must be saved to:

`/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-4-tasks/tasks.md`

## 12. Pricing and Commercial Requirements

REQ-BIZ-001: The product should be affordable to host for a 200-resident/home HOA.

REQ-BIZ-002: Initial infrastructure target should be approximately $30-$75/month depending on hosting and email choices.

REQ-BIZ-003: Payment processor fees should be passed through to payer or HOA based on configuration.

REQ-BIZ-004: Future commercial pricing should support annual plans.

Recommended annual pricing for up to 200 homes:

- Launch/Core: $999/year.
- Sustainable Core: $1,200/year.
- Standard: $1,800/year.
- Compliance/Operations: $2,400/year.

## 13. Out of Scope for MVP

The following are out of scope for MVP unless explicitly pulled forward:

- Community posts.
- Maintenance requests.
- Architectural requests.
- Vendor proposal intake.
- Approved vendor invoice portal.
- Board bill approval.
- Pool maintenance module.
- Fine/suspension workflow execution.
- Lien filing or foreclosure automation.
- Multi-HOA self-service onboarding.
- Full accounting system replacement.
- Legal document generation without attorney review.

## 14. Open Questions

- Is Spring Meadow Community legally a planned community under Chapter 47F or a condominium under Chapter 47C?
- Was the community created before or after January 1, 1999?
- What do the HOA declaration and bylaws require for meetings, notices, records, assessments, fines, and liens?
- Should MVP payments support card only, ACH only, or both?
- Should admin users be able to manually record check/cash payments in MVP?
- Who can invite additional users to a property?
- Does the HOA need renter/tenant access separate from owner access?
- Should payer fees be paid by resident/guest, HOA, or configurable per community?
- Should resident-to-board communication be threaded messaging or simple contact requests in MVP?
- Who should act as legal/compliance reviewer?
- Should the product generate legal document templates, or only maintain checklists and records for externally prepared legal documents?
- What are the HOA's pool chemical standards, local health requirements, and operator training requirements?

## 15. Acceptance Criteria Summary

The Phase 1 requirements are complete when:

- MVP resident workflows are clearly defined.
- MVP board/admin workflows are clearly defined.
- Property-centered account requirements are clear.
- Guest payment privacy requirements are clear.
- Document visibility requirements are clear.
- North Carolina compliance calendar requirements are clear.
- Legal-sensitive workflow guardrails are clear.
- Technical direction is documented.
- Later-phase features are separated from MVP.
- Destination paths for architecture, API, data model, and tasks are recorded.
