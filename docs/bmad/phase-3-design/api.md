---
title: "Spring Meadow Community API Design"
status: "draft"
phase: "phase-3-design"
version: "1.0"
created: "2026-04-30"
updated: "2026-04-30"
recommended_stack:
  app: "Next.js + TypeScript"
  database: "Supabase Postgres"
  auth: "Supabase Auth"
  storage: "Supabase Storage; Cloudflare R2 optional later"
  payments: "Stripe"
  email: "Resend"
  edge_security: "Cloudflare DNS/CDN/Turnstile"
source_requirements: "/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md"
source_architecture: "/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md"
source_data_model: "/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md"
legal_note: "Product planning artifact only; not legal advice."
---

# Spring Meadow Community API Design

## 1. Purpose

This document defines the API and server-side interaction model for Spring Meadow Community using the approved stack:

- Next.js + TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Stripe
- Resend
- Cloudflare

The implementation should prefer server-side workflows. Sensitive operations must not rely on client-side authorization.

## 2. API Style

Use a mix of:

- **Next.js server actions** for authenticated app mutations.
- **Route handlers** for public forms, webhooks, signed file access, and external integrations.
- **Server-side query/service modules** for reusable business logic.
- **Supabase generated types** for database type safety.

Recommended structure:

```text
app/
  (public)/
  (auth)/
  (resident)/
  (admin)/
  (guest-payment)/
  api/
    stripe/webhook/route.ts
    documents/[id]/signed-url/route.ts
    public/vendor-proposals/route.ts
    public/contact/route.ts
    jobs/compliance-reminders/route.ts
server/
  actions/
  queries/
  services/
    auth/
    authorization/
    properties/
    payments/
    documents/
    compliance/
    email/
    audit/
    storage/
```

## 3. Cross-Cutting API Requirements

### 3.1 Authentication

Private actions and routes must:

1. Read the Supabase session server-side.
2. Resolve `profiles.id` from `auth.users.id`.
3. Reject unauthenticated requests.
4. Apply role and property authorization before data access.

### 3.2 Authorization

Every private API must check:

- Community scope.
- Current profile.
- Role permission.
- Property membership when property data is involved.
- Document visibility when files are involved.

### 3.3 Validation

Use Zod or equivalent runtime validation at API boundaries.

Validate:

- IDs are UUIDs.
- Amounts are integer cents.
- Dates are valid.
- Enums/statuses are allowed values.
- Guest payment responses never include private fields.

### 3.4 Audit Logging

Sensitive mutations must write `audit_logs`.

Audited actions:

- Role changes.
- Property membership changes.
- Payment adjustments.
- Manual payment creation.
- Document upload/delete/visibility change.
- Compliance task completion.
- Meeting notice sent.
- Records request response.
- Legal-sensitive workflow status changes.

### 3.5 Error Format

Use a consistent error shape:

```ts
type ApiError = {
  error: {
    code: string
    message: string
    fieldErrors?: Record<string, string[]>
    requestId?: string
  }
}
```

Do not expose internal stack traces or authorization details.

## 4. Public Routes

## 4.1 Public Content

Public pages may query published public announcements, public events, and public documents.

Server queries:

```ts
getPublicAnnouncements(communitySlug: string)
getPublicEvents(communitySlug: string)
getPublicDocuments(communitySlug: string)
```

Access:

- No login required.
- Return only records marked public.

## 4.2 Public Contact Form

Route:

```http
POST /api/public/contact
```

Request:

```ts
{
  communitySlug: string
  name: string
  email: string
  phone?: string
  message: string
  turnstileToken: string
}
```

Behavior:

- Verify Cloudflare Turnstile token.
- Validate input.
- Send email via Resend or create internal message/inquiry record.
- Rate limit by IP/email.

Response:

```ts
{ ok: true }
```

## 5. Auth and Profile API

Supabase Auth handles login, logout, registration, password reset, magic links, and sessions.

Application server actions:

```ts
getCurrentProfile()
updateMyProfile(input)
updateNotificationPreferences(input)
acceptPropertyInvitation(token)
```

Security:

- Users can edit only their own profile/preferences.
- Property invitation acceptance must verify token, expiration, recipient, and membership state.

## 6. Resident Portal API

## 6.1 Resident Dashboard

Server query:

```ts
getResidentDashboard(communityId: string, propertyId?: string)
```

Returns:

```ts
{
  properties: Array<{
    id: string
    address: string
    accountNumberMasked: string
    duesStatus: "current" | "due_soon" | "overdue" | "delinquent" | "disputed"
    currentBalanceCents: number
    nextDueDate?: string
    lastPaymentAt?: string
  }>
  announcements: AnnouncementSummary[]
  upcomingEvents: EventSummary[]
}
```

Authorization:

- User must have active property membership.
- Return only linked properties.

## 6.2 Property Details

Server query:

```ts
getMyProperty(propertyId: string)
```

Authorization:

- Active membership required.

## 7. Payments API

## 7.1 Create Resident Payment Session

Server action:

```ts
createResidentPaymentSession(input: {
  communityId: string
  propertyId: string
  amountCents: number
  assessmentIds?: string[]
  methodPreference?: "card" | "ach"
}): Promise<{ checkoutUrl: string }>
```

Behavior:

- Verify active property membership.
- Verify `can_pay_dues`.
- Validate amount.
- Create pending `payments` row.
- Create Stripe Checkout Session or Payment Intent.
- Return Stripe checkout URL.

Security:

- Do not trust client-provided balance.
- Server calculates allowed payment context.

## 7.2 Create Guest Payment Session

Route:

```http
POST /api/guest-payments/create-session
```

Request:

```ts
{
  communitySlug: string
  propertyLookup: {
    addressLine1?: string
    postalCode?: string
    accountNumber?: string
    publicPaymentCode?: string
  }
  payer: {
    name?: string
    email: string
    phone?: string
  }
  amountCents: number
  methodPreference?: "card" | "ach"
  turnstileToken: string
}
```

Response:

```ts
{
  checkoutUrl: string
  confirmation: "payment_session_created"
}
```

Behavior:

- Verify Turnstile.
- Locate property without returning private details.
- Create pending guest payment.
- Create Stripe checkout session.
- Return checkout URL.

Never return:

- Owner name.
- Balance.
- Payment history.
- Documents.
- Resident contact data.

## 7.3 Stripe Webhook

Route:

```http
POST /api/stripe/webhook
```

Behavior:

- Read raw request body.
- Verify Stripe signature.
- Store `payment_events` idempotently by Stripe event ID.
- Update `payments`.
- Apply allocations to assessments.
- Update property balance summary.
- Send receipt email through Resend when appropriate.
- Write audit log with actor type `webhook`.

Handled event types:

- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`

Security:

- Never process unverified webhook payloads.
- Never rely only on browser redirect success.

## 7.4 Payment History

Server query:

```ts
getPropertyPaymentHistory(propertyId: string)
```

Authorization:

- Active property membership with balance/payment permission, or board/admin payment permission.

## 8. Documents API

## 8.1 List Documents

Server query:

```ts
listDocuments(input: {
  communityId: string
  propertyId?: string
  visibility?: string
  category?: string
})
```

Authorization:

- Public users can see only public documents.
- Residents can see resident documents plus property-specific docs for linked properties.
- Board/admin can see documents according to role permissions.

## 8.2 Upload Document

Server action:

```ts
uploadDocumentMetadata(input: {
  communityId: string
  title: string
  description?: string
  category: string
  visibility: "public" | "resident" | "board" | "vendor" | "property_specific" | "admin"
  relatedPropertyId?: string
  file: {
    storageBucket: string
    storagePath: string
    contentType: string
    sizeBytes: number
    checksum?: string
  }
})
```

Behavior:

- Check document management permission.
- Validate related property if property-specific.
- Insert `documents`.
- Write audit log.

## 8.3 Signed Download URL

Route:

```http
GET /api/documents/:id/signed-url
```

Behavior:

- Authenticate when document is not public.
- Check access.
- Create short-lived Supabase Storage signed URL.
- Insert `document_access_logs`.

Response:

```ts
{ url: string; expiresInSeconds: number }
```

## 9. Announcements API

Server queries/actions:

```ts
listAnnouncements(input)
createAnnouncement(input)
updateAnnouncement(id, input)
publishAnnouncement(id)
archiveAnnouncement(id)
```

Authorization:

- Public can read public published announcements.
- Residents can read resident-visible announcements.
- Board/admin can manage according to permissions.

Audit:

- Create/update/publish/archive should be audited.

## 10. Events API

Server queries/actions:

```ts
listEvents(input)
createEvent(input)
updateEvent(id, input)
cancelEvent(id)
```

Authorization:

- Same visibility model as announcements.
- Board/admin required for mutation.

## 11. Messages API

## 11.1 Create Resident Message

Server action:

```ts
createMessageThread(input: {
  communityId: string
  propertyId: string
  subject: string
  category: "dues" | "documents" | "maintenance" | "architectural" | "complaint" | "general"
  body: string
  attachmentDocumentIds?: string[]
})
```

Authorization:

- Active membership for property.

Behavior:

- Insert `message_threads`.
- Insert first `messages` row.
- Notify board/admin recipients by Resend if configured.

## 11.2 Reply to Thread

Server action:

```ts
replyToMessageThread(threadId: string, input: {
  body: string
  attachmentDocumentIds?: string[]
})
```

Authorization:

- Resident may reply to own property thread.
- Board/admin may reply with message permission.

## 12. Admin API

Server actions:

```ts
createProperty(input)
updateProperty(propertyId, input)
invitePropertyMember(propertyId, input)
updatePropertyMembership(membershipId, input)
assignRole(profileId, roleId, scope)
removeRole(profileRoleId)
```

Security:

- Require admin/user management permission.
- Audit all membership and role changes.

## 13. Compliance Calendar API

## 13.1 List Compliance Events

Server query:

```ts
listComplianceEvents(input: {
  communityId: string
  from?: string
  to?: string
  status?: string
  type?: string
})
```

Authorization:

- Board/admin/compliance permissions required.

## 13.2 Create Compliance Event

Server action:

```ts
createComplianceEvent(input: {
  communityId: string
  type: string
  title: string
  description?: string
  dueAt: string
  startsAt?: string
  relatedPropertyId?: string
  legalSensitive?: boolean
  assignedProfileIds?: string[]
})
```

Behavior:

- Create event.
- Optionally create default tasks.
- Audit creation.

## 13.3 Complete Compliance Task

Server action:

```ts
completeComplianceTask(taskId: string, input: {
  evidenceNote?: string
  evidenceDocumentIds?: string[]
})
```

Authorization:

- Assigned user or board/admin.
- Legal-sensitive tasks may require legal/compliance reviewer permission.

## 13.4 Generate Compliance Deadlines

Server service:

```ts
generateComplianceDeadlines(communityId: string)
```

Generates:

- Annual meeting reminders.
- Meeting notice window reminders.
- Annual financial statement deadlines.
- Records request deadlines.
- Assessment and delinquency reminders.
- Lien readiness reminders.

This should be idempotent.

## 13.5 Compliance Reminder Job

Route:

```http
POST /api/jobs/compliance-reminders
```

Authentication:

- Secured by cron secret header or platform-provided cron authentication.

Behavior:

- Find due reminders.
- Send Resend emails.
- Insert `email_logs`.
- Update reminder sent metadata.
- Write job/audit logs.

## 14. Records Requests API

Server actions:

```ts
createRecordsRequest(input)
assignRecordsRequest(id, profileId)
respondToRecordsRequest(id, input)
markRecordsRequestFulfilled(id)
```

Special behavior:

- Unpaid assessment statement request gets due date based on community setting, default 10 business days.
- Response should link document IDs and preserve response timestamp.

## 15. Meeting API

Server actions:

```ts
createMeeting(input)
updateMeeting(id, input)
calculateMeetingNoticeWindow(meetingId)
markMeetingNoticeSent(id, input)
uploadDraftMinutes(id, documentId)
approveMeetingMinutes(id, documentId)
```

Rules:

- For NC defaults, notice window is 60 to 10 days before meeting.
- Notice sent outside window should be blocked or require explicit override with reason.
- Agenda special flags should be captured.

## 16. Annual Financial Statement API

Server actions:

```ts
createAnnualFinancialStatementCycle(input)
uploadAnnualFinancialStatementDocuments(id, input)
markFinancialStatementAvailable(id)
```

Rules:

- Default due date is fiscal year close + 75 days.
- Completion requires resident-visible income/expense and balance sheet documents, or an explicit configured override.

## 17. Resend Email Service

Server service:

```ts
sendEmail(input: {
  communityId?: string
  type: EmailType
  to: string
  subject: string
  template: string
  data: Record<string, unknown>
  related?: RelatedRecordRefs
})
```

Email types:

- Payment receipt.
- Guest payment receipt.
- Compliance warning.
- Records request reminder.
- Meeting notice workflow reminder.
- Invitation.
- Message notification.

Requirements:

- Insert `email_logs`.
- Avoid leaking private balances or owner info in guest emails.
- Retry or surface failures.

## 18. Cloudflare Integration

Use Cloudflare for:

- DNS.
- CDN.
- Turnstile bot protection.
- Optional future R2 storage.

Turnstile verification service:

```ts
verifyTurnstile(token: string, remoteIp?: string): Promise<boolean>
```

Use on:

- Public contact form.
- Guest payment session creation.
- Vendor proposal form later.
- Potentially login-adjacent abuse-prone flows.

## 19. Supabase Service Clients

Use two Supabase clients:

- User-scoped client for normal authenticated reads under RLS.
- Service role client only in trusted server code for admin jobs, webhooks, and storage signing.

Rules:

- Never expose service role key to browser.
- Keep service functions small and audited.
- Prefer explicit authorization before service role writes.

## 20. API Security Checklist

- Validate every input server-side.
- Check auth on private routes.
- Check role and property access.
- Use RLS for database defense in depth.
- Use Stripe webhook signature verification.
- Use Cloudflare Turnstile on public abuse-prone endpoints.
- Rate limit public and auth-adjacent endpoints.
- Avoid private data in guest responses.
- Use signed URLs for private documents.
- Audit sensitive mutations.
- Log email and webhook failures.

## 21. Open API Questions

- Should MVP use Stripe Checkout or Payment Element?
- Should ACH be enabled in MVP or added after card payments work?
- Should resident-to-board messages be threaded from day one?
- Should public contact form create a database inquiry record or only send email?
- Should compliance reminder jobs use Vercel Cron, Supabase scheduled Edge Functions, or another scheduler?
