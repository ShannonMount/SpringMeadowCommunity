---
stepsCompleted: ["step-01-requirements-extracted", "step-02-epics-approved", "step-03-epic-1-drafted", "step-03-epic-2-drafted", "step-03-epic-3-drafted", "step-03-epic-4-drafted", "step-03-epic-5-drafted", "step-03-epic-6-drafted", "step-03-epic-7-drafted", "step-03-all-epics-drafted", "step-04-final-validation-complete"]
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
  - "docs/bmad/phase-1-requirements/requirements.md"
  - "docs/bmad/phase-2-architecture/architecture.md"
  - "docs/bmad/phase-3-design/api.md"
  - "docs/bmad/phase-3-design/data-model.md"
  - "docs/bmad/phase-4-tasks/tasks-v1.md"
excludedDocuments:
  - "docs/bmad/phase-3-design/data-model-v1.md"
---

# SpringMeadowCommunity - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for SpringMeadowCommunity, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Provide public HOA information pages without exposing private resident, property, board, payment, or document data.

FR2: Support public community overview content, public contact information or a public contact form, public announcements, and public event listings.

FR3: Support future public vendor proposal intake as a later-phase capability.

FR4: Allow residents to log in securely.

FR5: Allow admins to create and manage property records.

FR6: Support property-centered accounts where multiple users can be linked to one property and one user can be linked to multiple properties.

FR7: Prevent users from accessing properties they are not authorized to view.

FR8: Support role assignment for residents, board members, admins, vendor applicants, approved vendors, pool workers, and legal/compliance reviewers.

FR9: Support invitation-based onboarding and admin-managed user/property linking.

FR10: Provide a resident dashboard showing dues status, a pay dues button, HOA announcements, upcoming events, and navigation to documents, payments, property information, and board communication.

FR11: Ensure the resident dashboard does not expose board-only, admin-only, vendor-only, or unrelated property data.

FR12: Allow authorized property users to pay dues online.

FR13: Allow guest payers to pay dues using property address, account number, and/or public payment code without disclosing private property information.

FR14: Ensure guest payers receive only their own receipt and cannot see balance, owner names, payment history, private documents, or resident contact information.

FR15: Allow authorized property users to view payment history for their property.

FR16: Allow board/admin users to view payment records according to permissions.

FR17: Track payment status, processor references, receipt references, payer type, payment method, fees, and allocation to assessments.

FR18: Support Stripe card payments and optional Stripe ACH payments.

FR19: Support configurable payment fee policy and optional manual recording of check/cash/offline payments.

FR20: Never store raw card or bank account details.

FR21: Support annual assessment schedules and later monthly, quarterly, annual, and special assessment schedules.

FR22: Attach assessment records to properties and track due date, amount, paid amount, balance, status, late fees, interest, and payment history.

FR23: Generate delinquency reports for board/admin review.

FR24: Provide a document library with public, resident, board, vendor, property-specific, and admin visibility levels.

FR25: Prevent users from accessing documents outside their permission scope.

FR26: Support property-specific, resident-visible, board-only, and admin-only documents.

FR27: Support document categories, effective dates, expiration dates, private storage metadata, signed download URLs, and document access logs.

FR28: Audit uploads, edits, deletions, downloads, and visibility changes for sensitive documents.

FR29: Allow board/admin users to create, edit, publish, pin, expire, archive, and attach files to announcements with visibility targeting.

FR30: Show resident-visible announcements on the resident dashboard and public announcements on the public website when marked public.

FR31: Allow board/admin users to create, edit, cancel, archive, and display events with date, time, location, description, type, and visibility.

FR32: Show upcoming resident-visible events on the resident dashboard and public events publicly when marked public.

FR33: Allow residents to send categorized messages to the HOA board linked to the sending user and property.

FR34: Allow board/admin users to review, assign, reply to, close, and archive resident message threads.

FR35: Preserve message history according to retention settings and support message notifications.

FR36: Provide admin tools for properties, users, property memberships, roles, documents, announcements, events, payment records, assessments, compliance settings, and audit logs.

FR37: Provide a board/admin compliance calendar supporting statutory, bylaw, board-configured, and manual deadlines.

FR38: Support compliance warning emails, completion evidence, assigned users, statuses, priorities, escalation levels, and legal-sensitive flags.

FR39: Support annual association meeting creation and track that at least one association meeting is scheduled each year.

FR40: Calculate configurable annual meeting notice windows, with North Carolina defaults of earliest notice at meeting date minus 60 days and latest notice at meeting date minus 10 days.

FR41: Warn or block meeting notice attempts outside the configured notice window, with override only if configured.

FR42: Track meeting notice method, content, recipients, sent timestamp, agenda, special agenda flags, attendance, motions, votes, draft notes, approved minutes, and attachments.

FR43: Support recurring executive board meetings, track owner comment opportunities, warn when comment opportunity is overdue, and separate board-only notes from resident-visible records.

FR44: Allow configuration of fiscal year close date and create annual financial statement deadlines from fiscal year close.

FR45: Use the North Carolina default annual income/expense statement and balance sheet deadline of fiscal year close plus 75 days.

FR46: Track annual financial statement preparation, board review, document upload, resident availability, and completion status.

FR47: Prevent annual financial statement completion until required documents are resident-accessible or explicitly completed according to configuration.

FR48: Support owner or authorized-agent records requests, including special unpaid assessment statement requests.

FR49: Track records request requester, property, requested documents, request date, assigned user, due date, response, attachments, status, and fulfillment.

FR50: Use the North Carolina default unpaid assessment statement due date of 10 business days after receipt.

FR51: Send warning emails before records request due dates and daily overdue reminders until resolved.

FR52: Support optional audit, review, or compilation workflows with vote tracking, provider, scope, requested documents, target due date, status, final report, and fidelity/crime insurance reminders.

FR53: Support delinquency tracking for unpaid assessments and create lien-readiness tasks only after configured delinquency criteria are met.

FR54: Use North Carolina defaults of lien-readiness review after at least 30 days unpaid and ready-for-legal-review only after at least 15 days after pre-lien statement mailing.

FR55: Require address verification before pre-lien notice and track physical lot address, owner address of record, county tax record address, and registered agent address when applicable.

FR56: Track pre-lien mailing date, external lien filing date if any, and a three-year enforcement deadline reminder from filing date.

FR57: Require legal/compliance review before filing, foreclosure-related tracking, or other legal-sensitive action, and never automatically file liens.

FR58: Support violation, fine, and suspension workflows in a later phase with notice, hearing, evidence, decision, decision notice, appeal deadline, appeal status, and legal/compliance review.

FR59: Keep audit logs for sensitive financial and administrative actions, including payment changes, manual adjustments, document visibility changes, role changes, property membership changes, compliance workflow completion, lien/fine/suspension status changes, and later vendor payment detail changes.

FR60: Prevent board/admin users from erasing audit history through normal application workflows.

FR61: Support later two-person approval for sensitive actions, monthly reconciliation workflows, and annual audit/review/compilation package exports.

FR62: Support later community posts with moderation and separation from official board/admin announcements.

FR63: Support later maintenance requests with category, property/common-area indicator, description, photos, status, assignment, and resolution notes.

FR64: Support later architectural requests with property links, attachments/plans, review status, board/committee notes, decision date, and approval/denial letter.

FR65: Support later vendor proposal, approved vendor, invoice, bill approval, rejection, paid-state, and comment workflows.

FR66: Support later pool maintenance with worker assignment, daily logs, chemical readings, photos, review, missing-log alerts, out-of-range alerts, and configurable chemical thresholds.

FR67: Support business requirements for affordable 200-home HOA hosting, configurable fee policy, and future annual SaaS pricing tiers.

### NonFunctional Requirements

NFR1: Enforce authentication for private portal access.

NFR2: Enforce authorization for property-specific records.

NFR3: Enforce authorization for role-specific features.

NFR4: Protect private documents using private storage and signed access or equivalent controls.

NFR5: Verify payment processor webhooks.

NFR6: Use bot protection on public forms, guest payments, and login-adjacent flows where appropriate.

NFR7: Maintain audit logs for sensitive actions.

NFR8: Prevent guest payers from seeing private property information.

NFR9: Prevent residents from seeing other properties' private records unless explicitly authorized.

NFR10: Separate public, resident, board, vendor, property-specific, and admin document visibility.

NFR11: Support retention policies for messages, documents, payment records, and compliance records.

NFR12: Use managed database backups or an equivalent production backup strategy.

NFR13: Support recovery of critical records.

NFR14: Monitor failed payment webhooks, failed email delivery, and background job failures.

NFR15: Support at least 200 residents/homes for the first community.

NFR16: Handle expected traffic spikes around dues deadlines, announcements, meetings, and document access.

NFR17: Keep the resident dashboard fast under expected community usage.

NFR18: Target WCAG 2.1 AA accessibility practices for the public website and resident portal.

NFR19: Ensure payment, document, dashboard, and admin workflows are keyboard navigable.

NFR20: Ensure form errors and warnings are readable by assistive technologies.

NFR21: Use TypeScript for type safety.

NFR22: Use a relational data model suitable for properties, users, payments, documents, compliance workflows, and audit logs.

NFR23: Keep legal/compliance deadlines configurable.

NFR24: Keep future multi-HOA support in mind without overcomplicating the first release.

### Additional Requirements

- Use Next.js with TypeScript and the App Router for the public site, authenticated portal, admin workspace, server actions, route handlers, and Stripe webhook routes.

- Use Tailwind CSS and a reusable component library for UI implementation.

- Use Supabase Postgres, Supabase Auth, and Supabase Storage for MVP data, authentication, and documents.

- Use Stripe Checkout or Stripe Payment Element for payment flows.

- Use Resend for transactional, receipt, invitation, message notification, and compliance warning emails.

- Use Cloudflare for DNS/CDN/bot protection and Turnstile verification on public abuse-prone endpoints.

- Deploy the MVP on Vercel plus Supabase unless a later decision selects the Cloudflare Pages/Workers alternate path.

- Scope core business tables by `community_id` from the beginning.

- Model the property as the durable operational record and use `property_memberships` for user-property relationships.

- Keep user profile data in application tables while Supabase Auth owns credentials and sessions.

- Use layered authorization: authenticated user, community scope, role/permission, property membership, and document/workflow-specific checks.

- Enable Supabase RLS on core private tables as defense in depth.

- Restrict Supabase service-role usage to trusted server code only and never expose service-role keys to the browser.

- Store money as integer cents and never use floating point for money values.

- Use UUID primary keys and recommended Postgres extensions `pgcrypto` and `citext`.

- Implement Stripe webhook processing with raw body handling, signature verification, idempotent event storage, payment updates, allocation updates, receipt email triggering, and audit logging.

- Implement document downloads through server-side authorization and short-lived signed URLs.

- Implement compliance deadline generation and reminder jobs as idempotent background or scheduled work.

- Use Vercel Cron Jobs or Supabase scheduled Edge Functions for reminders, with secured job endpoints and job run logging.

- Centralize validation at API boundaries using Zod or equivalent runtime validation.

- Use a consistent API error shape with code, message, optional field errors, and request ID.

- Create shared server domains for auth, authorization, properties, payments, documents, compliance, email, audit, storage, and third-party clients.

- Create environment schema for Supabase, Stripe, Resend, Cloudflare Turnstile, app URL, and cron secret.

- Include observability for application errors, Stripe webhooks, email sends, compliance jobs, and audit logs.

- Seed the initial Spring Meadow Community record, default roles, and default compliance settings.

- Generate Supabase TypeScript database types after RLS and schema migrations are in place.

- Build quality gates for authorization helper tests, payment tests, compliance deadline tests, document access tests, resident E2E workflow, and admin E2E workflow.

### UX Design Requirements

UX-DR1: Create a public website navigation model with Home, About/Community Info, Announcements, Events, Documents/Public Resources, Contact, Pay Dues, and Login.

UX-DR2: Create a resident portal navigation model with Dashboard, Payments, Documents, Announcements, Events, Contact Board, and My Property.

UX-DR3: Create a board/admin navigation model with Dashboard, Properties, Users, Payments, Assessments, Documents, Announcements, Events, Messages, Compliance Calendar, Records Requests, Audit Logs, and Settings.

UX-DR4: Provide reusable UI components for buttons, inputs, forms, dialogs, menus, tables, badges, alerts, tabs, cards, loading states, empty states, error states, data tables, calendar views, document lists, upload controls, visibility badges, and download actions.

UX-DR5: Provide form utilities for fields, validation errors, submit buttons, and server action response patterns.

UX-DR6: Provide admin data table patterns for sorting and filtering repeated operational records.

UX-DR7: Provide calendar UI patterns for public events, resident events, and admin compliance items.

UX-DR8: Provide document UI patterns for file picking, upload progress, document lists, visibility indicators, and download actions.

UX-DR9: Ensure public, payment, document, dashboard, and admin workflows are keyboard navigable and expose form errors and warnings accessibly.

UX-DR10: Ensure the resident dashboard presents dues status, payment action, announcements, and events without exposing unrelated private data.

UX-DR11: Ensure guest payment screens communicate only privacy-safe confirmation and receipt states, never owner, balance, document, or history details.

UX-DR12: Ensure admin screens are organized for repeated operational work across properties, users, payments, documents, messages, compliance, records, meetings, financial statements, and audit logs.

### FR Coverage Map

FR1: Epic 1 - Public HOA website and community information.

FR2: Epic 1 - Public community content, contact, announcements, and events.

FR3: Epic 8 - Later public vendor proposal intake.

FR4: Epic 2 - Resident authentication.

FR5: Epic 5 - Admin property management.

FR6: Epic 2 - Property-centered resident accounts.

FR7: Epic 2 - Property access authorization.

FR8: Epic 2 and Epic 5 - Role model for residents, board/admin, vendors, pool workers, and legal reviewers.

FR9: Epic 2 and Epic 5 - Invitation onboarding and admin-managed property linking.

FR10: Epic 2 - Resident dashboard.

FR11: Epic 2 - Resident dashboard privacy boundaries.

FR12: Epic 3 - Resident online dues payments.

FR13: Epic 3 - Guest payment flow.

FR14: Epic 3 - Guest payment privacy.

FR15: Epic 3 - Resident property payment history.

FR16: Epic 3 and Epic 5 - Board/admin payment record visibility.

FR17: Epic 3 - Payment status, references, fee, and allocation tracking.

FR18: Epic 3 - Stripe card and optional ACH support.

FR19: Epic 3 - Fee policy and optional manual payments.

FR20: Epic 3 - Payment data safety.

FR21: Epic 3 - Assessment schedules.

FR22: Epic 3 - Property assessments and balances.

FR23: Epic 3 - Delinquency reporting.

FR24: Epic 4 - Document library and visibility levels.

FR25: Epic 4 - Document authorization.

FR26: Epic 4 - Property, resident, board, and admin documents.

FR27: Epic 4 - Document metadata, storage, signed URLs, and access logs.

FR28: Epic 4 - Document audit trail.

FR29: Epic 1 and Epic 4 - Announcement creation and lifecycle.

FR30: Epic 1 and Epic 4 - Public and resident announcement display.

FR31: Epic 1 and Epic 4 - Event creation and lifecycle.

FR32: Epic 1 and Epic 4 - Public and resident event display.

FR33: Epic 4 - Resident-to-board messaging.

FR34: Epic 4 - Board/admin message handling.

FR35: Epic 4 - Message history and notifications.

FR36: Epic 5 - Admin operations workspace.

FR37: Epic 6 - Compliance calendar.

FR38: Epic 6 - Compliance warnings, evidence, assignments, statuses, and escalation.

FR39: Epic 6 - Annual meeting creation and yearly tracking.

FR40: Epic 6 - Meeting notice window calculation.

FR41: Epic 6 - Meeting notice guardrails.

FR42: Epic 6 - Meeting notice, agenda, attendance, motions, minutes, and attachments.

FR43: Epic 6 - Executive board meeting tracking.

FR44: Epic 6 - Fiscal year close configuration.

FR45: Epic 6 - Annual financial statement 75-day deadline.

FR46: Epic 6 - Annual financial statement workflow tracking.

FR47: Epic 6 - Annual financial statement completion guardrail.

FR48: Epic 6 - Records requests.

FR49: Epic 6 - Records request details and fulfillment.

FR50: Epic 6 - Unpaid assessment statement due-date rule.

FR51: Epic 6 - Records request reminders.

FR52: Epic 6 - Audit, review, and compilation workflows.

FR53: Epic 7 - Delinquency tracking and lien-readiness tasks.

FR54: Epic 7 - NC delinquency and pre-lien timing defaults.

FR55: Epic 7 - Address verification for pre-lien notice.

FR56: Epic 7 - Pre-lien, lien filing, and enforcement reminder tracking.

FR57: Epic 7 - Legal/compliance review gates and no automatic legal actions.

FR58: Epic 7 and Epic 8 - Fine/suspension workflow guardrails, with execution later.

FR59: Epic 5 and Epic 7 - Audit logs for sensitive actions.

FR60: Epic 5 and Epic 7 - Audit history immutability through normal workflows.

FR61: Epic 7 and Epic 8 - Later approvals, reconciliation, and export workflows.

FR62: Epic 8 - Later moderated community posts.

FR63: Epic 8 - Later maintenance requests.

FR64: Epic 8 - Later architectural requests.

FR65: Epic 8 - Later vendor proposal, vendor, invoice, and approval workflows.

FR66: Epic 8 - Later pool maintenance module.

FR67: Epic 3 and Epic 8 - Affordable 200-home HOA hosting, fee policy, and future SaaS pricing.

## Epic List

### Epic 1: Public HOA Website and Community Information

Public visitors can find official community information, announcements, events, public documents, contact options, login, and dues payment entry points without accessing private HOA data.

**FRs covered:** FR1, FR2, FR3, FR29, FR30, FR31, FR32

### Epic 2: Resident Accounts, Property Access, and Dashboard

Residents can securely log in, access only their linked properties, see dues status, and navigate core self-service workflows.

**FRs covered:** FR4, FR6, FR7, FR8, FR9, FR10, FR11

### Epic 3: Assessments and Online Payments

Residents and guest payers can pay dues safely, while admins can track assessments, payments, fees, allocations, and payment history.

**FRs covered:** FR12, FR13, FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR67

### Epic 4: Documents, Announcements, Events, and Resident Messaging

Residents and board/admin users can access documents, official content, events, and resident-to-board communication with proper visibility controls.

**FRs covered:** FR24, FR25, FR26, FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR35

### Epic 5: Board/Admin Operations Workspace

Admins can manage properties, users, memberships, roles, assessments, documents, announcements, events, messages, payments, settings, and audit visibility.

**FRs covered:** FR5, FR8, FR9, FR16, FR36, FR59, FR60

### Epic 6: Compliance Calendar, Meetings, Records, and Financial Deadlines

Board/admin users can track North Carolina HOA compliance deadlines, warning emails, meetings, records requests, annual financial statement workflows, and completion evidence.

**FRs covered:** FR37, FR38, FR39, FR40, FR41, FR42, FR43, FR44, FR45, FR46, FR47, FR48, FR49, FR50, FR51, FR52

### Epic 7: Delinquency and Legal-Sensitive Workflow Guardrails

Board/admin/legal reviewers can track delinquency and lien-readiness workflows with required review gates and no automated legal action.

**FRs covered:** FR53, FR54, FR55, FR56, FR57, FR58, FR59, FR60, FR61

### Epic 8: Later-Phase Expansion Modules

The product preserves future expansion paths for community posts, maintenance, architectural requests, vendor workflows, pool maintenance, approvals, reconciliation, exports, and SaaS commercialization without pulling those capabilities into the MVP.

**FRs covered:** FR3, FR58, FR61, FR62, FR63, FR64, FR65, FR66, FR67

## Epic 1: Public HOA Website and Community Information

Public visitors can find official community information, announcements, events, public documents, contact options, login, and dues payment entry points without accessing private HOA data.

Relevant requirements: FR1, FR2, FR3, FR29, FR30, FR31, FR32; NFR6, NFR15, NFR16, NFR18, NFR19, NFR20; UX-DR1, UX-DR7, UX-DR9, UX-DR11.

### Story 1.1: Public Website Shell and Navigation

As a public visitor,
I want a public Spring Meadow Community website with clear navigation,
So that I can find official community information and entry points without logging in.

**Acceptance Criteria:**

**Given** a visitor opens the public website
**When** the page loads
**Then** the visitor sees public navigation for Home, About/Community Info, Announcements, Events, Documents/Public Resources, Contact, Pay Dues, and Login
**And** no private resident, property, board, payment, or document data is rendered.

**Given** the visitor uses a keyboard
**When** they tab through the public navigation
**Then** each navigation item receives a visible focus state
**And** the navigation can be used without a mouse.

**Given** the visitor is on a mobile viewport
**When** they open the navigation
**Then** all public routes remain reachable
**And** navigation text does not overlap or overflow its controls.

### Story 1.2: Public Home and Community Information Pages

As a public visitor,
I want public community overview and HOA information pages,
So that I can understand the community and find official public resources.

**Acceptance Criteria:**

**Given** public community content exists
**When** a visitor opens the home or community information page
**Then** the page displays public-facing community overview content
**And** the page does not query or expose private resident, property, board, payment, or document data.

**Given** community content is unavailable or not configured
**When** a visitor opens the page
**Then** the page displays a polished empty state
**And** the site remains navigable.

**Given** the visitor uses assistive technology
**When** the page content is read
**Then** headings, landmarks, links, and images have accessible structure and text alternatives where applicable.

### Story 1.3: Public Announcements Listing

As a public visitor,
I want to view official announcements marked public,
So that I can stay informed without needing portal access.

**Acceptance Criteria:**

**Given** published public announcements exist
**When** a visitor opens the public announcements page
**Then** only announcements with public visibility and published status are displayed
**And** private, resident-only, board-only, admin-only, and property-specific announcements are excluded.

**Given** a public announcement has a publish date, expiration date, pinned state, or attachment
**When** the announcement is displayed
**Then** the listing respects publish/expiration rules, highlights pinned announcements, and exposes only public-safe attachment links.

**Given** no public announcements are available
**When** the page loads
**Then** a clear empty state is displayed
**And** no authorization details or private record counts are exposed.

### Story 1.4: Public Events Listing

As a public visitor,
I want to view public community events,
So that I can see relevant HOA meetings, community events, and public deadlines.

**Acceptance Criteria:**

**Given** public events exist
**When** a visitor opens the public events page
**Then** only events marked public are displayed
**And** resident-only, board-only, and admin-only events are excluded.

**Given** an event includes date, time, location, description, type, and status
**When** the event appears in the list or calendar view
**Then** the visitor can understand when and where the event occurs
**And** cancelled or archived events are handled according to their status.

**Given** the visitor uses a small screen or keyboard navigation
**When** they browse events
**Then** event content remains readable, reachable, and non-overlapping.

### Story 1.5: Public Contact Form with Bot Protection

As a public visitor,
I want to contact the HOA from the public website,
So that I can submit a message without needing a resident portal account.

**Acceptance Criteria:**

**Given** the visitor opens the public contact page
**When** the form loads
**Then** it collects name, email, optional phone, message, and bot-protection token
**And** the form does not ask for or reveal private account information.

**Given** the visitor submits valid contact information with a valid Turnstile token
**When** the server receives the request
**Then** the request is validated and routed to the configured email or inquiry workflow
**And** the visitor receives a privacy-safe success response.

**Given** the visitor submits invalid data, omits required fields, or fails bot protection
**When** the server rejects the request
**Then** the form displays accessible field errors
**And** internal validation or security details are not exposed.

### Story 1.6: Public Dues Payment Entry Point

As a guest payer,
I want a public Pay Dues entry point,
So that I can start a privacy-safe payment flow without seeing private account details.

**Acceptance Criteria:**

**Given** guest payments are enabled for the community
**When** a visitor selects Pay Dues from the public website
**Then** they are routed to the guest payment lookup entry point
**And** the public website does not display balance, owner name, resident contact data, payment history, or private documents.

**Given** guest payments are disabled by community settings
**When** a visitor selects Pay Dues
**Then** the site displays the configured public payment guidance or contact path
**And** no private property data is exposed.

**Given** the visitor uses keyboard navigation or a mobile device
**When** they access the Pay Dues entry point
**Then** the control is reachable, clearly labeled, and does not overflow its layout.

### Story 1.7: Public Vendor Proposal Placeholder

As a vendor applicant,
I want to understand whether vendor proposal intake is available,
So that I know how to contact the HOA until the later vendor workflow exists.

**Acceptance Criteria:**

**Given** the vendor proposal module is not enabled for MVP
**When** a visitor looks for vendor proposal intake
**Then** the public site routes them to approved public contact guidance
**And** no private vendor, board, contract, or invoice data is exposed.

**Given** a future feature flag enables vendor proposal intake
**When** the public navigation or contact page is configured to show it
**Then** the design has an explicit public entry point ready for the later module
**And** the MVP implementation remains functional without that module.

**Given** a visitor submits a general vendor inquiry through the contact form
**When** the message is sent
**Then** it is handled as a public contact request
**And** the visitor is not granted private vendor portal access.

## Epic 2: Resident Accounts, Property Access, and Dashboard

Residents can securely log in, access only their linked properties, see dues status, and navigate core self-service workflows.

Relevant requirements: FR4, FR6, FR7, FR8, FR9, FR10, FR11; NFR1, NFR2, NFR3, NFR8, NFR9, NFR15, NFR17, NFR18, NFR19, NFR20, NFR21, NFR22, NFR24; UX-DR2, UX-DR9, UX-DR10.

### Story 2.1: Resident Authentication Entry and Session Handling

As a resident,
I want to log in securely,
So that I can access private portal features tied to my authorized property records.

**Acceptance Criteria:**

**Given** a resident opens the login page
**When** they enter valid credentials or complete the configured Supabase Auth flow
**Then** the system creates a valid authenticated session
**And** the resident is routed to the resident portal.

**Given** a resident enters invalid credentials or an expired login link
**When** authentication fails
**Then** the login page displays a privacy-safe accessible error message
**And** no account existence or private property information is exposed.

**Given** an unauthenticated visitor attempts to access a resident route
**When** the route guard evaluates the request
**Then** the visitor is redirected to login
**And** the private route content is not rendered.

### Story 2.2: Application Profile Resolution

As an authenticated user,
I want my app profile to be resolved from my auth identity,
So that permissions, notifications, and property access work consistently across the portal.

**Acceptance Criteria:**

**Given** an authenticated Supabase user has a matching application profile
**When** the portal resolves the current profile
**Then** the server returns the profile ID, display name, email, status, and notification preferences needed by private workflows
**And** the profile is resolved server-side before private data access.

**Given** an authenticated Supabase user does not yet have a profile row
**When** profile resolution runs
**Then** the system creates or reports the missing profile according to the configured signup/profile creation strategy
**And** private portal routes do not proceed with an unresolved profile.

**Given** a profile is suspended or disabled
**When** the user attempts to access private portal routes
**Then** access is blocked with a privacy-safe message
**And** no property data is returned.

### Story 2.3: Property Membership Model

As a resident with one or more HOA properties,
I want my account linked to the right property records,
So that I can access only the HOA records that belong to me.

**Acceptance Criteria:**

**Given** a property can have multiple linked users
**When** an active property membership exists for each user
**Then** each linked user can access the shared property-level information allowed by their membership permissions
**And** unrelated residents cannot access that property.

**Given** a user is linked to multiple properties
**When** the resident portal loads property context
**Then** the user can see and select among only their active linked properties
**And** each selection scopes dashboard, payment, document, and message data to that property.

**Given** a membership is invited, suspended, removed, or inactive
**When** authorization checks run
**Then** only active memberships grant portal access to property-specific records
**And** inactive membership states are handled without leaking private property details.

### Story 2.4: Property Invitation Acceptance

As an invited resident,
I want to accept an invitation to a property,
So that I can securely link my account to the correct HOA property.

**Acceptance Criteria:**

**Given** an invited user receives a valid invitation token
**When** they authenticate and accept the invitation before expiration
**Then** the membership status changes to active
**And** the accepted timestamp and invitation metadata are preserved.

**Given** an invitation token is expired, invalid, already accepted, or intended for a different recipient
**When** the user attempts to accept it
**Then** the system rejects the request with a privacy-safe accessible error
**And** no property owner, balance, document, or payment history is exposed.

**Given** a property has invitation permissions configured
**When** a user without invitation authority attempts to invite or accept on behalf of another user
**Then** the action is denied
**And** the denial is handled consistently by the authorization layer.

### Story 2.5: Role and Permission Assignment Foundation

As an admin or board-authorized user,
I want users to have explicit roles and permissions,
So that resident, board, admin, vendor, pool worker, and legal reviewer access remains controlled.

**Acceptance Criteria:**

**Given** the system seeds default role records
**When** roles are available for Spring Meadow Community
**Then** the system includes resident, board member, admin, vendor applicant, approved vendor, pool worker, and legal/compliance reviewer roles
**And** each role can carry explicit permission keys.

**Given** a user holds multiple roles
**When** permission checks evaluate access
**Then** the system considers active role assignments in the correct community and scope
**And** suspended or removed role assignments do not grant access.

**Given** a sensitive role assignment is created, changed, suspended, or removed
**When** the action completes
**Then** the system records enough information for later audit logging
**And** the normal application path does not silently bypass permission checks.

### Story 2.6: Resident Portal Layout and Navigation

As a resident,
I want a clear resident portal layout and navigation,
So that I can move between dashboard, payments, documents, announcements, events, board contact, and property details.

**Acceptance Criteria:**

**Given** an authenticated resident with an active property membership opens the resident portal
**When** the layout renders
**Then** the resident sees navigation for Dashboard, Payments, Documents, Announcements, Events, Contact Board, and My Property
**And** all navigation items are reachable by keyboard.

**Given** a resident uses a small screen
**When** they open the resident navigation
**Then** the navigation adapts without text overflow or overlap
**And** the active page remains clear.

**Given** a resident lacks permission for a property-specific capability
**When** navigation or route guards evaluate the permission
**Then** restricted content is hidden or blocked consistently
**And** no unrelated private data is rendered.

### Story 2.7: Resident Dashboard Summary

As a resident,
I want a dashboard showing my dues status, payment action, announcements, and upcoming events,
So that I can quickly understand what needs my attention.

**Acceptance Criteria:**

**Given** a resident has one active linked property
**When** the dashboard loads
**Then** it shows that property's dues status, current balance if permitted, next due date if available, pay dues action if permitted, recent announcements, and upcoming events
**And** the dashboard does not show unrelated property, board-only, admin-only, or vendor-only data.

**Given** a resident has multiple active linked properties
**When** the dashboard loads
**Then** it presents a property-aware summary or selector
**And** all dues, payment, announcement, event, document, and message links remain scoped to the selected or listed authorized properties.

**Given** dashboard data is loading, empty, or unavailable
**When** the page renders
**Then** it displays appropriate loading, empty, or error states
**And** errors do not reveal internal implementation details or unauthorized record existence.

### Story 2.8: Resident Property Detail View

As a resident,
I want to view authorized details for my linked property,
So that I can confirm the account and membership information the HOA has on file.

**Acceptance Criteria:**

**Given** a resident has active membership for a property
**When** they open My Property
**Then** they see authorized property details such as address, masked account number, membership relationship, and linked member summary according to permissions
**And** sensitive fields not intended for residents are hidden.

**Given** a resident attempts to open a property they are not linked to
**When** the property detail request is made
**Then** the request is denied
**And** the response does not confirm whether the property exists.

**Given** a membership permission such as can_view_balance, can_pay_dues, can_view_documents, or can_invite_members is disabled
**When** the property detail view renders
**Then** related actions or fields are omitted or disabled
**And** the explanation is clear without exposing restricted data.

## Epic 3: Assessments and Online Payments

Residents and guest payers can pay dues safely, while admins can track assessments, payments, fees, allocations, and payment history.

Relevant requirements: FR12, FR13, FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR23, FR67; NFR2, NFR5, NFR6, NFR7, NFR8, NFR9, NFR14, NFR15, NFR16, NFR19, NFR20, NFR21, NFR22, NFR24; UX-DR5, UX-DR9, UX-DR11, UX-DR12.

### Story 3.1: Assessment Cycle and Property Assessment Management

As an admin,
I want to create assessment cycles and property assessments,
So that the HOA can track dues owed by each property.

**Acceptance Criteria:**

**Given** an authorized admin creates an assessment cycle
**When** they provide type, period, due date, default amount, and currency
**Then** the system stores the cycle scoped to the community
**And** the amount is stored in integer cents.

**Given** a property needs an assessment
**When** an authorized admin creates or generates the property assessment
**Then** the assessment is linked to the property and optional cycle
**And** due date, amount, paid amount, balance, status, and description are stored.

**Given** a user without assessment management permission attempts to create or update assessments
**When** the action runs
**Then** it is denied
**And** no assessment or property financial data is returned.

### Story 3.2: Resident Dues Status and Payment History

As a resident,
I want to view dues status and payment history for my linked property,
So that I can understand what I owe and what has been paid.

**Acceptance Criteria:**

**Given** a resident has active membership for a property and can_view_balance is enabled
**When** they open the payments page or dashboard payment summary
**Then** they see authorized dues status, balance, due dates, and payment history for that property
**And** payment records for unrelated properties are excluded.

**Given** can_view_balance is disabled for the resident membership
**When** the resident opens payment-related views
**Then** balance details are hidden
**And** the resident receives a clear permission-aware message.

**Given** payment history is empty
**When** the resident opens the payments page
**Then** a polished empty state is displayed
**And** no private system details or unrelated financial data are exposed.

### Story 3.3: Resident Stripe Payment Session

As an authorized property user,
I want to start an online dues payment,
So that I can pay my HOA dues through Stripe without the site handling raw card or bank details.

**Acceptance Criteria:**

**Given** a resident has active membership and can_pay_dues is enabled
**When** they choose to pay dues with a valid amount and property context
**Then** the server validates authorization, calculates the allowed payment context, creates a pending payment record, and creates a Stripe Checkout or Payment Element session
**And** the response returns only the Stripe checkout URL or client-safe payment session data.

**Given** a resident submits an invalid amount, unauthorized property, or disabled payment method
**When** payment session creation is requested
**Then** the request is rejected with an accessible error
**And** no private details about unauthorized properties or internal Stripe configuration are exposed.

**Given** the payment form supports card and optional ACH preferences
**When** ACH is disabled by community settings
**Then** ACH is not offered
**And** card payment remains available if enabled.

### Story 3.4: Guest Property Lookup for Payment

As a guest payer,
I want to locate a property for payment without seeing private account data,
So that I can safely pay dues on behalf of a property.

**Acceptance Criteria:**

**Given** guest payments are enabled
**When** a guest submits address, postal code, account number, or public payment code with a valid Turnstile token
**Then** the server performs a privacy-safe lookup
**And** returns only whether the payment flow may proceed, not owner name, balance, resident contacts, documents, payment history, lookup tokens, or other continuation secrets.

**Given** the lookup does not match an eligible property
**When** the guest submits the lookup form
**Then** the response remains privacy-safe and does not confirm whether a specific property exists
**And** the guest can correct the lookup or contact the HOA.

**Given** bot protection fails or rate limits apply
**When** the lookup is submitted
**Then** the request is rejected
**And** the error is accessible without revealing security internals.

### Story 3.5: Guest Stripe Payment Session

As a guest payer,
I want to submit payer details and payment amount,
So that I can pay dues and receive only my transaction receipt.

**Acceptance Criteria:**

**Given** a guest lookup has returned generic success without persisting continuation state
**When** the guest submits payer name, email, optional phone, amount, payment preference, and valid Turnstile token
**Then** the server revalidates the eligible payment context, creates any required short-lived token/session persistence owned by Story 3.5, and creates a pending guest payment record and Stripe session
**And** the response contains checkout navigation data and no private property details.

**Given** the guest payment succeeds later through Stripe
**When** the guest returns to the site
**Then** the return page shows only transaction confirmation or receipt status
**And** it does not show account balance, owner name, resident data, private documents, or payment history.

**Given** guest payments are disabled or the amount is invalid
**When** the guest attempts to create a payment session
**Then** the request is rejected with a clear accessible message
**And** no private account information is exposed.

### Story 3.6: Stripe Webhook Processing and Payment Allocation

As the HOA,
I want Stripe webhook events processed reliably,
So that payment status, assessment balances, and receipts reflect confirmed processor events.

**Acceptance Criteria:**

**Given** Stripe sends a supported webhook event
**When** the webhook route receives the raw request
**Then** the server verifies the Stripe signature before processing
**And** unverified payloads are rejected.

**Given** a valid event is received
**When** the event has not been processed before
**Then** the system records the provider event ID idempotently, updates the payment status, applies allocations to assessments, and updates property balance summaries as appropriate
**And** duplicate events do not double-apply payments.

**Given** webhook processing fails
**When** an error occurs after event receipt
**Then** the event is marked failed or logged for retry/monitoring
**And** the failure does not rely on browser redirect success as proof of payment.

### Story 3.7: Payment Receipt Emails

As a payer,
I want to receive a payment receipt after confirmed payment,
So that I have a record of the dues transaction I completed.

**Acceptance Criteria:**

**Given** a resident payment is confirmed by webhook
**When** receipt email sending is triggered
**Then** the resident receives a receipt using the configured Resend sender
**And** the email send attempt is logged.

**Given** a guest payment is confirmed by webhook
**When** receipt email sending is triggered
**Then** the guest receives only transaction receipt information
**And** the email does not include account balance, owner name, resident contacts, private documents, or payment history.

**Given** email delivery fails
**When** the send attempt is logged
**Then** the failure status and error are recorded for admin monitoring
**And** payment confirmation remains based on Stripe status, not email delivery.

### Story 3.8: Admin Payment Records and Manual Payments

As an authorized admin,
I want to view payment records and record offline payments,
So that the HOA can reconcile online and manual dues activity.

**Acceptance Criteria:**

**Given** an admin has payment management permission
**When** they open payment records
**Then** they can view payment status, payer type, property, amount, fee policy, payment method, receipt number, Stripe references when applicable, and timestamps
**And** access is scoped by community permissions.

**Given** manual payments are enabled by configuration
**When** an authorized admin records check, cash, or other offline payment
**Then** the system creates an admin_recorded payment, applies allocations if provided, updates balances, and prepares audit information
**And** no raw card or bank data is stored.

**Given** an unauthorized user attempts to view or record payments
**When** the action is requested
**Then** it is denied
**And** no payment or property financial data is returned.

### Story 3.9: Delinquency Reporting Foundation

As a board/admin user,
I want delinquency reporting for unpaid assessments,
So that the board can review overdue balances before compliance or legal-sensitive workflows begin.

**Acceptance Criteria:**

**Given** assessments have due dates, balances, and statuses
**When** the delinquency report runs
**Then** it identifies properties with due soon, overdue, delinquent, disputed, or lien-review statuses according to configured rules
**And** the report is scoped to authorized board/admin users.

**Given** payment allocations change assessment balances
**When** the report is refreshed
**Then** assessment and property delinquency summaries reflect the updated balances
**And** paid assessments no longer appear as unpaid delinquencies.

**Given** a delinquency may become legal-sensitive later
**When** the report displays the item
**Then** it presents review-oriented status information
**And** it does not automatically file liens, send legal notices, or mark legal review complete.

## Epic 4: Documents, Announcements, Events, and Resident Messaging

Residents and board/admin users can access documents, official content, events, and resident-to-board communication with proper visibility controls.

Relevant requirements: FR24, FR25, FR26, FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR35; NFR2, NFR3, NFR4, NFR7, NFR9, NFR10, NFR11, NFR16, NFR18, NFR19, NFR20, NFR21, NFR22; UX-DR2, UX-DR4, UX-DR5, UX-DR7, UX-DR8, UX-DR9, UX-DR10, UX-DR12.

### Story 4.1: Document Metadata and Visibility Model

As an admin,
I want to classify documents by category, visibility, and related records,
So that residents and board/admin users can find only the documents they are authorized to access.

**Acceptance Criteria:**

**Given** an authorized admin creates document metadata
**When** they provide title, category, visibility, storage metadata, and optional related property, meeting, compliance, assessment, or vendor references
**Then** the system stores the metadata scoped to the community
**And** the document is assigned one of the allowed visibility levels: public, resident, board, vendor, property_specific, or admin.

**Given** a document is property-specific
**When** metadata is created or updated
**Then** a related property is required
**And** only authorized users for that property or permitted board/admin users can later access it.

**Given** a document includes effective or expiration dates
**When** document lists are queried
**Then** those dates are available for display and filtering
**And** expired or archived documents can be handled according to status.

### Story 4.2: Secure Document Upload and Storage Routing

As an authorized board/admin user,
I want to upload public and private HOA documents,
So that official files can be stored safely and made available to the right audience.

**Acceptance Criteria:**

**Given** an authorized user uploads a public document
**When** the file and metadata pass validation
**Then** the file is stored in the public document storage path or bucket
**And** the metadata visibility is public.

**Given** an authorized user uploads a resident, board, vendor, property-specific, or admin document
**When** the file and metadata pass validation
**Then** the file is stored in private storage
**And** direct public access is not available.

**Given** the upload is invalid, too large, unsupported, or unauthorized
**When** upload is attempted
**Then** the system rejects it with accessible errors
**And** no incomplete private file is exposed through public URLs.

### Story 4.3: Authorized Document Listing and Filtering

As a resident or board/admin user,
I want to browse documents filtered by my authorization,
So that I can find relevant HOA records without seeing restricted files.

**Acceptance Criteria:**

**Given** a public visitor opens public documents
**When** the document query runs
**Then** only active public documents are returned
**And** private document counts, categories, and existence are not leaked.

**Given** a resident with active property membership opens documents
**When** the document query runs
**Then** resident-visible documents and property-specific documents for linked properties are returned
**And** board-only, admin-only, vendor-only, and unrelated property-specific documents are excluded.

**Given** a board/admin user with document permissions opens document management or document lists
**When** the query runs
**Then** documents are returned according to role permissions, community scope, filters, and status
**And** unauthorized document metadata is not returned.

### Story 4.4: Signed Private Document Download

As an authorized document viewer,
I want private document downloads to use short-lived signed access,
So that private HOA records are protected while remaining usable.

**Acceptance Criteria:**

**Given** an authorized user requests a private document download
**When** server-side authorization succeeds
**Then** the system creates a short-lived signed URL or equivalent secure file response
**And** a document access log records the allowed access.

**Given** a user without access requests a private document
**When** authorization fails
**Then** no signed URL is created
**And** a denied access log can be recorded without exposing private metadata.

**Given** a public document is requested
**When** the file is accessed
**Then** the public access path is used only if the metadata visibility is public and the document is active
**And** private storage paths are never exposed.

### Story 4.5: Announcement Management and Resident/Public Display

As a board/admin user,
I want to create and publish targeted announcements,
So that residents and public visitors see the official notices meant for them.

**Acceptance Criteria:**

**Given** a board/admin user has announcement management permission
**When** they create or update an announcement
**Then** they can set title, body, visibility, publish date, expiration date, pinned state, status, and attachments
**And** create, update, publish, expire, and archive actions are prepared for audit logging.

**Given** a resident opens resident announcements or dashboard
**When** announcements are queried
**Then** resident-visible and authorized property-specific announcements are displayed
**And** board-only, admin-only, and unrelated property-specific announcements are excluded.

**Given** a public visitor opens public announcements
**When** announcements are queried
**Then** only published, non-expired public announcements are displayed
**And** private announcement data is not exposed.

### Story 4.6: Event Management and Calendar Display

As a board/admin user,
I want to create and manage events with visibility controls,
So that public visitors, residents, and board/admin users see the right calendar items.

**Acceptance Criteria:**

**Given** a board/admin user has event management permission
**When** they create or update an event
**Then** they can set title, description, type, visibility, start/end time, all-day state, location, related meeting/compliance links, and status
**And** cancelled and archived events are handled consistently.

**Given** a resident opens resident events or dashboard
**When** events are queried
**Then** upcoming resident-visible events are displayed in list or calendar form
**And** board-only and admin-only events are excluded.

**Given** a public visitor opens public events
**When** events are queried
**Then** only public events are displayed
**And** private calendar data is not exposed.

### Story 4.7: Resident Message Thread Creation

As a resident,
I want to send categorized messages to the HOA board,
So that I can ask questions or raise issues tied to my property.

**Acceptance Criteria:**

**Given** a resident has active membership for a property
**When** they create a message thread with subject, category, body, and optional attachments
**Then** the system creates a thread linked to the community, property, sender, and category
**And** the first message is stored in the thread.

**Given** the resident selects a category
**When** the message is saved
**Then** the category is one of dues, documents, maintenance, architectural, complaint, or general
**And** invalid categories are rejected with accessible errors.

**Given** a resident attempts to create a thread for an unrelated property
**When** the action runs
**Then** the request is denied
**And** no unrelated property information is exposed.

### Story 4.8: Board/Admin Message Inbox and Replies

As a board/admin user,
I want to review, assign, reply to, and close resident message threads,
So that resident communication can be handled through a preserved workflow.

**Acceptance Criteria:**

**Given** a board/admin user has message management permission
**When** they open the message inbox
**Then** they can filter threads by status, category, property, assigned user, and last message time
**And** access is scoped to their community permissions.

**Given** a board/admin user replies to a thread
**When** the reply is submitted
**Then** the message is added to the thread with sender role board_member or admin
**And** the thread status and last_message_at are updated appropriately.

**Given** a board/admin user assigns, closes, archives, or reopens a thread
**When** the status action is submitted
**Then** the status change is saved
**And** the action is prepared for audit or history tracking.

### Story 4.9: Message Visibility, History, and Notifications

As a resident and board/admin participant,
I want message history and notifications to respect visibility rules,
So that communication is preserved without leaking private records.

**Acceptance Criteria:**

**Given** a resident opens their message history
**When** threads are queried
**Then** they see only threads tied to their active linked properties
**And** board/admin-only internal notes are not shown to the resident.

**Given** a message thread receives a new resident or board/admin reply
**When** notification settings allow email notification
**Then** the system sends or queues a message notification through the configured email service
**And** the email avoids exposing unnecessary sensitive data.

**Given** retention settings apply to messages
**When** messages are listed or archived
**Then** history is preserved according to retention configuration
**And** normal user workflows do not hard-delete preserved communication records.

## Epic 5: Board/Admin Operations Workspace

Admins can manage properties, users, memberships, roles, assessments, documents, announcements, events, messages, payments, settings, and audit visibility.

Relevant requirements: FR5, FR8, FR9, FR16, FR36, FR59, FR60; NFR1, NFR2, NFR3, NFR7, NFR9, NFR12, NFR13, NFR14, NFR18, NFR19, NFR20, NFR21, NFR22, NFR24; UX-DR3, UX-DR4, UX-DR5, UX-DR6, UX-DR9, UX-DR12.

### Story 5.1: Board/Admin Workspace Shell and Navigation

As a board/admin user,
I want a dedicated operations workspace with clear navigation,
So that I can manage HOA records and workflows efficiently.

**Acceptance Criteria:**

**Given** an authenticated user has board/admin workspace permission
**When** they open the admin area
**Then** they see navigation for Dashboard, Properties, Users, Payments, Assessments, Documents, Announcements, Events, Messages, Compliance Calendar, Records Requests, Audit Logs, and Settings
**And** navigation items are rendered according to permissions.

**Given** an authenticated resident without admin permissions attempts to open the admin area
**When** the route guard evaluates the request
**Then** access is denied
**And** no admin-only data is rendered.

**Given** a board/admin user navigates on mobile or by keyboard
**When** they move through the workspace
**Then** navigation remains usable, focus-visible, and free of text overflow.

### Story 5.2: Admin Dashboard Summary

As a board/admin user,
I want an operations dashboard,
So that I can quickly see the state of properties, payments, documents, messages, compliance deadlines, and overdue work.

**Acceptance Criteria:**

**Given** a board/admin user has dashboard permission
**When** the dashboard loads
**Then** it displays permission-scoped summaries for properties, payments, documents, messages, compliance deadlines, and overdue tasks
**And** all data is scoped to the current community.

**Given** a summary area has no available records
**When** the dashboard renders
**Then** it displays a useful empty state
**And** avoids exposing unauthorized counts or internal query details.

**Given** a user lacks permission for a dashboard section
**When** the dashboard renders
**Then** that section is hidden or replaced with a permission-aware state
**And** unauthorized data is not fetched for display.

### Story 5.3: Property Management

As an admin,
I want to create, update, archive, and view properties,
So that the HOA property roster is accurate and reusable for payments, memberships, documents, and compliance.

**Acceptance Criteria:**

**Given** an admin has property management permission
**When** they create a property
**Then** the property stores account number, optional public payment code, status, address, county, mailing address, lot/parcel references, balance summary fields, and community scope
**And** account numbers are unique within the community.

**Given** an admin updates or archives a property
**When** the action succeeds
**Then** the property record is updated or soft-archived
**And** sensitive changes are prepared for audit logging.

**Given** a user without property management permission attempts to create, edit, or archive a property
**When** the action runs
**Then** the request is denied
**And** no private property roster data is returned.

### Story 5.4: User and Membership Management

As an admin,
I want to manage users and property memberships,
So that resident access matches the HOA property records.

**Acceptance Criteria:**

**Given** an admin has user/property membership permission
**When** they view a property or user record
**Then** they can see linked memberships, relationship type, status, invitation metadata, accepted date, and membership capability flags
**And** the view is scoped to the current community.

**Given** an admin invites, activates, suspends, removes, or updates a membership
**When** the action succeeds
**Then** membership status and relevant metadata are updated
**And** sensitive membership changes are prepared for audit logging.

**Given** an admin attempts to create duplicate membership for the same profile and property
**When** the action is submitted
**Then** the system prevents the duplicate
**And** presents an accessible conflict message.

### Story 5.5: Role Assignment and Permission Management

As an admin,
I want to assign and remove user roles,
So that board/admin, legal reviewer, vendor, pool worker, and resident capabilities are explicit and auditable.

**Acceptance Criteria:**

**Given** an admin has role management permission
**When** they assign a role to a profile
**Then** the role assignment includes community, role, profile, scope, status, assigned_by, and assigned_at
**And** the assigned permissions become available to authorization checks.

**Given** an admin suspends or removes a role assignment
**When** the action succeeds
**Then** the role assignment no longer grants access
**And** removed_at or status metadata is preserved.

**Given** a user without role management permission attempts a role change
**When** the action runs
**Then** the request is denied
**And** no hidden permission details are leaked.

### Story 5.6: Community Settings Management

As an admin,
I want to configure community settings,
So that payment options, fee policy, compliance defaults, feature flags, and branding can be managed without code changes.

**Acceptance Criteria:**

**Given** an admin has settings permission
**When** they update payment settings
**Then** fee policy, card enablement, ACH enablement, and guest payment enablement are validated and saved
**And** payment flows read the updated settings.

**Given** an admin updates compliance defaults
**When** they save meeting notice, financial statement, records request, lien-readiness, pre-lien, or enforcement-deadline settings
**Then** values are validated and stored for future compliance calculations
**And** existing records are not silently rewritten unless an explicit recalculation workflow is used.

**Given** an admin updates branding or feature flags
**When** the settings are saved
**Then** the community-scoped configuration is updated
**And** unauthorized users cannot change settings.

### Story 5.7: Admin Data Tables and Operational Filters

As a board/admin user,
I want consistent tables, filters, and empty states,
So that repeated operations across properties, users, payments, documents, messages, and compliance records are easy to scan.

**Acceptance Criteria:**

**Given** an admin opens a list page
**When** records are available
**Then** the table supports appropriate columns, sorting, filtering, and pagination for that record type
**And** actions are shown only when the user has permission.

**Given** a list page has no records or no matching filters
**When** it renders
**Then** it displays an empty state that explains the absence of results
**And** offers only permitted next actions.

**Given** validation or server action errors occur from a list action
**When** the error is displayed
**Then** it uses a consistent accessible error pattern
**And** internal stack traces or authorization implementation details are not exposed.

### Story 5.8: Audit Log Viewer

As an authorized board/admin or legal reviewer,
I want to view audit logs for sensitive actions,
So that financial, administrative, and legal-sensitive changes remain reviewable.

**Acceptance Criteria:**

**Given** an authorized user opens the audit log page
**When** audit records exist
**Then** they can view actor, actor type, action, target table, target ID, timestamp, request metadata, reason, and before/after summaries when permitted
**And** the results are scoped by community.

**Given** an unauthorized user attempts to view audit logs
**When** the route or query runs
**Then** access is denied
**And** no audit records are returned.

**Given** an audit log exists
**When** a normal board/admin workflow attempts to delete or erase it
**Then** the workflow does not provide that action
**And** audit history remains append-only by application convention.

### Story 5.9: Admin Monitoring for Webhooks, Emails, and Jobs

As an admin,
I want visibility into failed webhooks, failed email delivery, and scheduled job failures,
So that operational problems can be detected and corrected.

**Acceptance Criteria:**

**Given** payment webhook events are received
**When** an admin with monitoring permission views webhook status
**Then** they can see received, processed, failed, and ignored event summaries
**And** raw sensitive payloads are not exposed unnecessarily.

**Given** email send attempts are logged
**When** an admin views email status
**Then** they can see queued, sent, delivered, bounced, failed, or suppressed statuses with related records when permitted
**And** recipient details are scoped to authorized workflows.

**Given** compliance or reminder jobs run
**When** failures occur
**Then** the system exposes enough job status or error information for admin review
**And** no secrets or private service credentials are displayed.

## Epic 6: Compliance Calendar, Meetings, Records, and Financial Deadlines

Board/admin users can track North Carolina HOA compliance deadlines, warning emails, meetings, records requests, annual financial statement workflows, and completion evidence.

Relevant requirements: FR37, FR38, FR39, FR40, FR41, FR42, FR43, FR44, FR45, FR46, FR47, FR48, FR49, FR50, FR51, FR52; NFR3, NFR7, NFR11, NFR14, NFR18, NFR19, NFR20, NFR21, NFR22, NFR23, NFR24; UX-DR3, UX-DR4, UX-DR5, UX-DR7, UX-DR9, UX-DR12.

### Story 6.1: Compliance Calendar Event and Task Foundation

As a board/admin user,
I want compliance events and tasks tracked in a calendar,
So that legally important HOA deadlines are visible and assignable.

**Acceptance Criteria:**

**Given** a board/admin user has compliance permission
**When** they create a compliance event
**Then** the system stores type, title, description, due date, start date, related records, priority, legal-sensitive flag, assigned users, and status
**And** the event is scoped to the community.

**Given** a compliance event has tasks
**When** tasks are created or updated
**Then** each task stores title, description, type, status, due date, assignee, evidence, and completion metadata
**And** tasks remain linked to their compliance event.

**Given** a user lacks compliance permission
**When** they attempt to list, create, update, or complete compliance events
**Then** the request is denied
**And** no compliance deadline details are returned.

### Story 6.2: Compliance Calendar Views and Status Tracking

As a board/admin user,
I want month and list views of compliance events,
So that I can scan upcoming, overdue, blocked, completed, and legal-review items.

**Acceptance Criteria:**

**Given** compliance events exist
**When** a board/admin user opens the compliance calendar
**Then** they can view events by month or list with status, due date, priority, type, assignees, and legal-sensitive indicators
**And** filters for date range, status, type, and assignment are available.

**Given** an event is upcoming, in progress, ready for review, completed, blocked, deferred, overdue, or legal review required
**When** the event is displayed
**Then** the status is visually and textually distinguishable
**And** the status label remains accessible to assistive technology.

**Given** a compliance task is completed
**When** the user provides evidence notes or linked documents
**Then** completion metadata is saved
**And** legal-sensitive completion requires the configured reviewer permission when applicable.

### Story 6.3: Compliance Reminder Job and Warning Emails

As a board/admin user,
I want automated compliance warning emails,
So that deadlines are not missed because someone forgot to check the calendar.

**Acceptance Criteria:**

**Given** reminder rules and due compliance items exist
**When** the secured reminder job runs
**Then** it identifies reminders due to send and queues or sends emails through the configured email service
**And** duplicate reminders are prevented.

**Given** an email reminder is sent or fails
**When** the send attempt completes
**Then** the system records recipient, type, related record, provider status, sent timestamp, and error if applicable
**And** failures are available for admin monitoring.

**Given** an unauthorized request calls the reminder job endpoint
**When** cron secret or platform authentication fails
**Then** the job does not run
**And** no deadline or recipient details are exposed.

### Story 6.4: Annual Association Meeting Workflow

As a board/admin user,
I want to schedule annual association meetings and manage notice windows,
So that the HOA can track required yearly meeting obligations.

**Acceptance Criteria:**

**Given** an authorized board/admin user creates an annual association meeting
**When** they provide date/time, location, agenda, and notice requirement details
**Then** the meeting is stored with status, agenda, notice metadata, and community scope
**And** a related compliance event can track the annual meeting obligation.

**Given** North Carolina default meeting notice settings are active
**When** the meeting date is set
**Then** the system calculates earliest notice date as meeting date minus 60 days and latest notice date as meeting date minus 10 days
**And** those dates are available in the meeting workflow.

**Given** notice is attempted outside the configured notice window
**When** the user marks notice sent
**Then** the system warns or blocks according to configuration
**And** any override requires an explicit reason if allowed.

### Story 6.5: Meeting Records, Minutes, and Board Meeting Tracking

As a board/admin user,
I want to track meeting notices, agenda flags, minutes, and board meeting details,
So that HOA meeting records are preserved with the correct visibility.

**Acceptance Criteria:**

**Given** a meeting notice is sent
**When** the board/admin records the notice
**Then** the system tracks notice method, notice content/document, recipients, sent timestamp, and sender
**And** meeting status updates appropriately.

**Given** an agenda includes declaration/bylaw amendments, budget changes, or director/officer removal
**When** the agenda is saved
**Then** those special agenda flags are captured
**And** they remain visible to authorized board/admin users.

**Given** draft notes or approved minutes are uploaded
**When** they are linked to the meeting
**Then** board-only notes remain separate from resident-visible records
**And** approved minutes can be linked through the document library with the correct visibility.

### Story 6.6: Records Request Workflow

As a board/admin user,
I want to track owner and authorized-agent records requests,
So that request deadlines, responses, documents, and status are preserved.

**Acceptance Criteria:**

**Given** a records request is received
**When** an authorized user creates the request record
**Then** the system stores requester, property if applicable, requested records, received date, due date, assigned user, request type, status, and contact information
**And** the record is scoped to the community.

**Given** the request type is unpaid assessment statement
**When** due date is calculated using North Carolina defaults
**Then** the due date is 10 business days after receipt
**And** the calculation uses community settings.

**Given** the board/admin responds to or fulfills the request
**When** response notes or documents are saved
**Then** response timestamp, responder, linked documents, and fulfillment status are preserved
**And** overdue reminders stop once the request is resolved.

### Story 6.7: Records Request Reminder and Overdue Escalation

As a board/admin user,
I want records request reminders and overdue escalation,
So that time-sensitive records duties are not missed.

**Acceptance Criteria:**

**Given** a records request is approaching its due date
**When** the reminder job runs
**Then** warning emails are sent to configured recipients
**And** email logs link back to the records request.

**Given** a records request is overdue and unresolved
**When** daily overdue reminder rules run
**Then** overdue reminders continue until the request is fulfilled, denied, or otherwise resolved
**And** the records request status can reflect overdue state.

**Given** a records request has been resolved
**When** the reminder job runs
**Then** no further overdue reminders are sent for that request
**And** previous reminder history remains logged.

### Story 6.8: Annual Financial Statement Workflow

As a board/admin user,
I want to track annual financial statement preparation and resident availability,
So that required financial documents are made available on time.

**Acceptance Criteria:**

**Given** the community fiscal year close date is configured
**When** an annual financial statement cycle is created
**Then** the system calculates the due date using community settings with North Carolina default of fiscal year close plus 75 days
**And** fiscal year label, start, end, due date, and status are stored.

**Given** income/expense and balance sheet documents are uploaded
**When** they are linked to the annual financial statement cycle
**Then** the system tracks document IDs, board review status, supporting documents, reviewed-by users, and resident availability timestamp
**And** documents intended for residents must have resident-appropriate visibility.

**Given** required documents are not resident-accessible
**When** a user attempts to mark the cycle available or complete
**Then** the system blocks completion or requires an explicit configured override
**And** the reason is preserved.

### Story 6.9: Audit, Review, and Compilation Workflow

As a board/admin user,
I want to track optional audit, review, or compilation workflows,
So that financial review work and final reports are preserved.

**Acceptance Criteria:**

**Given** the board votes to require an audit, review, or compilation
**When** an authorized user creates the workflow
**Then** the system tracks who voted, provider, scope, requested documents, target due date, status, and related compliance event
**And** the workflow is available to authorized board/admin users.

**Given** a final report is received
**When** it is uploaded or linked
**Then** the report can be connected to the document library with appropriate visibility
**And** completion evidence is preserved.

**Given** the annual audit cycle is active
**When** reminders are generated
**Then** the system can remind the board to review fidelity/crime insurance coverage
**And** the reminder is logged as a compliance-related email or task.

## Epic 7: Delinquency and Legal-Sensitive Workflow Guardrails

Board/admin/legal reviewers can track delinquency and lien-readiness workflows with required review gates and no automated legal action.

Relevant requirements: FR53, FR54, FR55, FR56, FR57, FR58, FR59, FR60, FR61; NFR2, NFR3, NFR7, NFR9, NFR11, NFR18, NFR19, NFR20, NFR21, NFR22, NFR23, NFR24; UX-DR3, UX-DR4, UX-DR5, UX-DR9, UX-DR12.

### Story 7.1: Delinquency Case Foundation

As a board/admin user,
I want unpaid assessments to create reviewable delinquency cases,
So that overdue balances can be tracked before any legal-sensitive workflow begins.

**Acceptance Criteria:**

**Given** an assessment remains unpaid beyond configured delinquency criteria
**When** delinquency review generation runs
**Then** the system creates or updates a delinquency-related compliance event or case for board/admin review
**And** the case links to the property, assessment, balance context, and relevant due dates.

**Given** a payment later resolves the delinquent assessment
**When** delinquency status is recalculated
**Then** the case or event reflects the updated paid or resolved state
**And** duplicate active delinquency cases are not created for the same assessment context.

**Given** a resident or unauthorized user attempts to view delinquency case details
**When** authorization checks run
**Then** access is denied unless explicitly permitted
**And** unrelated property financial data is not exposed.

### Story 7.2: Lien-Readiness Timing Rules

As a board/admin user,
I want lien-readiness timing rules enforced,
So that legal-sensitive review cannot advance before configured waiting periods are met.

**Acceptance Criteria:**

**Given** North Carolina default settings are active
**When** an assessment has been unpaid for fewer than 30 days
**Then** the system does not mark the item ready for lien-readiness review
**And** it may show the earliest eligible review date to authorized users.

**Given** an assessment has been unpaid for at least the configured lien_readiness_days_past_due
**When** delinquency review generation runs
**Then** the system may create a lien-readiness review task
**And** the task is marked legal-sensitive.

**Given** a user attempts to override timing rules
**When** the action is submitted
**Then** the system requires configured override permission and reason
**And** the override is prepared for audit logging.

### Story 7.3: Address Verification Before Pre-Lien Notice

As a board/admin or legal/compliance reviewer,
I want address verification captured before pre-lien notice,
So that the workflow preserves the evidence needed for review.

**Acceptance Criteria:**

**Given** a lien-readiness case exists
**When** address verification is started
**Then** the workflow captures physical lot address, owner address of record, county tax record address if different, and registered agent address if the owner is a corporation or LLC
**And** verification evidence or notes can be attached.

**Given** address verification is incomplete
**When** a user attempts to advance to pre-lien notice sent
**Then** the system blocks advancement
**And** identifies the missing verification fields.

**Given** address verification is completed
**When** the workflow is reviewed
**Then** verification timestamp, actor, evidence, and address snapshots are available to authorized reviewers
**And** sensitive details remain restricted from normal resident views.

### Story 7.4: Pre-Lien Statement Mailing Tracking

As a board/admin or legal/compliance reviewer,
I want to record pre-lien statement mailing details,
So that the waiting period before legal review is tracked accurately.

**Acceptance Criteria:**

**Given** address verification is complete
**When** an authorized user records pre-lien statement mailing
**Then** the workflow stores mailing date, method, evidence, notes, and actor
**And** the case status updates to reflect the mailing.

**Given** North Carolina default settings are active
**When** the pre-lien statement mailing date is recorded
**Then** the system calculates the earliest ready-for-legal-review date as mailing date plus 15 days
**And** that date is shown to authorized users.

**Given** the mailing date is missing or invalid
**When** the user attempts to save mailing details
**Then** the system rejects the update with accessible validation errors
**And** the workflow does not advance.

### Story 7.5: Legal Review Gate for Lien-Related Workflow

As a legal/compliance reviewer,
I want lien-related workflows to require explicit review before sensitive status changes,
So that the system supports oversight without performing legal action.

**Acceptance Criteria:**

**Given** a pre-lien mailing was recorded fewer than the configured wait days ago
**When** a user attempts to mark the case ready for legal review
**Then** the system blocks the status change
**And** shows the earliest eligible date to authorized users.

**Given** all timing and verification prerequisites are satisfied
**When** an authorized legal/compliance reviewer marks the case ready for legal review
**Then** the system records reviewer, timestamp, evidence, and status
**And** the action is prepared for audit logging.

**Given** a workflow reaches legal-review status
**When** the system displays next actions
**Then** it provides tracking and checklist support only
**And** it does not automatically file liens, generate legal filings, foreclose, or perform external legal action.

### Story 7.6: External Lien Filing and Enforcement Reminder Tracking

As a board/admin or legal/compliance reviewer,
I want to record externally filed lien details and enforcement reminders,
So that externally handled legal milestones can be tracked without automation.

**Acceptance Criteria:**

**Given** a lien is filed outside the system
**When** an authorized user records the external filing date and references
**Then** the workflow stores filing date, notes, evidence, and related documents
**And** the system does not submit or file anything externally.

**Given** a lien filing date is recorded
**When** enforcement reminder generation runs
**Then** the system creates a reminder using the configured lien enforcement deadline years, with North Carolina default of three years
**And** the reminder is legal-sensitive.

**Given** an unauthorized user attempts to record lien filing details
**When** the action runs
**Then** it is denied
**And** no legal-sensitive workflow data is returned.

### Story 7.7: Fine and Suspension Workflow Guardrail Placeholder

As a board/admin or legal/compliance reviewer,
I want future fine and suspension workflows to have required guardrails defined,
So that later implementation does not skip notice, hearing, decision, appeal, or review requirements.

**Acceptance Criteria:**

**Given** fine and suspension execution is later-phase scope
**When** the MVP exposes legal-sensitive workflow configuration or planning records
**Then** it preserves the required fields: notice of charge, hearing date, evidence, decision, decision notice, appeal deadline, appeal status, and legal/compliance review status
**And** no fine or suspension action is automated in MVP.

**Given** North Carolina default settings are used in a later fine/suspension workflow
**When** a decision is recorded
**Then** the system design supports a 15-day appeal deadline after decision
**And** the deadline remains configurable.

**Given** required notice, opportunity to be heard, decision notice, or legal/compliance review is missing
**When** a later fine/suspension workflow attempts completion
**Then** the system must block completion
**And** the missing prerequisite is clearly identified.

### Story 7.8: Sensitive Workflow Audit Trail

As a board/admin or legal/compliance reviewer,
I want sensitive workflow changes audited,
So that financial, delinquency, lien, fine, suspension, and compliance decisions remain reviewable.

**Acceptance Criteria:**

**Given** a sensitive workflow action occurs
**When** the action changes status, evidence, review state, mailing details, filing details, or completion state
**Then** an audit log entry records actor, action, target, timestamp, before/after context where appropriate, request metadata, and reason if provided
**And** audit records are scoped to the community.

**Given** a normal board/admin user views workflow records
**When** audit history exists
**Then** audit history is available only to users with audit or legal-review permissions
**And** audit records cannot be erased through normal workflows.

**Given** a legal-sensitive action is attempted by a user without reviewer permission
**When** authorization checks run
**Then** the action is denied
**And** the denial does not reveal restricted legal-sensitive details.

### Story 7.9: Future Financial Approval and Reconciliation Hooks

As a board/admin user,
I want later approval, reconciliation, and export workflows reserved in the product design,
So that sensitive financial controls can be added without reworking the core model.

**Acceptance Criteria:**

**Given** sensitive future workflows are not part of MVP
**When** the data model and admin settings are implemented
**Then** they preserve extension points for two-person approvals, monthly reconciliation, and annual audit/review export packages
**And** those features remain disabled unless explicitly enabled later.

**Given** a future workflow involves refunds, reserve transfers, vendor payment detail changes, bill approvals, or manual payment adjustments
**When** approval rules are configured later
**Then** the system design can require two-person approval and audit logging
**And** MVP workflows do not bypass that future control path.

**Given** an admin reviews current MVP settings
**When** later-phase financial controls are not enabled
**Then** the UI does not imply that unavailable controls are active
**And** the product remains clear about what is and is not implemented.

## Epic 8: Later-Phase Expansion Modules

The product preserves future expansion paths for community posts, maintenance, architectural requests, vendor workflows, pool maintenance, approvals, reconciliation, exports, and SaaS commercialization without pulling those capabilities into the MVP.

Relevant requirements: FR3, FR58, FR61, FR62, FR63, FR64, FR65, FR66, FR67; NFR11, NFR15, NFR21, NFR22, NFR23, NFR24; UX-DR3, UX-DR4, UX-DR5, UX-DR6, UX-DR9, UX-DR12.

### Story 8.1: Feature Flag Foundation for Later Modules

As an admin,
I want later modules controlled by community feature flags,
So that future functionality can be introduced without confusing MVP users.

**Acceptance Criteria:**

**Given** later modules are not enabled for MVP
**When** the application renders public, resident, or admin navigation
**Then** community posts, maintenance, architectural requests, vendor portal, pool maintenance, advanced approvals, reconciliation, and export features are hidden or clearly unavailable
**And** the active MVP workflows remain unaffected.

**Given** a future module flag is enabled in community settings
**When** navigation and route guards evaluate the feature
**Then** the feature can appear only for authorized users
**And** the route remains protected by role and permission checks.

**Given** a disabled later-module route is requested directly
**When** the request is evaluated
**Then** access is denied or redirected to a safe placeholder
**And** no future-module private data is exposed.

### Story 8.2: Community Posts Moderation Placeholder

As a resident,
I want future community posts to be moderated separately from official announcements,
So that resident-submitted content never appears as official board communication.

**Acceptance Criteria:**

**Given** community posts are later-phase scope
**When** MVP content structures are implemented
**Then** official board/admin announcements remain distinct from any future resident-submitted posts
**And** no resident post publishing workflow is enabled by default.

**Given** a future resident submits a community post
**When** the later module is implemented
**Then** the design requires moderation before publication
**And** board/admin users can approve, reject, or request revisions.

**Given** public or resident content is displayed
**When** official announcements and future community posts coexist
**Then** the UI can distinguish official notices from moderated community posts
**And** permissions prevent residents from bypassing moderation.

### Story 8.3: Maintenance Request Expansion Placeholder

As a resident,
I want future maintenance requests to be tracked through the portal,
So that common-area or property-related issues can be submitted with enough context.

**Acceptance Criteria:**

**Given** maintenance requests are later-phase scope
**When** MVP admin and resident navigation is implemented
**Then** maintenance request links are hidden unless the feature flag is enabled
**And** existing resident-to-board messaging remains available for general contact.

**Given** the future maintenance module is enabled
**When** a resident submits a request
**Then** the design supports category, property/common-area indicator, description, photos, status, assignment, and resolution notes
**And** uploads use private storage and authorization rules.

**Given** board/admin users manage maintenance requests later
**When** they assign or resolve a request
**Then** the workflow can preserve status history and resolution notes
**And** sensitive records remain community-scoped.

### Story 8.4: Architectural Request Expansion Placeholder

As a resident,
I want future architectural requests to be submitted and reviewed through the portal,
So that improvement requests can be tracked from submission through decision.

**Acceptance Criteria:**

**Given** architectural requests are later-phase scope
**When** MVP property and document models are implemented
**Then** they preserve extension points for property-linked architectural requests and attachments
**And** no architectural approval workflow is enabled by default.

**Given** the future architectural module is enabled
**When** a resident submits a request
**Then** the design supports request type, property link, description, attachments/plans, review status, board/committee notes, decision date, and approval/denial letter
**And** documents are protected by the appropriate visibility rules.

**Given** board/admin users review an architectural request later
**When** they record a decision
**Then** the decision can link to documents and preserve review history
**And** residents see only the portions intended for them.

### Story 8.5: Vendor Proposal and Approved Vendor Expansion Placeholder

As a vendor applicant or board/admin user,
I want future vendor proposal and approved vendor workflows to fit into the portal,
So that vendor intake and official vendor records can grow from the MVP contact path.

**Acceptance Criteria:**

**Given** vendor proposal intake is later-phase scope
**When** the public contact and feature flag systems are implemented
**Then** they preserve a safe future entry point for vendor proposal intake
**And** public vendor applicants do not receive private vendor access automatically.

**Given** the future vendor proposal module is enabled
**When** a vendor submits a proposal
**Then** the design supports vendor name, contact information, work category, description, proposed amount or range, attachments, and insurance/license information where relevant
**And** submissions are reviewable by authorized board/admin users.

**Given** a vendor is approved later
**When** board/admin users create official vendor records
**Then** the design supports approved vendor status, controlled vendor portal access, and permission-scoped records
**And** vendor data is community-scoped.

### Story 8.6: Vendor Invoice and Approval Expansion Placeholder

As an approved vendor or board/admin user,
I want future vendor invoices and bill approvals to be controlled,
So that invoice records and approvals are preserved without weakening financial safeguards.

**Acceptance Criteria:**

**Given** vendor invoices are later-phase scope
**When** MVP payment, document, and audit foundations are implemented
**Then** they preserve extension points for invoice documents, bill approval state, comments, and paid status
**And** no vendor payment approval workflow is enabled by default.

**Given** the future vendor invoice module is enabled
**When** an approved vendor submits an invoice
**Then** the design supports invoice number, amount, due date, work category, attachments, related project/request, and status
**And** invoice data is visible only to authorized users.

**Given** board/admin users approve, reject, mark paid, or comment on vendor invoices later
**When** those actions occur
**Then** permissions and audit logging apply
**And** sensitive vendor payment detail changes can require later two-person approval.

### Story 8.7: Pool Maintenance Expansion Placeholder

As a board/admin user,
I want future pool maintenance logs to be structured and reviewable,
So that pool operations can be tracked without hardcoding local health assumptions.

**Acceptance Criteria:**

**Given** pool maintenance is later-phase scope
**When** MVP role and settings foundations are implemented
**Then** they preserve role support for pool workers without requiring a separate account type
**And** pool workflows are hidden unless enabled.

**Given** the future pool module is enabled
**When** a pool worker submits a log
**Then** the design supports worker name, date, timestamp, daily checklist, chemical readings, proof photos, optional condition photos, and notes
**And** uploads use private storage and permission checks.

**Given** chemical thresholds are configured later
**When** readings are outside configured ranges or daily logs are missing
**Then** the system can alert authorized board/admin users
**And** thresholds remain configurable rather than hardcoded.

### Story 8.8: Multi-HOA and SaaS Readiness Guardrails

As the product owner,
I want the Spring Meadow implementation to remain reusable for future HOAs,
So that the first deployment can become a sustainable product without costly rework.

**Acceptance Criteria:**

**Given** MVP records are created
**When** they belong to HOA business domains
**Then** core records include community scope
**And** Spring Meadow-specific values live in seed/configuration data rather than hardcoded application logic.

**Given** hosting and product configuration are selected
**When** MVP is prepared for launch
**Then** the infrastructure remains appropriate for roughly 200 homes and the target low monthly hosting cost
**And** future annual SaaS pricing can be represented outside core code.

**Given** future communities may be added later
**When** the data model and authorization helpers are extended
**Then** community-scoped queries and settings provide a clear path to multi-HOA support
**And** the first release remains simple for one HOA.

## Final Validation Summary

Validation completed on 2026-05-03.

- Functional requirement coverage: all FR1 through FR67 are mapped to at least one epic and covered by story acceptance criteria.
- UX design requirement coverage: all UX-DR1 through UX-DR12 are covered across public, resident, admin, document, calendar, form, payment, and later-module stories.
- Epic count: 8.
- Story count: 68.
- Starter template check: the architecture specifies Next.js with TypeScript and App Router, but does not name a required starter template. No mandatory starter-template story is required.
- Database/entity creation check: entity creation is distributed into the stories that need those records rather than gathered into a single up-front database epic.
- Story dependency check: stories are ordered so each can build on earlier stories and does not require future stories in the same epic.
- Epic structure check: epics are organized around user-visible or operator-visible outcomes rather than technical layers.
- File churn check: shared infrastructure overlap is expected for auth, authorization, audit, and settings, but each epic owns a distinct user or operator workflow and the split is justified by domain context and review boundaries.
- Status: ready for sprint planning.
