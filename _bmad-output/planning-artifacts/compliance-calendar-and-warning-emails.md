---
title: "Compliance Calendar and Warning Emails"
status: "draft"
created: "2026-04-30T20:18:50-0400"
updated: "2026-04-30T20:18:50-0400"
inputs:
  - "_bmad-output/planning-artifacts/product-brief-SpringMeadowCommunity.md"
  - "_bmad-output/planning-artifacts/research/domain-hoa-community-website-research-2026-04-30.md"
jurisdiction: "North Carolina"
legal_note: "Product planning artifact only; not legal advice."
---

# Compliance Calendar and Warning Emails

## Purpose

Spring Meadow Community should include a board-facing compliance calendar that helps HOA board members follow required North Carolina HOA workflows, preserve records, and avoid missed deadlines. The system should create calendar events, task checklists, and warning emails for meetings, financial reporting, records requests, audits/reviews, fines, assessment collection, and lien-preparation workflows.

The feature should not give legal advice or automatically perform legal actions. It should guide the board through required steps, collect evidence, and require a legal or board-review gate before sensitive actions such as fines, privilege suspension, liens, foreclosure, or attorney-fee collection.

## Core Calendar Types

### 1. Annual Association Meeting

North Carolina G.S. 47F-3-108 requires an association meeting at least once each year. Notice for association meetings must be sent not less than 10 and not more than 60 days before the meeting.

Calendar requirements:

- Create one required annual meeting event per fiscal/calendar year.
- Track meeting date, time, place, agenda, notice method, and notice recipients.
- Show legal notice window:
  - Earliest allowed notice date: meeting date minus 60 days.
  - Latest allowed notice date: meeting date minus 10 days.
- Warn if the board tries to send notice too early or too late.
- Require agenda items before notice is marked ready.
- Flag agenda items involving declaration/bylaw amendments, budget changes, or director/officer removal.
- Store meeting notice content and sent timestamp.
- Store draft notes, approved minutes, attendance, motions, votes, and attachments.

Warning emails:

- 90 days before planned meeting: "Annual meeting needs scheduling."
- 65 days before meeting: "Meeting notice window opens soon."
- 60 days before meeting: "Meeting notice window is open."
- 30 days before meeting: "Confirm agenda and notice status."
- 15 days before meeting: "Final notice deadline approaching."
- 10 days before meeting: "Last day to meet minimum statutory notice."
- 1 day after meeting: "Upload meeting notes/minutes."
- 30 days after meeting: "Approve/publish minutes if applicable."

### 2. Executive Board Meetings and Owner Comment Opportunity

North Carolina G.S. 47F-3-108 says executive board meetings are held as provided in the bylaws and, at regular intervals, must provide lot owners an opportunity to attend a portion of a meeting and speak.

Calendar requirements:

- Allow recurring board meetings.
- Track whether a meeting includes owner comment opportunity.
- Warn if no owner-comment opportunity has been scheduled within the configured interval.
- Store agenda, notes, votes, and attachments.
- Separate board-only notes from owner-visible meeting records.

Warning emails:

- Configurable reminder before each board meeting, such as 7 days and 1 day.
- Monthly/quarterly warning if owner-comment opportunity is overdue.
- Post-meeting reminder to upload notes and action items.

### 3. Annual Financial Statement and Balance Sheet

North Carolina G.S. 47F-3-118 requires an annual income and expense statement and balance sheet to be made available to all lot owners at no charge within 75 days after fiscal year close.

Calendar requirements:

- Admin configures fiscal year end date.
- System automatically creates the financial statement deadline: fiscal year close plus 75 days.
- Track preparation status, board review, upload, and resident availability.
- Require document visibility to be resident-accessible before the deadline is marked complete.
- Store statement, balance sheet, supporting attachments, and approval notes.

Warning emails:

- Fiscal year close: "Annual financial statement cycle begins."
- 30 days after fiscal year close: "Financial statement due in 45 days."
- 45 days after fiscal year close: "Financial statement due in 30 days."
- 60 days after fiscal year close: "Financial statement due in 15 days."
- 70 days after fiscal year close: "Financial statement due in 5 days."
- 75 days after fiscal year close: "Financial statement due today."
- 76 days after fiscal year close: "Financial statement is overdue."

### 4. Audit, Review, or Compilation Workflow

North Carolina G.S. 47F-3-118 allows a more extensive compilation, review, or audit of books and records to be required by majority vote of the executive board or by lot owners present and voting at a properly called annual or special meeting.

Calendar requirements:

- Board can create optional audit/review/compilation events.
- Track who voted to require it.
- Track provider, scope, requested documents, deadline, status, and final report.
- Link final report to document library with appropriate visibility.
- Remind board to review insurance and fidelity/crime coverage during annual audit cycle.

Warning emails:

- Annual optional reminder: "Consider whether board wants CPA review/audit."
- On vote approval: "Audit/review workflow started."
- Configurable reminders before provider due date.
- Overdue warning if report is not uploaded by target date.

### 5. Records Request Workflow

North Carolina G.S. 47F-3-118 requires records to be reasonably available. It also requires a statement of unpaid assessments and other charges against a lot to be furnished within 10 business days after request.

Calendar requirements:

- Track owner/authorized-agent records requests.
- Track request date, requester, property, requested documents, assigned board/admin user, due date, response, and attachments.
- Special request type: unpaid assessment statement.
- Unpaid assessment statement due date should be 10 business days after receipt.
- Track fees charged, if any, within statutory limits.

Warning emails:

- New request submitted: notify assigned board/admin users.
- 3 business days before due date: "Records request due soon."
- 1 business day before due date: "Records request due tomorrow."
- Due date: "Records request due today."
- Overdue: daily warning until resolved.

### 6. Assessment and Dues Calendar

North Carolina G.S. 47F-3-115 says assessments must be made at least annually after an assessment has been made. The product should track recurring assessment cycles and dues deadlines.

Calendar requirements:

- Configure assessment schedule: annual, quarterly, monthly, special assessment.
- Create dues due dates for each property.
- Track paid, partially paid, overdue, waived, adjusted, or disputed status.
- Track late fees/interest only according to configured legal and governing-document settings.
- Generate delinquency reports.

Warning emails:

- Resident due reminders: configurable, such as 30 days, 14 days, 7 days, and 1 day before due date.
- Resident overdue notices: configurable, such as 1 day, 15 days, and 30 days overdue.
- Board delinquency report: weekly during collection periods.

### 7. Lien Preparation Workflow

North Carolina G.S. 47F-3-116 provides lien procedures for sums due to the association. An unpaid assessment attributable to a lot for 30 days or longer constitutes a lien when a claim of lien is filed. Before filing, the association must make reasonable and diligent efforts to ensure records contain the lot owner's current mailing address. No fewer than 15 days before filing, the association must mail a statement of the assessment amount due by first-class mail to required addresses. A lien for unpaid assessments is extinguished unless enforcement proceedings are instituted within three years after filing.

Calendar requirements:

- Create lien-readiness task only after assessment remains unpaid for at least 30 days.
- Require address verification checklist before pre-lien notice.
- Track required mailing addresses:
  - Physical address of the lot.
  - Owner address of record with association.
  - County tax records address, if different.
  - Registered agent address if owner is corporation or LLC.
- Track 15-day pre-lien statement mailing date.
- Prevent "ready for legal review" status until at least 15 days after pre-lien statement mailing.
- Track lien filing date if filed externally.
- Create three-year enforcement deadline reminder from filing date.
- Require legal-review gate before any filing/foreclosure-related action.

Warning emails:

- 30 days overdue: "Property may be eligible for lien-readiness review."
- Address verification incomplete: weekly reminder.
- Pre-lien notice mailed: "15-day waiting period started."
- 10 days after pre-lien notice: "Lien review date approaching."
- 15 days after pre-lien notice: "Ready for legal review, if still unpaid."
- After lien filing: quarterly status reminder.
- 6 months before three-year deadline: "Lien enforcement deadline approaching."
- 90 days before three-year deadline: "Lien enforcement deadline urgent."
- 30 days before three-year deadline: "Lien enforcement deadline critical."

### 8. Fines and Suspension Workflow

North Carolina G.S. 47F-3-107.1 requires notice of the charge, opportunity to be heard and present evidence, notice of decision, and appeal rights unless the declaration provides a specific procedure. Appeal notice must be delivered within 15 days after decision.

Calendar requirements:

- Track violation charge date.
- Track notice sent date.
- Track hearing date.
- Store evidence and notes.
- Track decision date and decision notice.
- Create 15-day appeal deadline after decision.
- Track appeal status and board decision.
- Track suspension start/end and cure condition if privileges/services are suspended.

Warning emails:

- Hearing scheduled: notify board/adjudicatory panel.
- 7 days before hearing: "Prepare evidence packet."
- 1 day before hearing: "Hearing tomorrow."
- Decision recorded: "Decision notice required."
- 10 days after decision: "Appeal window closes in 5 days."
- 15 days after decision: "Appeal window closes today."

## Email Recipient Rules

Recipient groups:

- Board president
- Treasurer
- Secretary
- Full board
- Admin/property manager
- Legal/compliance reviewer
- Resident/property users, only for resident-facing notices
- Vendor or pool worker, only for assigned workflows

Defaults:

- Meeting and records reminders: secretary plus admin.
- Financial statement and audit reminders: treasurer, president, admin.
- Assessment and delinquency reminders: treasurer, admin.
- Lien/fine/suspension reminders: president, treasurer, secretary, admin, legal reviewer.
- Resident dues reminders: linked property users only.
- Guest payers: receipt only, no account status reminders.

## Escalation Rules

- Informational reminder: normal email.
- Warning: deadline within configured risk window.
- Critical: statutory or board-configured deadline within 5 days.
- Overdue: daily email until resolved or explicitly deferred with reason.
- Legal-sensitive: cannot be marked complete without review role.

## Dashboard Requirements

Board/admin dashboard should include:

- Compliance calendar month view.
- Upcoming statutory deadlines.
- Overdue compliance tasks.
- Meetings needing notice.
- Meetings needing minutes.
- Annual financial statement progress.
- Records requests due soon.
- Delinquent properties requiring review.
- Lien/fine workflows pending legal review.
- Audit/review/compilation status.

Resident dashboard should only show resident-facing items:

- Upcoming meetings/events.
- Announcements.
- Dues due dates.
- Resident-visible documents.
- Resident-specific notices.

## Data Model Hints

Suggested entities:

- ComplianceCalendarEvent
- ComplianceTask
- ComplianceDeadline
- ComplianceEmailRule
- ComplianceEmailLog
- Meeting
- MeetingNotice
- MeetingMinute
- RecordsRequest
- AnnualFinancialStatement
- AuditReview
- AssessmentCycle
- DelinquencyCase
- LienCase
- FineCase
- LegalReview

## Implementation Guardrails

- The app should warn, document, and route for review; it should not file legal documents automatically.
- All legally sensitive workflows should preserve evidence of notices, dates, recipients, documents, and approvals.
- Deadline rules should be configurable because bylaws, declarations, and state law may differ.
- The product should include a clear disclaimer that workflow reminders are operational aids and not legal advice.

## Sources

- North Carolina G.S. 47F-3-108, Meetings: https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_47f/GS_47F-3-108.html
- North Carolina G.S. 47F-3-118, Association records: https://www.ncleg.gov/enactedlegislation/statutes/html/bysection/chapter_47f/gs_47f-3-118.html
- North Carolina G.S. 47F-3-115, Assessments for common expenses: https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_47F/GS_47F-3-115.html
- North Carolina G.S. 47F-3-116, Lien for sums due the association; enforcement: https://www.ncleg.gov/enactedlegislation/statutes/html/bysection/chapter_47f/gs_47f-3-116.html
- North Carolina G.S. 47F-3-107.1, Fines and suspension procedures: https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_47f/GS_47F-3-107.1.html
