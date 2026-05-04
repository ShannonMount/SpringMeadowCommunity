---
title: "Spring Meadow Community Data Model v1"
status: "superseded"
phase: "phase-3-design"
version: "1.0"
created: "2026-04-30"
updated: "2026-04-30"
database: "MongoDB"
source_requirements: "/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-1-requirements/requirements.md"
source_architecture: "/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-2-architecture/architecture.md"
note: "This is a MongoDB data model alternative. The architecture document currently recommends Supabase Postgres; update architecture if MongoDB is selected."
superseded_by: "/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md"
legal_note: "Product planning artifact only; not legal advice."
---

# Spring Meadow Community Data Model v1

> Superseded: this MongoDB alternative has been replaced by the canonical Supabase Postgres data model at `/home/smount/Websites/SpringMeadowCommunity/docs/bmad/phase-3-design/data-model.md`.

## 1. Purpose

This document defines a MongoDB-oriented data model for Spring Meadow Community, a property-centered HOA public website, resident portal, board/admin workspace, payment system, document library, and compliance calendar.

The model supports:

- Public HOA website content.
- Resident login and property memberships.
- Multiple users per property.
- Property-centered dues, payments, documents, and messages.
- Guest dues payments without balance disclosure.
- Document visibility controls.
- Board/admin workflows.
- North Carolina compliance calendar and warning emails.
- Audit logs and financial safeguards.
- Later vendor, pool maintenance, fine, suspension, and lien-preparation workflows.
- Future multi-HOA support through `communityId` scoping.

## 2. MongoDB Design Principles

### 2.1 Community Scope Everywhere

All business collections should include `communityId` unless they are truly global configuration records.

Reason:

- Supports future multi-HOA SaaS.
- Prevents cross-community data leakage.
- Enables tenant-scoped indexes and queries.

### 2.2 Property-Centered Records

The durable HOA account is the property, not the user. Users connect to properties through memberships.

Reason:

- Multiple users can share one property's records.
- One user can access multiple properties.
- Dues, documents, requests, and compliance events often belong to a property.

### 2.3 Embed Small Stable Subdocuments, Reference Large or Shared Records

Use embedded subdocuments for:

- Addresses.
- Small status histories.
- Notification preferences.
- Meeting agenda items.
- Checklist items.
- Snapshot data needed for audit history.

Use references for:

- Users.
- Properties.
- Payments.
- Documents.
- Messages.
- Compliance cases.
- Large histories.

### 2.4 Append-Only for Sensitive Logs

Audit logs, payment events, compliance evidence, and email logs should be append-only. Normal application workflows must not allow board/admin users to erase these histories.

### 2.5 Denormalize Carefully

Store display snapshots where historical accuracy matters, such as payer name/email, property address at payment time, notice recipients, and compliance evidence. Do not depend only on live referenced records for legal-sensitive history.

## 3. Global Types and Conventions

### 3.1 ObjectId References

Use MongoDB `ObjectId` for internal primary keys.

Reference naming:

```ts
communityId: ObjectId
propertyId: ObjectId
userId: ObjectId
documentId: ObjectId
paymentId: ObjectId
```

### 3.2 Common Metadata

Most collections should include:

```ts
createdAt: Date
updatedAt: Date
createdBy?: ObjectId
updatedBy?: ObjectId
deletedAt?: Date
deletedBy?: ObjectId
```

Use soft deletion for records that may need retention.

### 3.3 Common Status Fields

Prefer string enum values:

```ts
status: "draft" | "active" | "inactive" | "archived"
```

For workflow records, use domain-specific statuses documented below.

### 3.4 Money Representation

Store money in integer cents:

```ts
amountCents: number
currency: "USD"
```

Do not use floating point dollars for financial values.

## 4. Collection Inventory

MVP collections:

- `communities`
- `users`
- `sessions`
- `passwordResetTokens`
- `properties`
- `propertyMemberships`
- `roles`
- `userRoles`
- `assessments`
- `assessmentCycles`
- `payments`
- `paymentEvents`
- `documents`
- `documentAccessLogs`
- `announcements`
- `events`
- `messageThreads`
- `messages`
- `complianceCalendarEvents`
- `complianceTasks`
- `recordsRequests`
- `meetings`
- `annualFinancialStatements`
- `auditLogs`
- `emailLogs`
- `appSettings`

Later-phase collections:

- `vendors`
- `vendorProposals`
- `vendorInvoices`
- `maintenanceRequests`
- `architecturalRequests`
- `amenities`
- `poolMaintenanceLogs`
- `fineCases`
- `lienCases`
- `reconciliationRuns`

## 5. MVP Collection Schemas

Schema examples are TypeScript-style document shapes for clarity. Actual implementation can use Mongoose, Zod, TypeBox, or native MongoDB validation.

## 5.1 `communities`

Represents one HOA/community tenant.

```ts
type Community = {
  _id: ObjectId
  name: string // "Spring Meadow Community"
  slug: string // "spring-meadow-community"
  legalName?: string
  status: "active" | "inactive" | "archived"
  timezone: string // "America/New_York"
  jurisdiction: {
    country: "US"
    state: "NC"
    type: "planned_community" | "condominium" | "unknown"
    statuteChapter?: "47F" | "47C"
  }
  fiscalYear: {
    startMonth: number // 1-12
    startDay: number
    endMonth: number
    endDay: number
  }
  branding: {
    logoUrl?: string
    primaryColor?: string
    secondaryColor?: string
    publicDisplayName: string
  }
  paymentSettings: {
    stripeAccountMode: "platform" | "direct"
    stripeConnectedAccountId?: string
    feePolicy: "payer_pays" | "hoa_pays" | "configurable"
    allowCard: boolean
    allowAch: boolean
    guestPaymentsEnabled: boolean
  }
  complianceSettings: {
    annualMeetingRequired: boolean
    meetingNoticeEarliestDays: number // NC default 60
    meetingNoticeLatestDays: number // NC default 10
    annualFinancialStatementDueDays: number // NC default 75
    unpaidAssessmentStatementDueBusinessDays: number // NC default 10
    lienReadinessDaysPastDue: number // NC default 30
    preLienNoticeWaitDays: number // NC default 15
    lienEnforcementDeadlineYears: number // NC default 3
  }
  featureFlags: {
    residentPortal: boolean
    guestPayments: boolean
    complianceCalendar: boolean
    communityPosts: boolean
    vendorPortal: boolean
    poolMaintenance: boolean
    architecturalRequests: boolean
    maintenanceRequests: boolean
  }
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.communities.createIndex({ slug: 1 }, { unique: true })
db.communities.createIndex({ status: 1 })
```

## 5.2 `users`

Stores application user profiles and credentials if not using an external auth provider.

```ts
type User = {
  _id: ObjectId
  email: string
  emailLower: string
  emailVerifiedAt?: Date
  phone?: string
  name: {
    first?: string
    last?: string
    display: string
  }
  auth: {
    provider: "local" | "google" | "microsoft" | "magic_link"
    passwordHash?: string
    passwordHashAlgorithm?: "argon2id" | "bcrypt"
    passwordUpdatedAt?: Date
    mustResetPassword?: boolean
    mfaEnabled?: boolean
  }
  status: "invited" | "active" | "suspended" | "disabled"
  notificationPreferences: {
    email: boolean
    sms: boolean
    complianceEmails: boolean
    paymentReceipts: boolean
    announcements: boolean
  }
  lastLoginAt?: Date
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}
```

Indexes:

```js
db.users.createIndex({ emailLower: 1 }, { unique: true })
db.users.createIndex({ status: 1 })
db.users.createIndex({ lastLoginAt: -1 })
```

Security notes:

- Never store plaintext passwords.
- Prefer Argon2id for password hashing.
- If using bcrypt, use a strong work factor and plan periodic upgrades.
- Store reset tokens hashed, not plaintext.
- Rate limit login, signup, invitation acceptance, and password reset flows.
- Consider using Auth.js, Clerk, Auth0, or another managed auth provider if not using Supabase Auth.

## 5.3 `sessions`

Only needed for custom session storage. If using a managed auth/session provider, this may be replaced by provider-managed sessions.

```ts
type Session = {
  _id: ObjectId
  userId: ObjectId
  sessionTokenHash: string
  createdAt: Date
  expiresAt: Date
  lastSeenAt?: Date
  ipAddress?: string
  userAgent?: string
  revokedAt?: Date
}
```

Indexes:

```js
db.sessions.createIndex({ sessionTokenHash: 1 }, { unique: true })
db.sessions.createIndex({ userId: 1, expiresAt: -1 })
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
```

## 5.4 `passwordResetTokens`

```ts
type PasswordResetToken = {
  _id: ObjectId
  userId: ObjectId
  tokenHash: string
  createdAt: Date
  expiresAt: Date
  usedAt?: Date
  requestedIp?: string
}
```

Indexes:

```js
db.passwordResetTokens.createIndex({ tokenHash: 1 }, { unique: true })
db.passwordResetTokens.createIndex({ userId: 1, createdAt: -1 })
db.passwordResetTokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
```

Security notes:

- Store only token hashes.
- Use high-entropy random tokens.
- Expire quickly.
- Invalidate prior active reset tokens when issuing a new one.

## 5.5 `properties`

Represents HOA lots/homes.

```ts
type Property = {
  _id: ObjectId
  communityId: ObjectId
  accountNumber: string
  status: "active" | "inactive" | "archived"
  address: {
    line1: string
    line2?: string
    city: string
    state: "NC"
    postalCode: string
    county?: string
  }
  mailingAddress?: {
    line1: string
    line2?: string
    city: string
    state: string
    postalCode: string
  }
  ownerDisplayName?: string // optional admin display; not exposed to guest payers
  lot: {
    lotNumber?: string
    parcelNumber?: string
    platReference?: string
  }
  duesSummary: {
    currentBalanceCents: number
    lastPaymentAt?: Date
    nextDueDate?: Date
    delinquencyStatus: "current" | "due_soon" | "overdue" | "delinquent" | "lien_review" | "disputed"
  }
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}
```

Indexes:

```js
db.properties.createIndex({ communityId: 1, accountNumber: 1 }, { unique: true })
db.properties.createIndex({ communityId: 1, "address.line1": 1, "address.postalCode": 1 })
db.properties.createIndex({ communityId: 1, "duesSummary.delinquencyStatus": 1 })
db.properties.createIndex({ communityId: 1, "duesSummary.nextDueDate": 1 })
```

Security notes:

- Guest payment lookup may match address/account number, but response must not disclose owner name or balance.
- Account numbers should not be trivially sequential if used for guest payment lookup. Consider a public payment code separate from internal account number.

## 5.6 `propertyMemberships`

Links users to properties.

```ts
type PropertyMembership = {
  _id: ObjectId
  communityId: ObjectId
  propertyId: ObjectId
  userId: ObjectId
  relationshipType: "owner" | "co_owner" | "resident" | "renter" | "manager" | "family" | "other"
  status: "invited" | "active" | "suspended" | "removed"
  canViewBalance: boolean
  canPayDues: boolean
  canViewDocuments: boolean
  canInviteMembers: boolean
  invitedBy?: ObjectId
  invitedAt?: Date
  acceptedAt?: Date
  removedAt?: Date
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.propertyMemberships.createIndex({ communityId: 1, propertyId: 1, userId: 1 }, { unique: true })
db.propertyMemberships.createIndex({ communityId: 1, userId: 1, status: 1 })
db.propertyMemberships.createIndex({ communityId: 1, propertyId: 1, status: 1 })
```

## 5.7 `roles`

Community-scoped role definitions.

```ts
type Role = {
  _id: ObjectId
  communityId: ObjectId
  key: "resident" | "board_member" | "admin" | "vendor_applicant" | "approved_vendor" | "pool_worker" | "legal_reviewer" | string
  name: string
  description?: string
  permissions: string[]
  systemRole: boolean
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.roles.createIndex({ communityId: 1, key: 1 }, { unique: true })
```

## 5.8 `userRoles`

Assigns roles to users.

```ts
type UserRole = {
  _id: ObjectId
  communityId: ObjectId
  userId: ObjectId
  roleId: ObjectId
  scope: "community" | "property" | "vendor" | "amenity"
  scopeId?: ObjectId
  status: "active" | "suspended" | "removed"
  assignedBy?: ObjectId
  assignedAt: Date
  removedAt?: Date
}
```

Indexes:

```js
db.userRoles.createIndex({ communityId: 1, userId: 1, status: 1 })
db.userRoles.createIndex({ communityId: 1, roleId: 1, status: 1 })
db.userRoles.createIndex({ communityId: 1, userId: 1, roleId: 1, scope: 1, scopeId: 1 }, { unique: true })
```

## 5.9 `assessmentCycles`

Defines recurring dues/assessment cycles.

```ts
type AssessmentCycle = {
  _id: ObjectId
  communityId: ObjectId
  name: string
  type: "annual" | "quarterly" | "monthly" | "special"
  status: "draft" | "active" | "closed" | "archived"
  periodStart: Date
  periodEnd: Date
  dueDate: Date
  defaultAmountCents: number
  currency: "USD"
  lateFee?: {
    enabled: boolean
    amountCents?: number
    percentBasisPoints?: number
    graceDays?: number
  }
  interest?: {
    enabled: boolean
    annualRateBasisPoints?: number
  }
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.assessmentCycles.createIndex({ communityId: 1, status: 1, dueDate: 1 })
db.assessmentCycles.createIndex({ communityId: 1, type: 1, periodStart: -1 })
```

## 5.10 `assessments`

Property-level dues or assessment charges.

```ts
type Assessment = {
  _id: ObjectId
  communityId: ObjectId
  propertyId: ObjectId
  assessmentCycleId?: ObjectId
  type: "regular_dues" | "special_assessment" | "late_fee" | "interest" | "fine" | "damage_assessment" | "manual_adjustment"
  description: string
  amountCents: number
  paidCents: number
  balanceCents: number
  currency: "USD"
  dueDate: Date
  status: "draft" | "open" | "partially_paid" | "paid" | "overdue" | "waived" | "disputed" | "void"
  sourceWorkflow?: {
    collection: string
    id: ObjectId
  }
  createdAt: Date
  updatedAt: Date
  createdBy?: ObjectId
}
```

Indexes:

```js
db.assessments.createIndex({ communityId: 1, propertyId: 1, dueDate: -1 })
db.assessments.createIndex({ communityId: 1, status: 1, dueDate: 1 })
db.assessments.createIndex({ communityId: 1, assessmentCycleId: 1 })
```

## 5.11 `payments`

Records payment attempts and successful payments.

```ts
type Payment = {
  _id: ObjectId
  communityId: ObjectId
  propertyId: ObjectId
  payerType: "resident" | "guest" | "admin_recorded"
  userId?: ObjectId
  guestPayer?: {
    name?: string
    email?: string
    phone?: string
  }
  propertySnapshot: {
    accountNumber: string
    addressLine1: string
    postalCode: string
  }
  amountCents: number
  currency: "USD"
  feePolicy: "payer_pays" | "hoa_pays"
  processorFeeCents?: number
  netAmountCents?: number
  method: "card" | "ach" | "check" | "cash" | "manual" | "other"
  status: "created" | "pending" | "succeeded" | "failed" | "refunded" | "partially_refunded" | "void"
  stripe?: {
    checkoutSessionId?: string
    paymentIntentId?: string
    chargeId?: string
    customerId?: string
    receiptUrl?: string
  }
  appliedToAssessments: Array<{
    assessmentId: ObjectId
    amountCents: number
  }>
  receiptNumber?: string
  paidAt?: Date
  createdAt: Date
  updatedAt: Date
  createdBy?: ObjectId
}
```

Indexes:

```js
db.payments.createIndex({ communityId: 1, propertyId: 1, createdAt: -1 })
db.payments.createIndex({ communityId: 1, userId: 1, createdAt: -1 })
db.payments.createIndex({ communityId: 1, status: 1, createdAt: -1 })
db.payments.createIndex({ "stripe.checkoutSessionId": 1 }, { unique: true, sparse: true })
db.payments.createIndex({ "stripe.paymentIntentId": 1 }, { unique: true, sparse: true })
db.payments.createIndex({ receiptNumber: 1 }, { unique: true, sparse: true })
```

Security notes:

- Do not store full card numbers, bank account numbers, or raw payment credentials.
- Store only Stripe IDs, status, amount, and receipt references.
- Payment updates should only occur through trusted server code and verified Stripe webhooks.

## 5.12 `paymentEvents`

Stores Stripe webhook and payment lifecycle events.

```ts
type PaymentEvent = {
  _id: ObjectId
  communityId: ObjectId
  paymentId?: ObjectId
  provider: "stripe"
  providerEventId: string
  eventType: string
  receivedAt: Date
  processedAt?: Date
  processingStatus: "received" | "processed" | "failed" | "ignored"
  error?: string
  payloadHash?: string
}
```

Indexes:

```js
db.paymentEvents.createIndex({ provider: 1, providerEventId: 1 }, { unique: true })
db.paymentEvents.createIndex({ communityId: 1, receivedAt: -1 })
db.paymentEvents.createIndex({ processingStatus: 1, receivedAt: -1 })
```

Security notes:

- Verify Stripe webhook signatures before writing payment state.
- Store raw payload only if needed and safe; otherwise store payload hash and extracted metadata.
- Make processing idempotent using `providerEventId`.

## 5.13 `documents`

Document metadata; binary files live in object storage.

```ts
type Document = {
  _id: ObjectId
  communityId: ObjectId
  title: string
  description?: string
  category: "governing_docs" | "bylaws" | "meeting_minutes" | "financial_notice" | "dues_notice" | "property_notice" | "architectural" | "violation" | "vendor_contract" | "pool_record" | "form" | "other"
  visibility: "public" | "resident" | "board" | "vendor" | "property_specific" | "admin"
  related: {
    propertyId?: ObjectId
    vendorId?: ObjectId
    meetingId?: ObjectId
    complianceTaskId?: ObjectId
    assessmentId?: ObjectId
  }
  storage: {
    provider: "supabase_storage" | "cloudflare_r2" | "s3" | "local_dev"
    bucket: string
    objectKey: string
    contentType: string
    sizeBytes: number
    checksum?: string
  }
  effectiveDate?: Date
  expirationDate?: Date
  status: "active" | "archived" | "deleted"
  uploadedBy: ObjectId
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
  deletedBy?: ObjectId
}
```

Indexes:

```js
db.documents.createIndex({ communityId: 1, visibility: 1, category: 1, createdAt: -1 })
db.documents.createIndex({ communityId: 1, "related.propertyId": 1, createdAt: -1 })
db.documents.createIndex({ communityId: 1, "related.meetingId": 1 })
db.documents.createIndex({ communityId: 1, expirationDate: 1 }, { sparse: true })
db.documents.createIndex({ communityId: 1, title: "text", description: "text" })
```

Security notes:

- Object storage must be private by default.
- Public documents can be served publicly only after checking visibility.
- Private documents should use short-lived signed URLs or server streaming.
- Document visibility changes must be audited.

## 5.14 `documentAccessLogs`

```ts
type DocumentAccessLog = {
  _id: ObjectId
  communityId: ObjectId
  documentId: ObjectId
  userId?: ObjectId
  accessType: "view" | "download" | "signed_url_created"
  result: "allowed" | "denied"
  reason?: string
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}
```

Indexes:

```js
db.documentAccessLogs.createIndex({ communityId: 1, documentId: 1, createdAt: -1 })
db.documentAccessLogs.createIndex({ communityId: 1, userId: 1, createdAt: -1 })
db.documentAccessLogs.createIndex({ createdAt: 1 })
```

## 5.15 `announcements`

```ts
type Announcement = {
  _id: ObjectId
  communityId: ObjectId
  title: string
  body: string
  visibility: "public" | "resident" | "board" | "property_specific"
  propertyIds?: ObjectId[]
  status: "draft" | "published" | "expired" | "archived"
  pinned: boolean
  publishAt: Date
  expiresAt?: Date
  attachments: ObjectId[]
  createdBy: ObjectId
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.announcements.createIndex({ communityId: 1, status: 1, visibility: 1, publishAt: -1 })
db.announcements.createIndex({ communityId: 1, pinned: 1, publishAt: -1 })
db.announcements.createIndex({ communityId: 1, propertyIds: 1 }, { sparse: true })
```

## 5.16 `events`

```ts
type Event = {
  _id: ObjectId
  communityId: ObjectId
  title: string
  description?: string
  type: "hoa_meeting" | "board_meeting" | "community_event" | "pool" | "maintenance_window" | "dues_deadline" | "other"
  visibility: "public" | "resident" | "board" | "admin"
  startsAt: Date
  endsAt?: Date
  allDay: boolean
  location?: string
  relatedMeetingId?: ObjectId
  relatedComplianceEventId?: ObjectId
  status: "scheduled" | "cancelled" | "completed" | "archived"
  createdBy: ObjectId
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.events.createIndex({ communityId: 1, visibility: 1, startsAt: 1 })
db.events.createIndex({ communityId: 1, type: 1, startsAt: 1 })
db.events.createIndex({ communityId: 1, status: 1, startsAt: 1 })
```

## 5.17 `messageThreads`

```ts
type MessageThread = {
  _id: ObjectId
  communityId: ObjectId
  propertyId: ObjectId
  subject: string
  category: "dues" | "documents" | "maintenance" | "architectural" | "complaint" | "general"
  status: "open" | "pending_board" | "pending_resident" | "closed" | "archived"
  createdBy: ObjectId
  assignedTo?: ObjectId
  lastMessageAt: Date
  closedAt?: Date
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.messageThreads.createIndex({ communityId: 1, propertyId: 1, lastMessageAt: -1 })
db.messageThreads.createIndex({ communityId: 1, status: 1, lastMessageAt: -1 })
db.messageThreads.createIndex({ communityId: 1, assignedTo: 1, status: 1 })
```

## 5.18 `messages`

```ts
type Message = {
  _id: ObjectId
  communityId: ObjectId
  threadId: ObjectId
  propertyId: ObjectId
  senderId: ObjectId
  senderRole: "resident" | "board_member" | "admin"
  body: string
  attachments: ObjectId[]
  visibility: "thread_participants" | "board_admin_only"
  createdAt: Date
  editedAt?: Date
  deletedAt?: Date
}
```

Indexes:

```js
db.messages.createIndex({ communityId: 1, threadId: 1, createdAt: 1 })
db.messages.createIndex({ communityId: 1, propertyId: 1, createdAt: -1 })
```

## 5.19 `complianceCalendarEvents`

Calendar-level compliance event.

```ts
type ComplianceCalendarEvent = {
  _id: ObjectId
  communityId: ObjectId
  type: "annual_meeting" | "board_meeting" | "financial_statement" | "records_request" | "assessment_due" | "delinquency_review" | "lien_review" | "fine_hearing" | "audit_review" | "custom"
  title: string
  description?: string
  related: {
    propertyId?: ObjectId
    meetingId?: ObjectId
    recordsRequestId?: ObjectId
    assessmentId?: ObjectId
    lienCaseId?: ObjectId
    fineCaseId?: ObjectId
  }
  dueAt: Date
  startsAt?: Date
  status: "upcoming" | "in_progress" | "ready_for_review" | "completed" | "blocked" | "deferred" | "overdue" | "legal_review_required"
  priority: "low" | "normal" | "high" | "critical"
  legalSensitive: boolean
  assignedTo: ObjectId[]
  completedAt?: Date
  completedBy?: ObjectId
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.complianceCalendarEvents.createIndex({ communityId: 1, dueAt: 1, status: 1 })
db.complianceCalendarEvents.createIndex({ communityId: 1, type: 1, dueAt: 1 })
db.complianceCalendarEvents.createIndex({ communityId: 1, assignedTo: 1, status: 1 })
db.complianceCalendarEvents.createIndex({ communityId: 1, legalSensitive: 1, status: 1 })
```

## 5.20 `complianceTasks`

Checklist/task items under a compliance event.

```ts
type ComplianceTask = {
  _id: ObjectId
  communityId: ObjectId
  complianceEventId: ObjectId
  title: string
  description?: string
  type: "notice" | "document_upload" | "review" | "mailing" | "hearing" | "approval" | "deadline" | "custom"
  status: "todo" | "in_progress" | "done" | "blocked" | "deferred"
  dueAt?: Date
  assignedTo?: ObjectId
  evidence: Array<{
    documentId?: ObjectId
    note?: string
    uploadedBy?: ObjectId
    createdAt: Date
  }>
  completedAt?: Date
  completedBy?: ObjectId
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.complianceTasks.createIndex({ communityId: 1, complianceEventId: 1, status: 1 })
db.complianceTasks.createIndex({ communityId: 1, assignedTo: 1, dueAt: 1 })
db.complianceTasks.createIndex({ communityId: 1, status: 1, dueAt: 1 })
```

## 5.21 `recordsRequests`

```ts
type RecordsRequest = {
  _id: ObjectId
  communityId: ObjectId
  propertyId?: ObjectId
  requesterUserId?: ObjectId
  requester: {
    name: string
    email?: string
    phone?: string
    authorizedAgent: boolean
  }
  requestType: "general_records" | "unpaid_assessment_statement"
  requestedRecords: string
  receivedAt: Date
  dueAt: Date
  status: "received" | "in_progress" | "fulfilled" | "denied" | "partially_fulfilled" | "overdue"
  assignedTo?: ObjectId
  response: {
    notes?: string
    documentIds: ObjectId[]
    respondedAt?: Date
    respondedBy?: ObjectId
  }
  fees?: {
    amountCents: number
    reason: string
    paid: boolean
  }
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.recordsRequests.createIndex({ communityId: 1, status: 1, dueAt: 1 })
db.recordsRequests.createIndex({ communityId: 1, propertyId: 1, receivedAt: -1 })
db.recordsRequests.createIndex({ communityId: 1, requestType: 1, dueAt: 1 })
```

## 5.22 `meetings`

```ts
type Meeting = {
  _id: ObjectId
  communityId: ObjectId
  type: "annual_association" | "special_association" | "board" | "committee"
  title: string
  status: "draft" | "scheduled" | "notice_sent" | "completed" | "minutes_approved" | "cancelled"
  startsAt: Date
  endsAt?: Date
  location?: string
  agenda: Array<{
    title: string
    description?: string
    specialFlag?: "declaration_amendment" | "bylaw_amendment" | "budget_change" | "director_removal" | "officer_removal"
  }>
  notice: {
    required: boolean
    earliestSendAt?: Date
    latestSendAt?: Date
    sentAt?: Date
    sentBy?: ObjectId
    method?: "mail" | "hand_delivery" | "email" | "mixed"
    recipientCount?: number
    documentId?: ObjectId
  }
  ownerCommentOpportunity: boolean
  minutes: {
    draftDocumentId?: ObjectId
    approvedDocumentId?: ObjectId
    approvedAt?: Date
    approvedBy?: ObjectId
  }
  createdBy: ObjectId
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.meetings.createIndex({ communityId: 1, type: 1, startsAt: -1 })
db.meetings.createIndex({ communityId: 1, status: 1, startsAt: 1 })
db.meetings.createIndex({ communityId: 1, "notice.latestSendAt": 1 }, { sparse: true })
```

## 5.23 `annualFinancialStatements`

```ts
type AnnualFinancialStatement = {
  _id: ObjectId
  communityId: ObjectId
  fiscalYearLabel: string
  fiscalYearStart: Date
  fiscalYearEnd: Date
  dueAt: Date
  status: "not_started" | "in_progress" | "board_review" | "available_to_residents" | "overdue" | "archived"
  incomeExpenseDocumentId?: ObjectId
  balanceSheetDocumentId?: ObjectId
  supportingDocumentIds: ObjectId[]
  madeAvailableAt?: Date
  reviewedBy?: ObjectId[]
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.annualFinancialStatements.createIndex({ communityId: 1, fiscalYearLabel: 1 }, { unique: true })
db.annualFinancialStatements.createIndex({ communityId: 1, status: 1, dueAt: 1 })
```

## 5.24 `auditLogs`

Append-only sensitive action log.

```ts
type AuditLog = {
  _id: ObjectId
  communityId?: ObjectId
  actorUserId?: ObjectId
  actorType: "user" | "system" | "webhook" | "job"
  action: string
  target: {
    collection: string
    id?: ObjectId
  }
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  metadata?: {
    ipAddress?: string
    userAgent?: string
    requestId?: string
    reason?: string
  }
  createdAt: Date
}
```

Indexes:

```js
db.auditLogs.createIndex({ communityId: 1, createdAt: -1 })
db.auditLogs.createIndex({ communityId: 1, actorUserId: 1, createdAt: -1 })
db.auditLogs.createIndex({ "target.collection": 1, "target.id": 1, createdAt: -1 })
db.auditLogs.createIndex({ action: 1, createdAt: -1 })
```

Security notes:

- Do not expose audit log deletion in the app.
- Restrict audit log viewing to board/admin/legal reviewer permissions.
- Consider write-only application path and database-level protections.

## 5.25 `emailLogs`

```ts
type EmailLog = {
  _id: ObjectId
  communityId?: ObjectId
  type: "payment_receipt" | "guest_payment_receipt" | "compliance_warning" | "records_request" | "meeting_notice" | "invitation" | "message_notification" | "other"
  recipient: {
    email: string
    userId?: ObjectId
  }
  subject: string
  provider: "resend" | "other"
  providerMessageId?: string
  status: "queued" | "sent" | "delivered" | "bounced" | "failed" | "suppressed"
  related: {
    propertyId?: ObjectId
    paymentId?: ObjectId
    complianceEventId?: ObjectId
    recordsRequestId?: ObjectId
    meetingId?: ObjectId
  }
  error?: string
  sentAt?: Date
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.emailLogs.createIndex({ communityId: 1, type: 1, createdAt: -1 })
db.emailLogs.createIndex({ "recipient.email": 1, createdAt: -1 })
db.emailLogs.createIndex({ status: 1, createdAt: -1 })
db.emailLogs.createIndex({ "related.complianceEventId": 1 }, { sparse: true })
```

## 5.26 `appSettings`

Global application settings.

```ts
type AppSetting = {
  _id: ObjectId
  key: string
  value: unknown
  environment: "development" | "staging" | "production"
  updatedAt: Date
  updatedBy?: ObjectId
}
```

Indexes:

```js
db.appSettings.createIndex({ environment: 1, key: 1 }, { unique: true })
```

## 6. Later-Phase Collection Schemas

## 6.1 `vendors`

```ts
type Vendor = {
  _id: ObjectId
  communityId: ObjectId
  name: string
  status: "applicant" | "approved" | "inactive" | "blocked"
  contact: {
    name?: string
    email?: string
    phone?: string
  }
  categories: string[]
  insurance: {
    documentId?: ObjectId
    expiresAt?: Date
  }
  approvedAt?: Date
  approvedBy?: ObjectId
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.vendors.createIndex({ communityId: 1, status: 1, name: 1 })
db.vendors.createIndex({ communityId: 1, categories: 1 })
db.vendors.createIndex({ communityId: 1, "insurance.expiresAt": 1 }, { sparse: true })
```

## 6.2 `vendorProposals`

```ts
type VendorProposal = {
  _id: ObjectId
  communityId: ObjectId
  vendorId?: ObjectId
  publicSubmission: {
    vendorName: string
    contactName?: string
    email: string
    phone?: string
  }
  category: string
  description: string
  proposedAmountCents?: number
  attachments: ObjectId[]
  status: "submitted" | "under_review" | "accepted" | "rejected" | "archived"
  reviewedBy?: ObjectId
  reviewedAt?: Date
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.vendorProposals.createIndex({ communityId: 1, status: 1, createdAt: -1 })
db.vendorProposals.createIndex({ communityId: 1, category: 1, createdAt: -1 })
```

## 6.3 `vendorInvoices`

```ts
type VendorInvoice = {
  _id: ObjectId
  communityId: ObjectId
  vendorId: ObjectId
  invoiceNumber: string
  amountCents: number
  currency: "USD"
  dueDate?: Date
  category: string
  attachments: ObjectId[]
  status: "submitted" | "under_review" | "approved" | "rejected" | "paid" | "void"
  approval: {
    approvedBy?: ObjectId
    approvedAt?: Date
    notes?: string
  }
  paymentRecordId?: ObjectId
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.vendorInvoices.createIndex({ communityId: 1, vendorId: 1, invoiceNumber: 1 }, { unique: true })
db.vendorInvoices.createIndex({ communityId: 1, status: 1, dueDate: 1 })
```

## 6.4 `maintenanceRequests`

```ts
type MaintenanceRequest = {
  _id: ObjectId
  communityId: ObjectId
  propertyId?: ObjectId
  submittedBy: ObjectId
  areaType: "property" | "common_area"
  category: string
  description: string
  photos: ObjectId[]
  status: "submitted" | "under_review" | "assigned" | "in_progress" | "resolved" | "closed" | "rejected"
  assignedTo?: ObjectId
  resolutionNotes?: string
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.maintenanceRequests.createIndex({ communityId: 1, status: 1, createdAt: -1 })
db.maintenanceRequests.createIndex({ communityId: 1, propertyId: 1, createdAt: -1 })
```

## 6.5 `architecturalRequests`

```ts
type ArchitecturalRequest = {
  _id: ObjectId
  communityId: ObjectId
  propertyId: ObjectId
  submittedBy: ObjectId
  requestType: string
  description: string
  attachments: ObjectId[]
  status: "submitted" | "under_review" | "needs_info" | "approved" | "denied" | "withdrawn"
  decision: {
    decidedBy?: ObjectId
    decidedAt?: Date
    notes?: string
    decisionDocumentId?: ObjectId
  }
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.architecturalRequests.createIndex({ communityId: 1, propertyId: 1, createdAt: -1 })
db.architecturalRequests.createIndex({ communityId: 1, status: 1, createdAt: -1 })
```

## 6.6 `amenities`

```ts
type Amenity = {
  _id: ObjectId
  communityId: ObjectId
  name: string
  type: "pool" | "clubhouse" | "playground" | "other"
  status: "open" | "closed" | "maintenance" | "seasonal_closed"
  settings: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.amenities.createIndex({ communityId: 1, type: 1, status: 1 })
```

## 6.7 `poolMaintenanceLogs`

```ts
type PoolMaintenanceLog = {
  _id: ObjectId
  communityId: ObjectId
  amenityId: ObjectId
  workerUserId: ObjectId
  workerNameSnapshot: string
  performedAt: Date
  readings: {
    freeChlorine?: number
    ph?: number
    totalAlkalinity?: number
    cyanuricAcid?: number
    calciumHardness?: number
    waterTemperature?: number
    waterClarity?: "clear" | "cloudy" | "unsafe" | "unknown"
  }
  checklist: Array<{
    key: string
    label: string
    completed: boolean
    notes?: string
  }>
  proofPhotoIds: ObjectId[]
  conditionPhotoIds: ObjectId[]
  status: "submitted" | "reviewed" | "flagged" | "corrective_action_required"
  reviewedBy?: ObjectId
  reviewedAt?: Date
  notes?: string
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.poolMaintenanceLogs.createIndex({ communityId: 1, amenityId: 1, performedAt: -1 })
db.poolMaintenanceLogs.createIndex({ communityId: 1, workerUserId: 1, performedAt: -1 })
db.poolMaintenanceLogs.createIndex({ communityId: 1, status: 1, performedAt: -1 })
```

## 6.8 `fineCases`

```ts
type FineCase = {
  _id: ObjectId
  communityId: ObjectId
  propertyId: ObjectId
  status: "draft" | "notice_sent" | "hearing_scheduled" | "decision_recorded" | "appeal_window" | "appealed" | "closed" | "legal_review_required"
  chargeDescription: string
  noticeSentAt?: Date
  hearingAt?: Date
  evidenceDocumentIds: ObjectId[]
  decision?: {
    decidedAt: Date
    decidedBy: ObjectId
    result: "fine" | "suspension" | "dismissed" | "other"
    fineAmountCents?: number
    notes?: string
  }
  appealDeadlineAt?: Date
  appealReceivedAt?: Date
  legalReview: {
    required: boolean
    reviewedBy?: ObjectId
    reviewedAt?: Date
    notes?: string
  }
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.fineCases.createIndex({ communityId: 1, propertyId: 1, createdAt: -1 })
db.fineCases.createIndex({ communityId: 1, status: 1, appealDeadlineAt: 1 })
```

## 6.9 `lienCases`

```ts
type LienCase = {
  _id: ObjectId
  communityId: ObjectId
  propertyId: ObjectId
  status: "draft" | "address_verification" | "pre_lien_notice_sent" | "ready_for_legal_review" | "filed_externally" | "released" | "enforcement_started" | "expired" | "blocked"
  relatedAssessmentIds: ObjectId[]
  balanceAtStartCents: number
  addressVerification: {
    lotPhysicalAddressChecked: boolean
    ownerAddressOfRecordChecked: boolean
    countyTaxAddressChecked: boolean
    registeredAgentAddressChecked?: boolean
    completedAt?: Date
    completedBy?: ObjectId
  }
  preLienNotice: {
    mailedAt?: Date
    documentId?: ObjectId
    recipientSnapshot?: Array<{
      name?: string
      address: string
      type: "lot" | "owner_record" | "county_tax" | "registered_agent"
    }>
  }
  legalReview: {
    required: true
    reviewedBy?: ObjectId
    reviewedAt?: Date
    decision?: "approved_to_file" | "do_not_file" | "needs_more_info"
    notes?: string
  }
  filing?: {
    filedAt?: Date
    county?: string
    documentId?: ObjectId
    enforcementDeadlineAt?: Date
  }
  createdAt: Date
  updatedAt: Date
}
```

Indexes:

```js
db.lienCases.createIndex({ communityId: 1, propertyId: 1, createdAt: -1 })
db.lienCases.createIndex({ communityId: 1, status: 1, createdAt: -1 })
db.lienCases.createIndex({ communityId: 1, "filing.enforcementDeadlineAt": 1 }, { sparse: true })
```

## 7. Relationships

### 7.1 Core Relationships

- `communities._id` -> all community-scoped collections via `communityId`.
- `users._id` -> `propertyMemberships.userId`.
- `properties._id` -> `propertyMemberships.propertyId`.
- `users._id` -> `userRoles.userId`.
- `roles._id` -> `userRoles.roleId`.
- `properties._id` -> `assessments.propertyId`.
- `properties._id` -> `payments.propertyId`.
- `assessments._id` -> `payments.appliedToAssessments.assessmentId`.
- `properties._id` -> `documents.related.propertyId`.
- `properties._id` -> `messageThreads.propertyId`.
- `messageThreads._id` -> `messages.threadId`.
- `complianceCalendarEvents._id` -> `complianceTasks.complianceEventId`.

### 7.2 Compliance Relationships

- `meetings._id` -> `events.relatedMeetingId`.
- `meetings._id` -> `documents.related.meetingId`.
- `recordsRequests._id` -> `complianceCalendarEvents.related.recordsRequestId`.
- `assessments._id` -> `complianceCalendarEvents.related.assessmentId`.
- `lienCases._id` -> `complianceCalendarEvents.related.lienCaseId`.
- `fineCases._id` -> `complianceCalendarEvents.related.fineCaseId`.
- `annualFinancialStatements` documents link to `documents` through document IDs.

### 7.3 Later-Phase Relationships

- `vendors._id` -> `vendorProposals.vendorId`.
- `vendors._id` -> `vendorInvoices.vendorId`.
- `amenities._id` -> `poolMaintenanceLogs.amenityId`.
- `users._id` -> `poolMaintenanceLogs.workerUserId`.
- `properties._id` -> `architecturalRequests.propertyId`.
- `properties._id` -> `maintenanceRequests.propertyId`.

## 8. Indexing Strategy

### 8.1 Tenant-Scoped Compound Indexes

Most application queries must filter by `communityId`. Use compound indexes with `communityId` first.

Examples:

```js
{ communityId: 1, status: 1, createdAt: -1 }
{ communityId: 1, propertyId: 1, createdAt: -1 }
{ communityId: 1, userId: 1, status: 1 }
```

### 8.2 Unique Indexes

Use unique indexes for tenant-scoped identifiers:

```js
db.properties.createIndex({ communityId: 1, accountNumber: 1 }, { unique: true })
db.roles.createIndex({ communityId: 1, key: 1 }, { unique: true })
db.annualFinancialStatements.createIndex({ communityId: 1, fiscalYearLabel: 1 }, { unique: true })
```

Use global unique indexes for auth identifiers:

```js
db.users.createIndex({ emailLower: 1 }, { unique: true })
```

### 8.3 Sparse Indexes

Use sparse indexes for optional external identifiers:

```js
db.payments.createIndex({ "stripe.checkoutSessionId": 1 }, { unique: true, sparse: true })
db.payments.createIndex({ "stripe.paymentIntentId": 1 }, { unique: true, sparse: true })
```

### 8.4 TTL Indexes

Use TTL indexes for temporary auth records:

```js
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
db.passwordResetTokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
```

Do not use TTL for audit logs, payment records, compliance evidence, or documents unless a retention policy has been formally approved.

### 8.5 Text Search

Use MongoDB text indexes for basic document and announcement search:

```js
db.documents.createIndex({ title: "text", description: "text" })
db.announcements.createIndex({ title: "text", body: "text" })
```

For advanced search later, consider Atlas Search.

### 8.6 High-Value Query Patterns

Resident dashboard:

- `propertyMemberships` by `communityId + userId + status`.
- `properties` by linked property IDs.
- `assessments` by `communityId + propertyId + status`.
- `announcements` by `communityId + visibility + status + publishAt`.
- `events` by `communityId + visibility + startsAt`.

Board compliance dashboard:

- `complianceCalendarEvents` by `communityId + status + dueAt`.
- `recordsRequests` by `communityId + status + dueAt`.
- `meetings` by `communityId + status + startsAt`.
- `annualFinancialStatements` by `communityId + status + dueAt`.

Payments:

- `payments` by `communityId + propertyId + createdAt`.
- `paymentEvents` by provider event ID.

Documents:

- `documents` by `communityId + visibility + category + createdAt`.
- `documents` by `communityId + related.propertyId + createdAt`.

## 9. Security Considerations

## 9.1 Password Hashing

If using local passwords:

- Use Argon2id as the preferred password hashing algorithm.
- Store only `passwordHash`, never plaintext passwords.
- Store `passwordHashAlgorithm` and `passwordUpdatedAt` to support future upgrades.
- Use strong, unique salts generated by the password hashing library.
- Enforce minimum password length and breached-password checks where feasible.
- Rate limit login attempts.
- Add MFA support for admins and board users if possible.

If using bcrypt:

- Use a strong cost factor appropriate for production hardware.
- Rehash on login when cost factor policy changes.

## 9.2 Session Security

- Store session tokens hashed if stored in MongoDB.
- Use secure, HTTP-only cookies.
- Use `SameSite=Lax` or stricter where compatible.
- Rotate sessions after password reset.
- Revoke sessions on suspicious activity or user suspension.
- Use TTL indexes for session expiration.

## 9.3 Authorization

Every private operation must check:

- Authenticated user.
- Community scope.
- Role permissions.
- Property membership when accessing property-specific data.
- Document visibility when accessing files.

Do not trust client-side role flags.

## 9.4 Guest Payment Privacy

Guest payment lookup must not reveal:

- Owner name.
- Current balance.
- Payment history.
- Private property data.
- Documents.
- Resident contact information.

Guest payer receives:

- Confirmation that payment was submitted.
- Receipt for their own transaction.

## 9.5 Payment Security

- Use Stripe-hosted or Stripe-controlled payment UI.
- Never store full card, CVV, or bank account numbers.
- Verify Stripe webhook signatures.
- Make webhook processing idempotent.
- Store Stripe IDs and receipt references only.
- Audit manual payment adjustments and refunds.

## 9.6 Document Security

- Store files in private buckets.
- Serve private files only after server-side authorization checks.
- Use short-lived signed URLs.
- Audit sensitive document access and visibility changes.
- Prevent public search engines from indexing private documents.

## 9.7 Audit Log Integrity

- Audit logs should be append-only through normal application paths.
- Restrict audit log reads to authorized board/admin/legal reviewer roles.
- Consider database-level roles that prevent app users from deleting audit records.
- Consider periodic export/backups for audit logs.

## 9.8 Sensitive Workflow Controls

Legal-sensitive workflows require review gates:

- Fines.
- Suspension of privileges.
- Lien preparation.
- Foreclosure-related tracking.
- Attorney-fee collection.
- Owner records requests.

The system should warn, document, and route for review. It should not automatically file legal documents or take legal action.

## 9.9 Personally Identifiable Information

PII includes:

- Names.
- Emails.
- Phone numbers.
- Property addresses.
- Payment metadata.
- Messages.
- Property-specific notices.

Controls:

- Least-privilege access.
- Audit access to sensitive records.
- Avoid including sensitive details in email bodies unless required.
- Use encrypted connections.
- Use encrypted storage at rest through the database/storage provider.

## 9.10 Backups and Retention

- Enable MongoDB backups.
- Test restore procedures.
- Do not delete financial, audit, or compliance records without approved retention policy.
- Soft-delete business records where retention matters.
- Store `deletedAt` and `deletedBy`.

## 10. Data Validation Strategy

Recommended validation layers:

- TypeScript types for developer clarity.
- Runtime schema validation with Zod or equivalent.
- MongoDB collection validators for critical fields.
- Server-side authorization and invariants.

Critical invariants:

- `communityId` required for all community data.
- `propertyId` required for property financial records.
- Payment amounts stored in cents.
- Guest payment responses do not include balance or owner identity.
- Legal-sensitive workflow completion requires review metadata.
- Document access checks run before signed URL creation.

## 11. Migration and Versioning Strategy

- Track schema version in migration files or application metadata.
- Use additive migrations where possible.
- Backfill required fields before enforcing validators.
- Version legal/compliance rule settings by community.
- Keep `data-model-v1.md` as the MongoDB v1 baseline.
- If a new version is needed, create `data-model-v2.md` rather than mutating historical design after implementation begins.

## 12. Open Design Questions

- Is MongoDB the final database choice, replacing the current Supabase Postgres architecture recommendation?
- Will authentication be custom local auth, Auth.js with Mongo adapter, Clerk/Auth0, or another provider?
- Should residents authenticate with passwords, magic links, or both?
- Should guest payment use account number, address, or a separate public payment code?
- Should all audit logs remain in MongoDB, or should high-volume logs move to cold storage later?
- Should document access logs be recorded for every download or only sensitive/private categories?
- Which board roles can view audit logs?
- Which records must be retained permanently under HOA policy and North Carolina requirements?
