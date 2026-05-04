---
title: "Spring Meadow Community Implementation Tasks v1"
status: "draft"
phase: "phase-4-tasks"
version: "1.0"
created: "2026-04-30"
updated: "2026-04-30"
source_requirements: "/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md"
source_architecture: "/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md"
source_data_model: "/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md"
source_api: "/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/api.md"
recommended_stack:
  app: "Next.js + TypeScript"
  database: "Supabase Postgres"
  auth: "Supabase Auth"
  storage: "Supabase Storage"
  payments: "Stripe"
  email: "Resend"
  edge_security: "Cloudflare DNS/CDN/Turnstile"
---

# Spring Meadow Community Implementation Tasks v1

## 1. Backend Foundation

### 1.1 Project Scaffold

TASK-BE-001: Create the Next.js application scaffold.

- Action: Initialize Next.js with TypeScript and App Router.
- Dependencies: None.
- Output: Working app shell with `app/`, `components/`, `lib/`, and `server/` folders.

TASK-BE-002: Configure linting, formatting, and TypeScript strictness.

- Action: Add ESLint, Prettier or formatter equivalent, strict TypeScript settings, and import path aliases.
- Dependencies: TASK-BE-001.
- Output: Consistent code quality baseline.

TASK-BE-003: Create environment variable schema.

- Action: Define required env vars for Supabase, Stripe, Resend, Cloudflare Turnstile, app URL, and cron secret.
- Dependencies: TASK-BE-001.
- Output: Validated environment config module.

TASK-BE-004: Add base folder structure for server domains.

- Action: Create folders for `auth`, `authorization`, `properties`, `payments`, `documents`, `compliance`, `email`, `audit`, and `storage`.
- Dependencies: TASK-BE-001.
- Output: Server-side domain structure matching architecture.

TASK-BE-005: Add shared runtime validation utilities.

- Action: Add Zod or equivalent and create common schemas for UUID, money cents, pagination, dates, and form errors.
- Dependencies: TASK-BE-002.
- Output: Shared validation library.

### 1.2 Supabase Client Foundation

TASK-BE-006: Install and configure Supabase client packages.

- Action: Add Supabase JS/server helpers for Next.js.
- Dependencies: TASK-BE-001, TASK-BE-003.
- Output: Browser client, server client, and service role client wrappers.

TASK-BE-007: Create server-side Supabase client helpers.

- Action: Implement user-scoped server client and service-role client for trusted server code only.
- Dependencies: TASK-BE-006.
- Output: `server/services/supabase` helpers.

TASK-BE-008: Protect service role usage.

- Action: Centralize service role access and document rules that it must never be imported into client components.
- Dependencies: TASK-BE-007.
- Output: Guarded service role module with clear usage constraints.

### 1.3 Logging and Audit Foundation

TASK-BE-009: Define application error type and API error response shape.

- Action: Create typed errors for validation, authentication, authorization, not found, conflict, and internal failures.
- Dependencies: TASK-BE-005.
- Output: Shared error-handling utilities.

TASK-BE-010: Create audit service interface.

- Action: Implement `writeAuditLog()` service API before table implementation is complete; initially no-op or dev logger.
- Dependencies: TASK-BE-004, TASK-BE-009.
- Output: Stable audit API for later use.

TASK-BE-011: Create request metadata helper.

- Action: Capture request ID, IP address, and user agent for audit and security logging.
- Dependencies: TASK-BE-009.
- Output: Request metadata utility.

### 1.4 Third-Party Service Foundation

TASK-BE-012: Configure Stripe SDK.

- Action: Add Stripe server SDK wrapper using secret key from env.
- Dependencies: TASK-BE-003.
- Output: Stripe service client.

TASK-BE-013: Configure Resend SDK.

- Action: Add email sending wrapper using Resend API key from env.
- Dependencies: TASK-BE-003.
- Output: Email service client.

TASK-BE-014: Configure Cloudflare Turnstile verification service.

- Action: Add server function for Turnstile token verification.
- Dependencies: TASK-BE-003.
- Output: `verifyTurnstile()` service.

TASK-BE-015: Add cron/job endpoint security helper.

- Action: Validate cron secret header for scheduled reminder routes.
- Dependencies: TASK-BE-003, TASK-BE-009.
- Output: Reusable cron auth guard.

## 2. Authentication System

### 2.1 Supabase Auth Setup

TASK-AUTH-001: Configure Supabase Auth project settings.

- Action: Set site URL, redirect URLs, email templates, and provider options.
- Dependencies: TASK-BE-006.
- Output: Supabase Auth ready for local and production environments.

TASK-AUTH-002: Implement login page.

- Action: Build email/password or magic link login page using Supabase Auth.
- Dependencies: TASK-AUTH-001, TASK-FE-001.
- Output: `/login` page.

TASK-AUTH-003: Implement logout action.

- Action: Add server/client logout flow and redirect behavior.
- Dependencies: TASK-AUTH-002.
- Output: Working logout.

TASK-AUTH-004: Implement password reset flow if password auth is enabled.

- Action: Add reset request and update password screens.
- Dependencies: TASK-AUTH-001, TASK-AUTH-002.
- Output: Password reset flow.

### 2.2 Profile and Session Resolution

TASK-AUTH-005: Create `profiles` table migration.

- Action: Add profile table linked to `auth.users`.
- Dependencies: TASK-DB-001.
- Output: `profiles` migration.

TASK-AUTH-006: Create profile on signup/auth user creation.

- Action: Add trigger or server flow that creates profile row for new auth users.
- Dependencies: TASK-AUTH-005.
- Output: Reliable profile creation.

TASK-AUTH-007: Implement `getCurrentProfile()`.

- Action: Resolve current Supabase auth user to application profile.
- Dependencies: TASK-AUTH-005, TASK-BE-007.
- Output: Server helper used by private routes.

TASK-AUTH-008: Add protected route middleware or layout guards.

- Action: Protect resident and admin route groups.
- Dependencies: TASK-AUTH-007.
- Output: Unauthenticated users redirected to login.

### 2.3 Roles and Permissions

TASK-AUTH-009: Create roles and profile roles migrations.

- Action: Add `roles` and `profile_roles` tables.
- Dependencies: TASK-DB-001, TASK-AUTH-005.
- Output: Role tables.

TASK-AUTH-010: Seed default roles.

- Action: Seed resident, board member, admin, vendor applicant, approved vendor, pool worker, legal reviewer roles.
- Dependencies: TASK-AUTH-009, TASK-DB-006.
- Output: Default role records.

TASK-AUTH-011: Implement permission helper.

- Action: Add `hasPermission(profileId, communityId, permissionKey)` service.
- Dependencies: TASK-AUTH-009.
- Output: Permission checks.

TASK-AUTH-012: Implement role assignment admin action.

- Action: Add server action to assign/remove roles with audit logging.
- Dependencies: TASK-AUTH-011, TASK-BE-010.
- Output: Role management action.

### 2.4 Property Membership Auth

TASK-AUTH-013: Implement property membership authorization helper.

- Action: Add `canAccessProperty(profileId, propertyId)` and related helpers.
- Dependencies: TASK-DB-009, TASK-AUTH-007.
- Output: Property authorization checks.

TASK-AUTH-014: Implement invitation token strategy.

- Action: Decide and implement invitation token storage/validation for linking users to properties.
- Dependencies: TASK-AUTH-005, TASK-DB-009.
- Output: Secure invitation acceptance design.

TASK-AUTH-015: Implement property invitation acceptance.

- Action: Allow invited user to accept property membership.
- Dependencies: TASK-AUTH-014.
- Output: Invitation acceptance server action.

## 3. Database Integration

### 3.1 Supabase Project and Migrations

TASK-DB-001: Initialize Supabase migrations.

- Action: Set up Supabase CLI/config and migrations folder.
- Dependencies: TASK-BE-006.
- Output: Migration workflow.

TASK-DB-002: Add Postgres extensions.

- Action: Add `pgcrypto` and `citext` migration.
- Dependencies: TASK-DB-001.
- Output: Extension migration.

TASK-DB-003: Add enum type migration.

- Action: Create enums for statuses, document visibility, payment status, payer type, event visibility, and compliance status.
- Dependencies: TASK-DB-002.
- Output: Enum migration.

TASK-DB-004: Create communities and settings tables.

- Action: Add `communities` and `community_settings`.
- Dependencies: TASK-DB-003.
- Output: Community configuration schema.

TASK-DB-005: Seed Spring Meadow Community.

- Action: Add seed data for initial community and default settings.
- Dependencies: TASK-DB-004.
- Output: Initial community seed.

TASK-DB-006: Add migration seed framework.

- Action: Add repeatable seed script for local/dev setup.
- Dependencies: TASK-DB-005.
- Output: Reproducible dev data.

### 3.2 Core HOA Tables

TASK-DB-007: Create properties table.

- Action: Add property records with account number, public payment code, address, balance summary, and delinquency status.
- Dependencies: TASK-DB-004.
- Output: Properties schema and indexes.

TASK-DB-008: Create property membership table.

- Action: Add membership table linking profiles to properties.
- Dependencies: TASK-AUTH-005, TASK-DB-007.
- Output: Property memberships schema and indexes.

TASK-DB-009: Add property and membership RLS policies.

- Action: Add RLS policies for residents and admins.
- Dependencies: TASK-DB-007, TASK-DB-008, TASK-AUTH-011.
- Output: Basic data isolation.

TASK-DB-010: Create assessment cycle and assessment tables.

- Action: Add dues/assessment schema.
- Dependencies: TASK-DB-007.
- Output: Assessment schema and indexes.

TASK-DB-011: Create payment tables.

- Action: Add `payments`, `payment_allocations`, and `payment_events`.
- Dependencies: TASK-DB-010.
- Output: Payment schema and indexes.

TASK-DB-012: Create document tables.

- Action: Add `documents` and `document_access_logs`.
- Dependencies: TASK-AUTH-005, TASK-DB-007.
- Output: Document metadata and access log schema.

TASK-DB-013: Create announcements and events tables.

- Action: Add public/resident/board event and announcement schema.
- Dependencies: TASK-DB-004.
- Output: Content schema.

TASK-DB-014: Create messaging tables.

- Action: Add `message_threads` and `messages`.
- Dependencies: TASK-AUTH-005, TASK-DB-007.
- Output: Resident-to-board messaging schema.

### 3.3 Compliance Tables

TASK-DB-015: Create compliance calendar tables.

- Action: Add `compliance_calendar_events` and `compliance_tasks`.
- Dependencies: TASK-DB-004, TASK-AUTH-005.
- Output: Compliance schema and indexes.

TASK-DB-016: Create records request table.

- Action: Add records request schema and due-date fields.
- Dependencies: TASK-DB-007, TASK-AUTH-005.
- Output: Records request schema.

TASK-DB-017: Create meetings table.

- Action: Add meeting, notice, and minutes metadata fields.
- Dependencies: TASK-DB-012.
- Output: Meeting schema.

TASK-DB-018: Create annual financial statements table.

- Action: Add fiscal-year statement tracking table.
- Dependencies: TASK-DB-012.
- Output: Annual financial statement schema.

### 3.4 Audit, Email, RLS, and Types

TASK-DB-019: Create audit logs table.

- Action: Add append-only audit log schema.
- Dependencies: TASK-AUTH-005.
- Output: Audit schema.

TASK-DB-020: Create email logs table.

- Action: Add Resend email tracking schema.
- Dependencies: TASK-AUTH-005, TASK-DB-007, TASK-DB-011, TASK-DB-015.
- Output: Email log schema.

TASK-DB-021: Add RLS policies for all MVP tables.

- Action: Implement RLS on profiles, payments, documents, announcements, events, messages, compliance, records, and meetings.
- Dependencies: TASK-DB-019.
- Output: Defense-in-depth data access controls.

TASK-DB-022: Generate Supabase TypeScript types.

- Action: Generate and commit database types.
- Dependencies: TASK-DB-021.
- Output: Typed database client.

TASK-DB-023: Implement updated `writeAuditLog()`.

- Action: Replace no-op audit service with database-backed audit insert.
- Dependencies: TASK-DB-019, TASK-BE-010.
- Output: Working audit logging.

## 4. Frontend Setup

### 4.1 UI Foundation

TASK-FE-001: Install and configure Tailwind CSS.

- Action: Add Tailwind config, globals, and design tokens.
- Dependencies: TASK-BE-001.
- Output: Styling foundation.

TASK-FE-002: Add component system.

- Action: Add reusable components for buttons, inputs, forms, dialogs, menus, tables, badges, alerts, tabs, and cards.
- Dependencies: TASK-FE-001.
- Output: Shared UI component library.

TASK-FE-003: Create base app layouts.

- Action: Build public, auth, resident, and admin layout shells.
- Dependencies: TASK-FE-002.
- Output: Route group layouts.

TASK-FE-004: Add navigation components.

- Action: Build public nav, resident nav, and admin nav.
- Dependencies: TASK-FE-003.
- Output: Navigation shells.

TASK-FE-005: Add loading, empty, and error states.

- Action: Create standard loading spinners/skeletons, empty states, and form error patterns.
- Dependencies: TASK-FE-002.
- Output: UX state components.

### 4.2 Form and Data UX

TASK-FE-006: Add form utilities.

- Action: Create reusable form field, validation error, submit button, and server action response patterns.
- Dependencies: TASK-FE-002, TASK-BE-005.
- Output: Consistent forms.

TASK-FE-007: Add data table component.

- Action: Create sortable/filterable table pattern for admin pages.
- Dependencies: TASK-FE-002.
- Output: Admin table foundation.

TASK-FE-008: Add calendar UI component.

- Action: Build month/list calendar views for events and compliance items.
- Dependencies: TASK-FE-002.
- Output: Calendar UI.

TASK-FE-009: Add document list/upload UI components.

- Action: Build file picker, upload progress, document list, visibility badge, and download actions.
- Dependencies: TASK-FE-002.
- Output: Document UI foundation.

## 5. Feature Pages

### 5.1 Public Website

TASK-PAGE-001: Build public homepage.

- Action: Create public landing page for Spring Meadow Community.
- Dependencies: TASK-FE-003.
- Output: Public homepage.

TASK-PAGE-002: Build public community information page.

- Action: Add community overview and HOA information content area.
- Dependencies: TASK-PAGE-001.
- Output: Public info page.

TASK-PAGE-003: Build public announcements page.

- Action: Show published public announcements.
- Dependencies: TASK-DB-013, TASK-FE-004.
- Output: Public announcements.

TASK-PAGE-004: Build public events page.

- Action: Show public events.
- Dependencies: TASK-DB-013, TASK-FE-008.
- Output: Public events.

TASK-PAGE-005: Build public contact page/form.

- Action: Add contact form protected by Turnstile.
- Dependencies: TASK-BE-014, TASK-FE-006.
- Output: Public contact form.

### 5.2 Resident Portal

TASK-PAGE-006: Build resident dashboard page.

- Action: Show dues status, pay dues button, HOA announcements, and upcoming events.
- Dependencies: TASK-AUTH-008, TASK-DB-010, TASK-DB-013.
- Output: Resident dashboard.

TASK-PAGE-007: Build resident payments page.

- Action: Show payment history and launch resident payment flow.
- Dependencies: TASK-DB-011, TASK-PAY-001.
- Output: Resident payments page.

TASK-PAGE-008: Build resident documents page.

- Action: Show authorized resident and property-specific documents.
- Dependencies: TASK-DB-012, TASK-DOC-003.
- Output: Resident documents page.

TASK-PAGE-009: Build resident announcements page.

- Action: Show resident-visible announcements.
- Dependencies: TASK-DB-013.
- Output: Resident announcements page.

TASK-PAGE-010: Build resident events page.

- Action: Show resident-visible event calendar.
- Dependencies: TASK-DB-013, TASK-FE-008.
- Output: Resident events page.

TASK-PAGE-011: Build contact board page.

- Action: Allow residents to create and reply to board message threads.
- Dependencies: TASK-DB-014, TASK-MSG-001.
- Output: Resident-to-board communication page.

TASK-PAGE-012: Build my property page.

- Action: Show authorized property details and linked members.
- Dependencies: TASK-DB-007, TASK-DB-008.
- Output: Property profile page.

### 5.3 Guest Payment

TASK-PAGE-013: Build guest payment lookup page.

- Action: Allow lookup by address and/or account number without exposing private data.
- Dependencies: TASK-GPAY-001, TASK-FE-006.
- Output: Guest lookup form.

TASK-PAGE-014: Build guest payment amount page.

- Action: Collect payer details and payment amount.
- Dependencies: TASK-PAGE-013.
- Output: Guest payer form.

TASK-PAGE-015: Build guest payment receipt/return page.

- Action: Show transaction confirmation without account balance.
- Dependencies: TASK-PAGE-014, TASK-PAY-004.
- Output: Guest receipt page.

### 5.4 Admin Portal

TASK-PAGE-016: Build admin dashboard.

- Action: Show summary of properties, payments, documents, messages, compliance deadlines, and overdue tasks.
- Dependencies: TASK-AUTH-012, TASK-DB-015, TASK-DB-019.
- Output: Admin dashboard.

TASK-PAGE-017: Build property management page.

- Action: List, create, and edit properties.
- Dependencies: TASK-DB-007, TASK-ADMIN-001.
- Output: Property admin page.

TASK-PAGE-018: Build user and membership management page.

- Action: Manage users, invitations, property memberships, and roles.
- Dependencies: TASK-AUTH-012, TASK-AUTH-015.
- Output: User admin page.

TASK-PAGE-019: Build assessment management page.

- Action: Create assessment cycles and property assessments.
- Dependencies: TASK-DB-010, TASK-ASMT-001.
- Output: Assessment admin page.

TASK-PAGE-020: Build payment records page.

- Action: View payment records, status, Stripe IDs, allocations, and manual records if enabled.
- Dependencies: TASK-DB-011, TASK-PAY-005.
- Output: Payment admin page.

TASK-PAGE-021: Build document management page.

- Action: Upload, categorize, set visibility, and archive documents.
- Dependencies: TASK-DOC-001, TASK-DOC-002.
- Output: Document admin page.

TASK-PAGE-022: Build announcement management page.

- Action: Create, edit, publish, pin, expire, and archive announcements.
- Dependencies: TASK-DB-013, TASK-CONTENT-001.
- Output: Announcement admin page.

TASK-PAGE-023: Build event management page.

- Action: Create, edit, cancel, and archive events.
- Dependencies: TASK-DB-013, TASK-CONTENT-002.
- Output: Event admin page.

TASK-PAGE-024: Build message inbox page.

- Action: Board/admin can view, assign, reply, and close resident message threads.
- Dependencies: TASK-DB-014, TASK-MSG-002.
- Output: Board message inbox.

TASK-PAGE-025: Build compliance calendar page.

- Action: Month/list view of compliance events, tasks, statuses, assignments, and deadlines.
- Dependencies: TASK-DB-015, TASK-COMP-001, TASK-FE-008.
- Output: Compliance calendar page.

TASK-PAGE-026: Build records request page.

- Action: Track records requests, due dates, assignment, response docs, and fulfillment.
- Dependencies: TASK-DB-016, TASK-COMP-006.
- Output: Records request admin page.

TASK-PAGE-027: Build meeting management page.

- Action: Create meetings, calculate notice windows, record notice sent, upload notes/minutes.
- Dependencies: TASK-DB-017, TASK-COMP-008.
- Output: Meeting admin page.

TASK-PAGE-028: Build annual financial statement page.

- Action: Track fiscal year close, 75-day deadline, upload statement/balance sheet, mark resident availability.
- Dependencies: TASK-DB-018, TASK-COMP-010.
- Output: Annual financial statement page.

TASK-PAGE-029: Build audit log page.

- Action: Let authorized board/admin/legal reviewer view audit events.
- Dependencies: TASK-DB-019, TASK-DB-023.
- Output: Audit log viewer.

## 6. Integration

### 6.1 Payment Integration

TASK-PAY-001: Implement resident payment session creation.

- Action: Create server action for resident Stripe Checkout session.
- Dependencies: TASK-BE-012, TASK-DB-011, TASK-AUTH-013.
- Output: Resident can start payment.

TASK-PAY-002: Implement guest property lookup service.

- Action: Lookup property by address/account number/payment code and return non-private confirmation only.
- Dependencies: TASK-DB-007, TASK-BE-014.
- Output: Privacy-safe lookup.

TASK-GPAY-001: Implement guest payment session route.

- Action: Create guest payment API route with Turnstile validation and Stripe Checkout session creation.
- Dependencies: TASK-PAY-002, TASK-BE-012.
- Output: Guest can start payment.

TASK-PAY-003: Implement Stripe webhook route.

- Action: Verify signature, store payment event, update payment status, allocate payment, update property summary.
- Dependencies: TASK-BE-012, TASK-DB-011, TASK-DB-023.
- Output: Reliable payment processing.

TASK-PAY-004: Implement payment receipt email.

- Action: Send resident or guest receipt through Resend after confirmed webhook success.
- Dependencies: TASK-BE-013, TASK-PAY-003, TASK-DB-020.
- Output: Payment receipt emails.

TASK-PAY-005: Implement manual payment recording action.

- Action: Allow authorized admin to record check/cash/manual payment with audit log.
- Dependencies: TASK-DB-011, TASK-AUTH-011, TASK-DB-023.
- Output: Offline payment support if enabled.

### 6.2 Document and Storage Integration

TASK-DOC-001: Create Supabase Storage buckets.

- Action: Create public/private/temp buckets and configure storage policies.
- Dependencies: TASK-BE-006.
- Output: Storage buckets.

TASK-DOC-002: Implement document upload flow.

- Action: Upload file to private or public bucket, then insert metadata row.
- Dependencies: TASK-DOC-001, TASK-DB-012, TASK-FE-009.
- Output: Document upload.

TASK-DOC-003: Implement signed document URL route.

- Action: Authorize document access and return short-lived signed URL.
- Dependencies: TASK-DOC-001, TASK-DB-012, TASK-AUTH-013.
- Output: Secure document downloads.

TASK-DOC-004: Implement document visibility audit logs.

- Action: Audit uploads, deletes, and visibility changes.
- Dependencies: TASK-DB-012, TASK-DB-023.
- Output: Document audit trail.

### 6.3 Content Integration

TASK-CONTENT-001: Implement announcement server actions.

- Action: Create, update, publish, expire, archive, and list announcements.
- Dependencies: TASK-DB-013, TASK-DB-023.
- Output: Announcement backend.

TASK-CONTENT-002: Implement event server actions.

- Action: Create, update, cancel, archive, and list events.
- Dependencies: TASK-DB-013, TASK-DB-023.
- Output: Event backend.

### 6.4 Messaging Integration

TASK-MSG-001: Implement resident create message thread action.

- Action: Create message thread and first message.
- Dependencies: TASK-DB-014, TASK-AUTH-013.
- Output: Resident message creation.

TASK-MSG-002: Implement board/admin reply and status actions.

- Action: Reply, assign, close, and archive message threads.
- Dependencies: TASK-MSG-001, TASK-AUTH-011.
- Output: Message management.

TASK-MSG-003: Implement message notification emails.

- Action: Send board/resident notifications through Resend.
- Dependencies: TASK-BE-013, TASK-MSG-001, TASK-MSG-002, TASK-DB-020.
- Output: Message emails.

### 6.5 Compliance Integration

TASK-COMP-001: Implement compliance event service.

- Action: Create/list/update compliance events and tasks.
- Dependencies: TASK-DB-015, TASK-AUTH-011.
- Output: Compliance backend.

TASK-COMP-002: Implement annual meeting deadline generation.

- Action: Generate annual meeting reminders and notice window tasks.
- Dependencies: TASK-COMP-001, TASK-DB-017.
- Output: Meeting compliance events.

TASK-COMP-003: Implement annual financial statement deadline generation.

- Action: Calculate fiscal year close + configured due days, default 75 days.
- Dependencies: TASK-COMP-001, TASK-DB-018.
- Output: Financial statement compliance events.

TASK-COMP-004: Implement records request deadline calculation.

- Action: Calculate due dates, including unpaid assessment statement default 10 business days.
- Dependencies: TASK-DB-016, TASK-COMP-001.
- Output: Records request deadlines.

TASK-COMP-005: Implement delinquency and lien-readiness reminders.

- Action: Generate 30-day delinquency review and 15-day pre-lien waiting period reminders.
- Dependencies: TASK-DB-010, TASK-COMP-001.
- Output: Delinquency/lien reminder foundations.

TASK-COMP-006: Implement records request actions.

- Action: Create, assign, respond, and fulfill records requests.
- Dependencies: TASK-DB-016, TASK-COMP-004.
- Output: Records request workflow.

TASK-COMP-007: Implement compliance reminder cron route.

- Action: Scheduled job sends warning emails and records email logs.
- Dependencies: TASK-BE-015, TASK-BE-013, TASK-DB-020, TASK-COMP-001.
- Output: Automated reminder emails.

TASK-COMP-008: Implement meeting actions.

- Action: Create/update meetings, calculate notice window, mark notice sent, upload/approve minutes.
- Dependencies: TASK-DB-017, TASK-DOC-002, TASK-COMP-002.
- Output: Meeting workflow.

TASK-COMP-009: Implement notice window validation.

- Action: Warn/block notice sent outside configured 60-to-10-day NC default window unless override is allowed.
- Dependencies: TASK-COMP-008.
- Output: Meeting notice guardrail.

TASK-COMP-010: Implement annual financial statement actions.

- Action: Create annual financial cycle, upload docs, mark available to residents.
- Dependencies: TASK-DB-018, TASK-DOC-002, TASK-COMP-003.
- Output: Annual financial workflow.

### 6.6 Admin Integration

TASK-ADMIN-001: Implement property CRUD actions.

- Action: Create, update, archive properties with audit logging.
- Dependencies: TASK-DB-007, TASK-DB-023, TASK-AUTH-011.
- Output: Property admin backend.

TASK-ADMIN-002: Implement membership management actions.

- Action: Invite, activate, suspend, remove memberships.
- Dependencies: TASK-DB-008, TASK-AUTH-014, TASK-DB-023.
- Output: Membership admin backend.

TASK-ADMIN-003: Implement assessment management actions.

- Action: Create cycles, create property assessments, update assessment status.
- Dependencies: TASK-DB-010, TASK-DB-023.
- Output: Assessment admin backend.

TASK-ADMIN-004: Implement community settings actions.

- Action: Update payment, compliance, feature flag, and branding settings.
- Dependencies: TASK-DB-004, TASK-DB-023.
- Output: Settings backend.

### 6.7 Quality, Testing, and Release

TASK-QA-001: Add unit tests for authorization helpers.

- Action: Test role checks, property access, guest privacy, and document visibility.
- Dependencies: TASK-AUTH-011, TASK-AUTH-013, TASK-DOC-003.
- Output: Authorization test coverage.

TASK-QA-002: Add payment flow tests.

- Action: Test resident session creation, guest privacy, webhook idempotency, and receipt email trigger.
- Dependencies: TASK-PAY-001, TASK-GPAY-001, TASK-PAY-003, TASK-PAY-004.
- Output: Payment test coverage.

TASK-QA-003: Add compliance deadline tests.

- Action: Test annual meeting notice windows, 75-day annual financial deadline, 10-business-day records request, and lien-readiness reminder timing.
- Dependencies: TASK-COMP-002, TASK-COMP-003, TASK-COMP-004, TASK-COMP-005.
- Output: Compliance timing test coverage.

TASK-QA-004: Add document access tests.

- Action: Test public, resident, board, admin, and property-specific document access.
- Dependencies: TASK-DOC-003.
- Output: Document access test coverage.

TASK-QA-005: Add basic E2E resident workflow.

- Action: Test login, resident dashboard, view documents, view announcements/events, contact board.
- Dependencies: TASK-PAGE-006, TASK-PAGE-008, TASK-PAGE-009, TASK-PAGE-010, TASK-PAGE-011.
- Output: Resident E2E test.

TASK-QA-006: Add basic E2E admin workflow.

- Action: Test admin login, create property, invite user, upload document, publish announcement, create compliance event.
- Dependencies: TASK-PAGE-016, TASK-PAGE-017, TASK-PAGE-018, TASK-PAGE-021, TASK-PAGE-022, TASK-PAGE-025.
- Output: Admin E2E test.

TASK-REL-001: Configure deployment environment.

- Action: Configure Vercel or selected host with env vars, Supabase, Stripe, Resend, and Cloudflare.
- Dependencies: TASK-BE-003, TASK-DB-021.
- Output: Production deployment environment.

TASK-REL-002: Configure Stripe webhook endpoint.

- Action: Add production webhook URL and secret.
- Dependencies: TASK-PAY-003, TASK-REL-001.
- Output: Stripe production webhook.

TASK-REL-003: Configure Resend domain and sender identity.

- Action: Verify domain and sender records.
- Dependencies: TASK-BE-013, TASK-REL-001.
- Output: Production email sending.

TASK-REL-004: Configure Cloudflare DNS and Turnstile.

- Action: Point DNS, configure Turnstile site keys, and document production settings.
- Dependencies: TASK-BE-014, TASK-REL-001.
- Output: Cloudflare production setup.

TASK-REL-005: Run pre-launch checklist.

- Action: Verify RLS, payment test/live mode, email delivery, guest privacy, backups, audit logs, and compliance reminders.
- Dependencies: TASK-QA-001, TASK-QA-002, TASK-QA-003, TASK-QA-004, TASK-REL-002, TASK-REL-003, TASK-REL-004.
- Output: Launch readiness signoff.

## Dependency Milestone Summary

### Milestone A: Backend Foundation Ready

Includes:

- TASK-BE-001 through TASK-BE-015.

Unlocks:

- Auth implementation.
- Database migrations.
- Third-party integrations.
- Frontend setup.

### Milestone B: Auth and Database Ready

Includes:

- TASK-AUTH-001 through TASK-AUTH-015.
- TASK-DB-001 through TASK-DB-023.

Unlocks:

- Resident portal.
- Admin portal.
- Secure documents.
- Payments.
- Compliance workflows.

### Milestone C: Frontend Shell Ready

Includes:

- TASK-FE-001 through TASK-FE-009.

Unlocks:

- Public pages.
- Resident pages.
- Admin pages.

### Milestone D: MVP Feature Pages Ready

Includes:

- TASK-PAGE-001 through TASK-PAGE-029.

Unlocks:

- Integration test pass.
- User review.

### Milestone E: Integrations Ready

Includes:

- Payment integration.
- Document integration.
- Content integration.
- Messaging integration.
- Compliance integration.
- Admin integration.

Unlocks:

- QA and release.

### Milestone F: Launch Ready

Includes:

- TASK-QA-001 through TASK-QA-006.
- TASK-REL-001 through TASK-REL-005.

Output:

- MVP ready for controlled production launch.
