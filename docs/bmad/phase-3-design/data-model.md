---
title: "Spring Meadow Community Data Model"
status: "draft"
phase: "phase-3-design"
version: "1.0"
created: "2026-04-30"
updated: "2026-04-30"
primary_database: "Supabase Postgres"
recommended_stack:
  app: "Next.js + TypeScript"
  auth: "Supabase Auth"
  database: "Supabase Postgres"
  storage: "Supabase Storage MVP; Cloudflare R2 optional later"
  payments: "Stripe"
  email: "Resend"
  edge_security: "Cloudflare DNS/CDN/Turnstile"
source_requirements: "/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md"
source_architecture: "/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md"
supersedes: "/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model-v1.md"
legal_note: "Product planning artifact only; not legal advice."
---

# Spring Meadow Community Data Model

## 1. Purpose

This is the canonical data model for Spring Meadow Community using the approved recommended stack, especially **Supabase Postgres**. It replaces the earlier MongoDB-only `data-model-v1.md` as the primary design direction.

The model supports:

- Public HOA website content.
- Supabase Auth-backed users.
- Property-centered resident accounts.
- Multiple users per property.
- Roles and permissions.
- Dues assessments and payments.
- Stripe payment records and webhooks.
- Guest payments without balance disclosure.
- Documents with privacy levels.
- Announcements and events.
- Resident-to-board communication.
- North Carolina compliance calendar and warning emails.
- Audit logs and financial safeguards.
- Later vendor, pool, architectural, maintenance, fine, suspension, and lien workflows.
- Future multi-HOA support through `community_id`.

## 2. Postgres Conventions

### 2.1 IDs and Extensions

Use UUID primary keys.

Recommended extensions:

```sql
create extension if not exists "pgcrypto";
create extension if not exists "citext";
```

ID convention:

```sql
id uuid primary key default gen_random_uuid()
```

### 2.2 Tenant Scope

Every HOA-scoped table must include:

```sql
community_id uuid not null references communities(id)
```

Even the first deployment should be community-scoped to preserve future multi-HOA SaaS viability.

### 2.3 Timestamps

Most tables include:

```sql
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
created_by uuid null references profiles(id),
updated_by uuid null references profiles(id),
deleted_at timestamptz null,
deleted_by uuid null references profiles(id)
```

Use soft deletion for records that may need retention.

### 2.4 Money

Store money in integer cents:

```sql
amount_cents integer not null
currency text not null default 'USD'
```

Do not store money in floating point columns.

### 2.5 Auth Model

Supabase Auth owns credentials in `auth.users`. Application profile and authorization records live in public schema tables.

Important:

- Do not store password hashes in application tables when using Supabase Auth.
- Supabase Auth handles password hashing, sessions, email verification, recovery tokens, and auth identities.
- Application tables should reference `auth.users(id)` through `profiles.auth_user_id`.

## 3. Enum Types

Create enums or constrained text domains. Enums improve consistency; constrained text is easier to change. For v1, use Postgres enums for stable concepts and text check constraints for fast-changing workflow statuses.

Recommended enums:

```sql
create type community_status as enum ('active', 'inactive', 'archived');
create type property_status as enum ('active', 'inactive', 'archived');
create type membership_status as enum ('invited', 'active', 'suspended', 'removed');
create type relationship_type as enum ('owner', 'co_owner', 'resident', 'renter', 'manager', 'family', 'other');
create type document_visibility as enum ('public', 'resident', 'board', 'vendor', 'property_specific', 'admin');
create type payment_status as enum ('created', 'pending', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'void');
create type payment_method as enum ('card', 'ach', 'check', 'cash', 'manual', 'other');
create type payer_type as enum ('resident', 'guest', 'admin_recorded');
create type event_visibility as enum ('public', 'resident', 'board', 'admin');
create type compliance_status as enum ('upcoming', 'in_progress', 'ready_for_review', 'completed', 'blocked', 'deferred', 'overdue', 'legal_review_required');
```

## 4. Core Tables

## 4.1 `communities`

```sql
create table communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug citext not null unique,
  legal_name text,
  status community_status not null default 'active',
  timezone text not null default 'America/New_York',
  jurisdiction_country text not null default 'US',
  jurisdiction_state text not null default 'NC',
  jurisdiction_type text not null default 'unknown'
    check (jurisdiction_type in ('planned_community', 'condominium', 'unknown')),
  statute_chapter text check (statute_chapter in ('47F', '47C')),
  fiscal_year_start_month integer not null default 1 check (fiscal_year_start_month between 1 and 12),
  fiscal_year_start_day integer not null default 1 check (fiscal_year_start_day between 1 and 31),
  fiscal_year_end_month integer not null default 12 check (fiscal_year_end_month between 1 and 12),
  fiscal_year_end_day integer not null default 31 check (fiscal_year_end_day between 1 and 31),
  public_display_name text not null,
  logo_url text,
  primary_color text,
  secondary_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Indexes:

```sql
create index communities_status_idx on communities(status);
```

## 4.2 `community_settings`

Stores configurable payment, compliance, and feature settings.

```sql
create table community_settings (
  community_id uuid primary key references communities(id) on delete cascade,
  stripe_account_mode text not null default 'platform'
    check (stripe_account_mode in ('platform', 'direct')),
  stripe_connected_account_id text,
  fee_policy text not null default 'payer_pays'
    check (fee_policy in ('payer_pays', 'hoa_pays', 'configurable')),
  allow_card boolean not null default true,
  allow_ach boolean not null default true,
  guest_payments_enabled boolean not null default true,
  meeting_notice_earliest_days integer not null default 60,
  meeting_notice_latest_days integer not null default 10,
  annual_financial_statement_due_days integer not null default 75,
  unpaid_assessment_statement_due_business_days integer not null default 10,
  lien_readiness_days_past_due integer not null default 30,
  pre_lien_notice_wait_days integer not null default 15,
  lien_enforcement_deadline_years integer not null default 3,
  feature_flags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 4.3 `profiles`

Application profile for Supabase Auth users.

```sql
create table profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email citext not null unique,
  email_verified_at timestamptz,
  phone text,
  first_name text,
  last_name text,
  display_name text not null,
  status text not null default 'active'
    check (status in ('invited', 'active', 'suspended', 'disabled')),
  notification_preferences jsonb not null default '{}'::jsonb,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

Indexes:

```sql
create index profiles_status_idx on profiles(status);
create index profiles_last_login_idx on profiles(last_login_at desc);
```

Security:

- Password hashing is handled by Supabase Auth.
- Application code must never store plaintext passwords or password hashes in `profiles`.
- Admin MFA should be enabled through Supabase Auth policy/configuration where feasible.

## 4.4 `properties`

```sql
create table properties (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  account_number text not null,
  public_payment_code text unique,
  status property_status not null default 'active',
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null default 'NC',
  postal_code text not null,
  county text,
  mailing_address jsonb,
  owner_display_name text,
  lot_number text,
  parcel_number text,
  plat_reference text,
  current_balance_cents integer not null default 0,
  last_payment_at timestamptz,
  next_due_date date,
  delinquency_status text not null default 'current'
    check (delinquency_status in ('current', 'due_soon', 'overdue', 'delinquent', 'lien_review', 'disputed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (community_id, account_number)
);
```

Indexes:

```sql
create index properties_community_status_idx on properties(community_id, status);
create index properties_address_lookup_idx on properties(community_id, lower(address_line1), postal_code);
create index properties_delinquency_idx on properties(community_id, delinquency_status);
create index properties_next_due_idx on properties(community_id, next_due_date);
```

Security:

- Guest payment lookup may match address, account number, or public payment code.
- Guest response must not include `owner_display_name`, balance, private documents, or payment history.

## 4.5 `property_memberships`

```sql
create table property_memberships (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  relationship relationship_type not null default 'resident',
  status membership_status not null default 'invited',
  can_view_balance boolean not null default true,
  can_pay_dues boolean not null default true,
  can_view_documents boolean not null default true,
  can_invite_members boolean not null default false,
  invited_by uuid references profiles(id),
  invited_at timestamptz,
  accepted_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, property_id, profile_id)
);
```

Indexes:

```sql
create index property_memberships_user_idx on property_memberships(community_id, profile_id, status);
create index property_memberships_property_idx on property_memberships(community_id, property_id, status);
```

## 4.6 `roles` and `profile_roles`

```sql
create table roles (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  permissions text[] not null default '{}',
  system_role boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, key)
);

create table profile_roles (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  scope text not null default 'community'
    check (scope in ('community', 'property', 'vendor', 'amenity')),
  scope_id uuid,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'removed')),
  assigned_by uuid references profiles(id),
  assigned_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (community_id, profile_id, role_id, scope, scope_id)
);
```

Indexes:

```sql
create index profile_roles_profile_idx on profile_roles(community_id, profile_id, status);
create index profile_roles_role_idx on profile_roles(community_id, role_id, status);
```

## 5. Financial Tables

## 5.1 `assessment_cycles`

```sql
create table assessment_cycles (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  name text not null,
  type text not null check (type in ('annual', 'quarterly', 'monthly', 'special')),
  status text not null default 'draft' check (status in ('draft', 'active', 'closed', 'archived')),
  period_start date not null,
  period_end date not null,
  due_date date not null,
  default_amount_cents integer not null,
  currency text not null default 'USD',
  late_fee jsonb,
  interest jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Indexes:

```sql
create index assessment_cycles_status_due_idx on assessment_cycles(community_id, status, due_date);
create index assessment_cycles_type_period_idx on assessment_cycles(community_id, type, period_start desc);
```

## 5.2 `assessments`

```sql
create table assessments (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  assessment_cycle_id uuid references assessment_cycles(id),
  type text not null check (type in ('regular_dues', 'special_assessment', 'late_fee', 'interest', 'fine', 'damage_assessment', 'manual_adjustment')),
  description text not null,
  amount_cents integer not null,
  paid_cents integer not null default 0,
  balance_cents integer not null,
  currency text not null default 'USD',
  due_date date not null,
  status text not null default 'open'
    check (status in ('draft', 'open', 'partially_paid', 'paid', 'overdue', 'waived', 'disputed', 'void')),
  source_workflow_table text,
  source_workflow_id uuid,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Indexes:

```sql
create index assessments_property_due_idx on assessments(community_id, property_id, due_date desc);
create index assessments_status_due_idx on assessments(community_id, status, due_date);
create index assessments_cycle_idx on assessments(community_id, assessment_cycle_id);
```

## 5.3 `payments`

```sql
create table payments (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  property_id uuid not null references properties(id),
  payer_type payer_type not null,
  profile_id uuid references profiles(id),
  guest_name text,
  guest_email citext,
  guest_phone text,
  property_account_snapshot text not null,
  property_address_snapshot text not null,
  amount_cents integer not null,
  currency text not null default 'USD',
  fee_policy text not null check (fee_policy in ('payer_pays', 'hoa_pays')),
  processor_fee_cents integer,
  net_amount_cents integer,
  method payment_method not null,
  status payment_status not null default 'created',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  stripe_customer_id text,
  stripe_receipt_url text,
  receipt_number text unique,
  paid_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table payment_allocations (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  payment_id uuid not null references payments(id) on delete cascade,
  assessment_id uuid not null references assessments(id),
  amount_cents integer not null,
  created_at timestamptz not null default now(),
  unique (payment_id, assessment_id)
);

create table payment_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references communities(id),
  payment_id uuid references payments(id),
  provider text not null default 'stripe',
  provider_event_id text not null,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'failed', 'ignored')),
  error text,
  payload_hash text,
  unique (provider, provider_event_id)
);
```

Indexes:

```sql
create index payments_property_created_idx on payments(community_id, property_id, created_at desc);
create index payments_profile_created_idx on payments(community_id, profile_id, created_at desc);
create index payments_status_created_idx on payments(community_id, status, created_at desc);
create index payment_allocations_assessment_idx on payment_allocations(community_id, assessment_id);
create index payment_events_status_idx on payment_events(processing_status, received_at desc);
```

Security:

- Do not store full card, CVV, bank account, or raw payment method details.
- Stripe webhook processing must be idempotent using `provider_event_id`.
- Guest payment records may store guest email for receipt purposes, but guest flows must not expose account details.

## 6. Content and Communication Tables

## 6.1 `documents`

```sql
create table documents (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  title text not null,
  description text,
  category text not null,
  visibility document_visibility not null,
  related_property_id uuid references properties(id),
  related_vendor_id uuid,
  related_meeting_id uuid,
  related_compliance_task_id uuid,
  related_assessment_id uuid references assessments(id),
  storage_provider text not null default 'supabase_storage'
    check (storage_provider in ('supabase_storage', 'cloudflare_r2', 's3')),
  storage_bucket text not null,
  storage_path text not null,
  content_type text not null,
  size_bytes bigint not null,
  checksum text,
  effective_date date,
  expiration_date date,
  status text not null default 'active' check (status in ('active', 'archived', 'deleted')),
  uploaded_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references profiles(id)
);
```

Indexes:

```sql
create index documents_visibility_category_idx on documents(community_id, visibility, category, created_at desc);
create index documents_property_idx on documents(community_id, related_property_id, created_at desc);
create index documents_meeting_idx on documents(community_id, related_meeting_id);
create index documents_expiration_idx on documents(community_id, expiration_date) where expiration_date is not null;
```

Supabase Storage buckets:

- `public-documents`: public-read only for documents with `visibility = 'public'`.
- `private-documents`: private bucket for resident, board, vendor, property-specific, and admin documents.
- `uploads-temp`: private temporary upload staging, lifecycle-cleaned.

Access:

- Private document downloads require server-side permission checks and signed URLs.
- Document visibility changes must write audit logs.

## 6.2 `document_access_logs`

```sql
create table document_access_logs (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  profile_id uuid references profiles(id),
  access_type text not null check (access_type in ('view', 'download', 'signed_url_created')),
  result text not null check (result in ('allowed', 'denied')),
  reason text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);
```

Indexes:

```sql
create index document_access_doc_idx on document_access_logs(community_id, document_id, created_at desc);
create index document_access_profile_idx on document_access_logs(community_id, profile_id, created_at desc);
```

## 6.3 `announcements`

```sql
create table announcements (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  title text not null,
  body text not null,
  visibility text not null check (visibility in ('public', 'resident', 'board', 'property_specific')),
  property_ids uuid[],
  status text not null default 'draft' check (status in ('draft', 'published', 'expired', 'archived')),
  pinned boolean not null default false,
  publish_at timestamptz not null default now(),
  expires_at timestamptz,
  attachment_document_ids uuid[] not null default '{}',
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Indexes:

```sql
create index announcements_feed_idx on announcements(community_id, status, visibility, publish_at desc);
create index announcements_pinned_idx on announcements(community_id, pinned, publish_at desc);
create index announcements_property_gin_idx on announcements using gin(property_ids);
```

## 6.4 `events`

```sql
create table events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  title text not null,
  description text,
  type text not null check (type in ('hoa_meeting', 'board_meeting', 'community_event', 'pool', 'maintenance_window', 'dues_deadline', 'other')),
  visibility event_visibility not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text,
  related_meeting_id uuid,
  related_compliance_event_id uuid,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'completed', 'archived')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Indexes:

```sql
create index events_calendar_idx on events(community_id, visibility, starts_at);
create index events_type_idx on events(community_id, type, starts_at);
create index events_status_idx on events(community_id, status, starts_at);
```

## 6.5 `message_threads` and `messages`

```sql
create table message_threads (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  property_id uuid not null references properties(id),
  subject text not null,
  category text not null check (category in ('dues', 'documents', 'maintenance', 'architectural', 'complaint', 'general')),
  status text not null default 'open'
    check (status in ('open', 'pending_board', 'pending_resident', 'closed', 'archived')),
  created_by uuid not null references profiles(id),
  assigned_to uuid references profiles(id),
  last_message_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  thread_id uuid not null references message_threads(id) on delete cascade,
  property_id uuid not null references properties(id),
  sender_id uuid not null references profiles(id),
  sender_role text not null check (sender_role in ('resident', 'board_member', 'admin')),
  body text not null,
  attachment_document_ids uuid[] not null default '{}',
  visibility text not null default 'thread_participants'
    check (visibility in ('thread_participants', 'board_admin_only')),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
```

Indexes:

```sql
create index message_threads_property_idx on message_threads(community_id, property_id, last_message_at desc);
create index message_threads_status_idx on message_threads(community_id, status, last_message_at desc);
create index message_threads_assigned_idx on message_threads(community_id, assigned_to, status);
create index messages_thread_idx on messages(community_id, thread_id, created_at);
```

## 7. Compliance Tables

## 7.1 `compliance_calendar_events`

```sql
create table compliance_calendar_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  type text not null check (type in ('annual_meeting', 'board_meeting', 'financial_statement', 'records_request', 'assessment_due', 'delinquency_review', 'lien_review', 'fine_hearing', 'audit_review', 'custom')),
  title text not null,
  description text,
  related_property_id uuid references properties(id),
  related_meeting_id uuid,
  related_records_request_id uuid,
  related_assessment_id uuid references assessments(id),
  related_lien_case_id uuid,
  related_fine_case_id uuid,
  due_at timestamptz not null,
  starts_at timestamptz,
  status compliance_status not null default 'upcoming',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical')),
  legal_sensitive boolean not null default false,
  assigned_profile_ids uuid[] not null default '{}',
  completed_at timestamptz,
  completed_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Indexes:

```sql
create index compliance_due_idx on compliance_calendar_events(community_id, due_at, status);
create index compliance_type_due_idx on compliance_calendar_events(community_id, type, due_at);
create index compliance_legal_idx on compliance_calendar_events(community_id, legal_sensitive, status);
create index compliance_assigned_gin_idx on compliance_calendar_events using gin(assigned_profile_ids);
```

## 7.2 `compliance_tasks`

```sql
create table compliance_tasks (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  compliance_event_id uuid not null references compliance_calendar_events(id) on delete cascade,
  title text not null,
  description text,
  type text not null check (type in ('notice', 'document_upload', 'review', 'mailing', 'hearing', 'approval', 'deadline', 'custom')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'blocked', 'deferred')),
  due_at timestamptz,
  assigned_to uuid references profiles(id),
  evidence jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  completed_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Indexes:

```sql
create index compliance_tasks_event_idx on compliance_tasks(community_id, compliance_event_id, status);
create index compliance_tasks_assigned_idx on compliance_tasks(community_id, assigned_to, due_at);
create index compliance_tasks_status_due_idx on compliance_tasks(community_id, status, due_at);
```

## 7.3 `records_requests`

```sql
create table records_requests (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  property_id uuid references properties(id),
  requester_profile_id uuid references profiles(id),
  requester_name text not null,
  requester_email citext,
  requester_phone text,
  authorized_agent boolean not null default false,
  request_type text not null check (request_type in ('general_records', 'unpaid_assessment_statement')),
  requested_records text not null,
  received_at timestamptz not null default now(),
  due_at timestamptz not null,
  status text not null default 'received'
    check (status in ('received', 'in_progress', 'fulfilled', 'denied', 'partially_fulfilled', 'overdue')),
  assigned_to uuid references profiles(id),
  response_notes text,
  response_document_ids uuid[] not null default '{}',
  responded_at timestamptz,
  responded_by uuid references profiles(id),
  fee_amount_cents integer,
  fee_reason text,
  fee_paid boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Indexes:

```sql
create index records_requests_due_idx on records_requests(community_id, status, due_at);
create index records_requests_property_idx on records_requests(community_id, property_id, received_at desc);
create index records_requests_type_idx on records_requests(community_id, request_type, due_at);
```

## 7.4 `meetings`

```sql
create table meetings (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  type text not null check (type in ('annual_association', 'special_association', 'board', 'committee')),
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'notice_sent', 'completed', 'minutes_approved', 'cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  agenda jsonb not null default '[]'::jsonb,
  notice_required boolean not null default false,
  notice_earliest_send_at timestamptz,
  notice_latest_send_at timestamptz,
  notice_sent_at timestamptz,
  notice_sent_by uuid references profiles(id),
  notice_method text check (notice_method in ('mail', 'hand_delivery', 'email', 'mixed')),
  notice_recipient_count integer,
  notice_document_id uuid references documents(id),
  owner_comment_opportunity boolean not null default false,
  draft_minutes_document_id uuid references documents(id),
  approved_minutes_document_id uuid references documents(id),
  minutes_approved_at timestamptz,
  minutes_approved_by uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Indexes:

```sql
create index meetings_type_start_idx on meetings(community_id, type, starts_at desc);
create index meetings_status_start_idx on meetings(community_id, status, starts_at);
create index meetings_notice_deadline_idx on meetings(community_id, notice_latest_send_at) where notice_latest_send_at is not null;
```

## 7.5 `annual_financial_statements`

```sql
create table annual_financial_statements (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  fiscal_year_label text not null,
  fiscal_year_start date not null,
  fiscal_year_end date not null,
  due_at timestamptz not null,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'board_review', 'available_to_residents', 'overdue', 'archived')),
  income_expense_document_id uuid references documents(id),
  balance_sheet_document_id uuid references documents(id),
  supporting_document_ids uuid[] not null default '{}',
  made_available_at timestamptz,
  reviewed_by_profile_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, fiscal_year_label)
);
```

Indexes:

```sql
create index annual_financial_status_due_idx on annual_financial_statements(community_id, status, due_at);
```

## 8. Later-Phase Tables

The following tables are not MVP unless pulled forward, but should be reserved in design.

```sql
-- vendors, vendor_proposals, vendor_invoices
-- maintenance_requests
-- architectural_requests
-- amenities, pool_maintenance_logs
-- fine_cases
-- lien_cases
-- reconciliation_runs
```

Minimum future-table principles:

- Include `community_id`.
- Include status, timestamps, and actor fields.
- Link legal-sensitive workflows to `compliance_calendar_events`.
- Audit sensitive changes.

## 9. Audit and Email Tables

## 9.1 `audit_logs`

```sql
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references communities(id),
  actor_profile_id uuid references profiles(id),
  actor_type text not null check (actor_type in ('user', 'system', 'webhook', 'job')),
  action text not null,
  target_table text not null,
  target_id uuid,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  request_id text,
  reason text,
  created_at timestamptz not null default now()
);
```

Indexes:

```sql
create index audit_logs_community_created_idx on audit_logs(community_id, created_at desc);
create index audit_logs_actor_idx on audit_logs(community_id, actor_profile_id, created_at desc);
create index audit_logs_target_idx on audit_logs(target_table, target_id, created_at desc);
create index audit_logs_action_idx on audit_logs(action, created_at desc);
```

Security:

- Append-only by application convention.
- No normal app delete path.
- Restrict viewing to board/admin/legal reviewer permissions.

## 9.2 `email_logs`

```sql
create table email_logs (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references communities(id),
  type text not null check (type in ('payment_receipt', 'guest_payment_receipt', 'compliance_warning', 'records_request', 'meeting_notice', 'invitation', 'message_notification', 'other')),
  recipient_email citext not null,
  recipient_profile_id uuid references profiles(id),
  subject text not null,
  provider text not null default 'resend',
  provider_message_id text,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'bounced', 'failed', 'suppressed')),
  related_property_id uuid references properties(id),
  related_payment_id uuid references payments(id),
  related_compliance_event_id uuid references compliance_calendar_events(id),
  related_records_request_id uuid references records_requests(id),
  related_meeting_id uuid references meetings(id),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Indexes:

```sql
create index email_logs_type_created_idx on email_logs(community_id, type, created_at desc);
create index email_logs_recipient_idx on email_logs(recipient_email, created_at desc);
create index email_logs_status_idx on email_logs(status, created_at desc);
create index email_logs_compliance_idx on email_logs(related_compliance_event_id) where related_compliance_event_id is not null;
```

## 10. Relationships

Core:

- `auth.users.id` -> `profiles.auth_user_id`
- `communities.id` -> all `community_id` columns
- `properties.id` -> `property_memberships.property_id`
- `profiles.id` -> `property_memberships.profile_id`
- `roles.id` -> `profile_roles.role_id`
- `profiles.id` -> `profile_roles.profile_id`
- `properties.id` -> `assessments.property_id`
- `assessment_cycles.id` -> `assessments.assessment_cycle_id`
- `properties.id` -> `payments.property_id`
- `payments.id` -> `payment_allocations.payment_id`
- `assessments.id` -> `payment_allocations.assessment_id`
- `documents.id` -> document references across meetings, financial statements, messages, and compliance evidence
- `message_threads.id` -> `messages.thread_id`
- `compliance_calendar_events.id` -> `compliance_tasks.compliance_event_id`

Compliance:

- `meetings.id` -> `events.related_meeting_id`
- `records_requests.id` -> `compliance_calendar_events.related_records_request_id`
- `assessments.id` -> `compliance_calendar_events.related_assessment_id`
- `properties.id` -> delinquency and lien-related workflow records later

## 11. Row Level Security Strategy

Enable RLS on all private application tables.

```sql
alter table profiles enable row level security;
alter table properties enable row level security;
alter table property_memberships enable row level security;
alter table payments enable row level security;
alter table documents enable row level security;
alter table announcements enable row level security;
alter table events enable row level security;
alter table message_threads enable row level security;
alter table messages enable row level security;
alter table compliance_calendar_events enable row level security;
alter table records_requests enable row level security;
```

Recommended helper functions:

```sql
-- Returns current app profile id for auth.uid()
app.current_profile_id()

-- True if current user has role/permission in community
app.has_permission(target_community_id uuid, permission_key text)

-- True if current user has active membership for property
app.can_access_property(target_property_id uuid)

-- True if current user can read document
app.can_read_document(target_document_id uuid)
```

Policy examples:

```sql
-- Residents can view active memberships for themselves.
create policy "read own memberships"
on property_memberships
for select
using (profile_id = app.current_profile_id());

-- Residents can view linked properties.
create policy "read linked properties"
on properties
for select
using (
  exists (
    select 1
    from property_memberships pm
    where pm.property_id = properties.id
      and pm.profile_id = app.current_profile_id()
      and pm.status = 'active'
  )
  or app.has_permission(properties.community_id, 'properties:read')
);
```

Server-side admin operations may use the Supabase service role only inside trusted server code. Never expose the service role key to the browser.

## 12. Storage Security

Supabase Storage buckets:

- `public-documents`: public content only.
- `private-documents`: private HOA records.
- `message-attachments`: private attachments.
- `pool-maintenance`: later phase, private by default.

Rules:

- Public documents can be served publicly only when the metadata row has `visibility = 'public'`.
- Private downloads should be generated by a server action or route handler after authorization.
- Signed URLs should be short-lived.
- Uploads should be scanned/validated for file type and size where feasible.

## 13. Password and Authentication Security

Using Supabase Auth:

- Supabase Auth handles password hashing and session security.
- Application tables must not store passwords or hashes.
- Enable email confirmation if appropriate.
- Enable MFA for board/admin users if feasible.
- Use role checks after authentication; authentication alone does not imply authorization.

If a custom auth path is ever introduced:

- Use Argon2id for password hashing.
- Store only password hashes.
- Use secure, HTTP-only cookies.
- Rate limit login and password reset.
- Store reset tokens hashed and short-lived.

## 14. Indexing Summary

Critical query indexes:

- `properties(community_id, account_number)`
- `property_memberships(community_id, profile_id, status)`
- `property_memberships(community_id, property_id, status)`
- `assessments(community_id, property_id, due_date desc)`
- `payments(community_id, property_id, created_at desc)`
- `documents(community_id, visibility, category, created_at desc)`
- `announcements(community_id, status, visibility, publish_at desc)`
- `events(community_id, visibility, starts_at)`
- `message_threads(community_id, property_id, last_message_at desc)`
- `compliance_calendar_events(community_id, due_at, status)`
- `records_requests(community_id, status, due_at)`
- `audit_logs(community_id, created_at desc)`
- `email_logs(community_id, type, created_at desc)`

Use GIN indexes for arrays/jsonb where needed:

```sql
create index announcements_property_gin_idx on announcements using gin(property_ids);
create index compliance_assigned_gin_idx on compliance_calendar_events using gin(assigned_profile_ids);
create index community_settings_feature_flags_gin_idx on community_settings using gin(feature_flags);
```

## 15. Migration Strategy

Recommended tools:

- Supabase migrations.
- SQL migration files committed to the repo.
- Generated TypeScript types from Supabase.

Migration rules:

- Add tables and columns through migrations.
- Avoid destructive migrations without backups.
- Backfill before adding `not null` constraints where data exists.
- Keep RLS policies versioned with schema changes.
- Seed the initial Spring Meadow Community record, default roles, and default compliance settings.

## 16. Open Questions

- Should resident login use password, magic link, OAuth, or a combination?
- Should guest payment use account number, address, public payment code, or all three?
- Which admin role can manually record offline payments?
- Which board roles can see audit logs?
- Should every private document download be logged, or only sensitive categories?
- What retention policy applies to payment, audit, compliance, and message records?
