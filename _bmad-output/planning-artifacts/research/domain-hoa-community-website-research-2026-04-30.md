---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - "_bmad-output/planning-artifacts/product-brief-SpringMeadowCommunity.md"
  - "_bmad-output/planning-artifacts/compliance-calendar-and-warning-emails.md"
workflowType: "research"
lastStep: 6
research_type: "domain"
research_topic: "HOA community website needs"
research_goals: "Identify what is needed for a community website that has an HOA, with emphasis on resident payments, documents, announcements, events, board communication, vendor workflows, and pool maintenance."
user_name: "Smount"
date: "2026-04-30"
web_research_enabled: true
source_verification: true
---

# Domain Research: HOA Community Website Needs

## Executive Summary

An HOA community website is best understood as two connected products: a public community information site and a private association operations portal. The public site supports transparency, prospective buyers, realtors, vendors, and general community communication. The private portal supports resident self-service, property-specific account records, payments, documents, board communication, requests, vendor workflows, meeting records, and amenity operations.

For Spring Meadow Community, the first version should prioritize resident, payment, document, announcement, event, and board communication workflows. This aligns with the most common HOA portal patterns found across association management products and public HOA service providers: account access, online dues payments, document repositories, announcements, events, maintenance or architectural requests, and board/admin management.

The domain has three important constraints for product design. First, HOA data is property-centered: dues, violations, documents, requests, and account history belong primarily to a property, while multiple people may need access to that property. Second, privacy and records access must be carefully separated: public, resident, board, vendor, property-specific, and admin records should have explicit access boundaries. Third, requirements vary significantly by state and governing documents, so the product should avoid hardcoding legal assumptions and should give admins configurable retention, visibility, and approval controls.

## Table of Contents

1. Research Scope and Methodology
2. Industry and Domain Overview
3. Common HOA Website Capabilities
4. User Groups and Jobs to Be Done
5. Payments and Financial Records
6. Documents, Records, and Privacy Levels
7. Board Communication, Announcements, Events, and Posts
8. Vendor and Bill Workflows
9. Maintenance, Architectural Requests, and Pool Operations
10. Regulatory and Compliance Considerations
11. North Carolina HOA Compliance Workflows
12. Competitive and Ecosystem Landscape
13. Product Implications for Spring Meadow Community
14. Open Questions for PRD
15. Sources

## 1. Research Scope and Methodology

### Scope

This research focuses on what a modern HOA community website and portal should support for a real homeowners association, especially one that wants to reuse the resulting product for other HOAs later.

Covered areas:

- Public community information needs
- Resident portal needs
- Property-centered account modeling
- Online dues payments and guest payments
- Documents and privacy levels
- Announcements, events, and resident-to-board communication
- Community posts and moderation
- Vendor proposal and invoice workflows
- Board meeting notes and operational records
- Pool maintenance and amenity operations
- Domain-specific legal, privacy, and compliance considerations

### Methodology

Research used current public sources from community association industry organizations, HOA portal vendors, HOA management companies, state law references, and CDC aquatic health guidance. The report avoids legal advice and treats state-specific law references as examples. Before implementation, Spring Meadow Community should confirm obligations under its state statutes, governing documents, payment processor rules, and insurance requirements.

## 2. Industry and Domain Overview

Community associations are a large and growing part of U.S. housing. Community Associations Institute reported that community associations were home to 75.5 million Americans and represented more than 30% of U.S. housing stock, with the number of associations projected to grow from 365,000 to as many as 370,000 in 2024. CAI and related summaries estimate about 369,000 community associations and 77.1 million residents in 2024.

This matters because many HOAs are run by volunteer boards or small management teams. The operational burden is broad: collecting assessments, maintaining records, handling resident questions, managing documents, communicating announcements, coordinating vendors, recording meetings, and maintaining common amenities.

### Domain Pattern

The domain pattern is not simply "website CMS." It is "association operations plus controlled communication." A successful HOA website needs to reduce board workload while giving residents better self-service.

### Market Dynamics

HOA portal vendors commonly position around:

- Online payments and billing
- Resident account access
- Association documents
- Announcements and communication
- Maintenance requests
- Architectural requests
- Violation tracking
- Amenity reservations
- Board/admin dashboards

Clubhaus, Perfect HOA, HOALife, CHOPAS, management company portals, and HOA website providers all reinforce this same functional cluster.

## 3. Common HOA Website Capabilities

### Public Website

Common public features:

- Community overview
- Board or management contact information
- Public announcements
- Event calendar or meeting notices
- FAQ
- Governing document summaries or selected public documents
- Realtor/prospective buyer information
- Vendor proposal intake
- Emergency contacts
- Pool or amenity status, if useful to the public or residents

### Private Resident Portal

Common private features:

- Resident login
- Property account overview
- Dues/account status
- Online payment
- Payment history
- Statement or account history
- Private document library
- Announcements
- Events
- Maintenance requests
- Architectural requests
- Messages to the HOA board or manager

### Board/Admin Portal

Common board/admin features:

- Property records
- User/property membership management
- Payment tracking
- Document upload and permissioning
- Announcement publishing
- Event management
- Resident message handling
- Request review
- Vendor proposal review
- Invoice/bill review
- Meeting agenda and minutes management
- Audit and recordkeeping tools

## 4. User Groups and Jobs to Be Done

### Residents and Homeowners

Primary jobs:

- See dues status
- Pay dues
- Access private documents
- Read official announcements
- View upcoming events
- Communicate with the board
- Submit requests later
- See records tied to their property

### Multiple Users per Property

HOA reality requires property-centered accounts. A husband and wife, co-owners, authorized family members, or property managers may need separate logins connected to the same property. The system should model:

- Property as the durable account
- Users as individuals
- Memberships linking users to properties
- Roles/permissions assigned to users and memberships

### Guests Paying Dues

Guest payers may include family members, renters, closing agents, property managers, or other authorized payers. For privacy, guests should be able to pay by property address and/or account number but should not see:

- Balance
- Owner names
- Payment history
- Property documents
- Resident contact information

They should receive only a receipt for the transaction they completed.

### Board Members

Board members need resident-facing and operational tools:

- Review payments and records
- Publish announcements
- Manage events
- Respond to messages
- Manage documents
- Keep meeting notes
- Review vendor proposals and bills later
- Manage pool and amenity maintenance later

### Vendors

Vendors should have two states:

- Prospective vendor: can submit public proposals.
- Approved/official vendor: can submit invoices/bills through the portal.

This prevents arbitrary vendors from gaining access to operational vendor workflows before an HOA relationship exists.

### Pool Workers

Pool workers may also be residents. "Pool worker" should be a permission or assignment, not a separate mutually exclusive account type.

## 5. Payments and Financial Records

### Needed Capabilities

The first version should include:

- Resident payment flow
- Guest payment flow
- Payment receipts
- Payment method/source tracking
- Admin-visible payment history
- Resident-visible payment history for authorized property users
- Manual/offline payment recording later or in admin MVP
- Clear distinction between submitted, succeeded, failed, refunded, and manually recorded payments

### Domain Requirements

Association payment systems need to support account history and assessment records. Virginia's Property Owners' Association Act, as one state-specific example, requires associations to keep detailed records of receipts and expenditures, maintain financial books and records, and maintain individual assessment account records. Requirements vary by state, but the product should assume financial recordkeeping is a core domain concern.

### Guest Payment Privacy

Guest payment is valuable but risky if it leaks private information. The guest payment screen should:

- Confirm only enough to prevent obvious mispayment.
- Avoid owner names and balances.
- Allow pay-by-address and/or account number.
- Email a receipt to the payer.
- Attach the payment to the property record.
- Make the payment visible to authorized residents/admins after completion.

## 6. Documents, Records, and Privacy Levels

### Needed Privacy Levels

Spring Meadow Community should use explicit document visibility levels:

- Public
- Resident
- Board
- Vendor
- Property-specific
- Admin

### Common Document Types

Likely document categories:

- Governing documents
- Bylaws
- Covenants, conditions, and restrictions
- Rules and regulations
- Meeting minutes
- Financial notices
- Dues notices
- Property-specific notices
- Architectural approvals
- Violation records
- Vendor contracts
- Insurance certificates
- Pool maintenance records
- Forms

### Records Access and Retention

State laws and governing documents often define what records must be kept, who may inspect them, and what can be withheld. Meeting minutes and financial records are especially important. The product should support:

- Document type
- Visibility level
- Related property, vendor, meeting, or amenity
- Upload date
- Effective date
- Expiration date
- Retention category
- Audit trail for upload/update/delete/access where appropriate

The system should avoid assuming every record is visible to every resident. Some records may need redaction, withholding, or separation, such as attorney-client material, personnel records, executive session materials, collection records, or property-specific owner records. Exact obligations are state-specific.

## 7. Board Communication, Announcements, Events, and Posts

### Resident-to-Board Communication

This should be part of the MVP. It provides a controlled channel for:

- Dues questions
- Document questions
- Maintenance concerns
- General HOA inquiries
- Private property-related messages

Messages should be linked to the property and the user who sent them.

### Announcements

Announcements should be official board/admin communications. Useful capabilities:

- Publish date
- Expiration date
- Pin/priority flag
- Audience targeting: public, residents, board, vendors, property-specific later
- Attachment support
- Email notification later

### Events

Events should cover:

- HOA meetings
- Board meetings if visible
- Community events
- Pool opening/closing dates
- Maintenance windows
- Dues deadlines

### Community Posts

Community posts should require moderation before publication. This protects the HOA from spam, disputes, inappropriate content, and posts that look official but are not. Suggested workflow:

- Resident submits post.
- Moderator reviews.
- Post is approved, rejected, or returned for revision.
- Board/admin announcements remain distinct from resident posts.

## 8. Vendor and Bill Workflows

### Proposal Intake

Any vendor should be able to submit a proposal publicly. Proposal fields should include:

- Vendor name
- Contact information
- Work category
- Description
- Proposed amount or range
- Attachments
- Insurance/license information where relevant

### Approved Vendor Portal

Only vendors with an official working relationship should be able to submit bills through the portal. Approved vendor workflows should include:

- Invoice upload
- Invoice number
- Amount
- Due date
- Work category
- Related project/request
- Status: submitted, under review, approved, rejected, paid
- Board notes
- Payment record attachment

### Board Bill Payment

Board members need approval and recordkeeping, not necessarily direct bank payment in the first release. Later versions may support bill pay integrations, but early scope can track approvals and payment status.

## 9. Maintenance, Architectural Requests, and Pool Operations

### Maintenance Requests

Maintenance requests are common HOA portal features. They should eventually support:

- Request category
- Property/common area indicator
- Description
- Photos
- Status
- Board/admin assignment
- Vendor assignment later
- Resolution notes

### Architectural Requests

Architectural requests should eventually support:

- Request type
- Description
- Attachments/plans
- Property link
- Review status
- Board/committee notes
- Approval/denial letter
- Decision date

### Pool Maintenance

Pool maintenance is a specialized operational module. CDC guidance emphasizes that pool chemical handling and maintenance are safety-sensitive, require training, documentation, appropriate chemical handling, and regular testing of disinfectant and pH levels.

The Spring Meadow Community pool module should support:

- Worker assignment; worker may also be a resident
- Worker name on each log
- Date and timestamp
- Daily checklist
- Chemical readings
- Required proof photos
- Optional pool condition photos
- Board/admin review
- Alerts for missed logs
- Alerts for out-of-range readings
- Historical maintenance records
- Exportable reports

Suggested chemical fields:

- Free chlorine or sanitizer reading
- pH
- Total alkalinity
- Cyanuric acid/stabilizer, if used
- Calcium hardness, if tracked
- Water temperature, if useful
- Water clarity

The product should not hardcode universal chemical thresholds without confirming local health code, pool type, chemical system, and HOA policies. CDC public guidance gives typical values, but local/state pool rules and certified pool operator practices should govern final thresholds.

## 10. Regulatory and Compliance Considerations

### State-Specific HOA Law

HOA recordkeeping, records access, meeting notices, meeting minutes, owner inspection rights, website posting requirements, and financial record requirements vary by state and association type. The product should be configurable and should allow administrators to map local requirements into:

- Document categories
- Visibility rules
- Retention periods
- Meeting record workflows
- Records request handling
- Financial record access

### Payments

Online payments introduce financial, security, and privacy obligations. The product should use a reputable payment processor and avoid storing sensitive payment card or bank information directly. Requirements to consider:

- Payment processor compliance
- Receipt generation
- Refund/adjustment workflows
- Audit trails
- Role-based access to financial records
- Clear privacy separation for guest payments

### Data Privacy

The portal will store personal and property-related data:

- Names
- Emails
- Property addresses
- Payment records
- Messages
- Property-specific documents
- Vendor records
- Board notes

The product should use role-based access control, least-privilege admin permissions, audit logs for sensitive actions, secure document storage, and clear data retention policies.

### Meeting Notes and Minutes

Meeting minutes are governance records, not informal transcripts. Many sources emphasize that minutes should record official actions, motions, votes, attendance, and decisions, rather than every discussion detail. The product should distinguish:

- Draft notes
- Approved minutes
- Executive/private notes
- Public or resident-visible minutes
- Board-only records

### Pool Safety

Pool operations may be subject to local health department rules, insurance requirements, and certified operator expectations. The portal should support documentation and accountability, but it should not replace professional training or legal compliance.

## 11. North Carolina HOA Compliance Workflows

### Applicability Context

For a North Carolina HOA-style planned community, the key statute is the North Carolina Planned Community Act, Chapter 47F. The Act generally applies to planned communities created in North Carolina on or after January 1, 1999, subject to statutory exceptions such as certain communities with 20 or fewer lots unless the declaration opts in. Spring Meadow Community should confirm its creation date, declaration, bylaws, and whether Chapter 47F applies fully or partially.

If the community is legally organized as a condominium rather than a planned community, Chapter 47C, the North Carolina Condominium Act, may apply instead. The product should preserve this distinction as a legal configuration point rather than assuming all communities are identical.

### Board Meeting Workflow

North Carolina G.S. 47F-3-108 requires an association meeting at least once each year. Special meetings may be called by the president, a majority of the executive board, or lot owners with the required voting percentage. Meeting notice must generally be sent no less than 10 and no more than 60 days before the meeting, and the notice must state the time, place, and agenda items, including the general nature of proposed declaration/bylaw amendments, budget changes, and director/officer removal proposals.

Product workflow implications:

- Board/admin can create annual and special association meetings.
- Board/admin can maintain a compliance calendar with required meeting, notice, minutes, financial statement, audit/review, records request, assessment, delinquency, fine, suspension, and lien-preparation deadlines.
- Calendar events can trigger warning emails to the secretary, treasurer, president, admin/property manager, full board, or legal reviewer depending on workflow type.
- Meeting form captures type, date, time, place, agenda, and notice method.
- Notice window validation warns if the meeting is outside the 10-60 day notice range.
- Agenda requires special flags for declaration/bylaw amendments, budget changes, and director/officer removal.
- System records whether notice was sent by mail, hand delivery, or electronic means.
- System stores notice timestamp, recipient list, and notice content.
- Board meeting records should support owner attendance/comment period tracking at regular intervals.
- Default meeting procedure can reference Robert's Rules unless bylaws specify otherwise.

### Association Records Workflow

North Carolina G.S. 47F-3-118 requires the association to keep financial records sufficiently detailed to comply with the Chapter. Financial and other records, including association and executive board meeting records, must be reasonably available for examination by lot owners and authorized agents as required by bylaws and Chapter 55A if the association is a nonprofit corporation. The statute also requires an annual income and expense statement and balance sheet to be available to all lot owners at no charge within 75 days after fiscal year close.

Product workflow implications:

- Board/admin can categorize records as meeting records, financial records, governing documents, property-specific records, vendor records, or admin records.
- Records requests should create due-date tasks and warning emails, including special handling for unpaid assessment statements due within 10 business days after receipt.
- System supports owner-accessible record categories and restricted/private categories.
- Annual financial statement workflow tracks fiscal year close and 75-day availability deadline.
- Records request workflow can track requester, property, requested records, due date, response, attachments, and status.
- Document visibility should distinguish resident-visible records from board-only, admin-only, property-specific, and privileged/confidential material.
- Audit log should record uploads, edits, removals, visibility changes, and fulfillment of records requests.

### Assessment and Dues Workflow

North Carolina G.S. 47F-3-115 provides that after an assessment has been made, assessments must be made at least annually. Past-due common expense assessments or installments may bear interest at the association-established rate, not exceeding 18% per year, subject to declaration-specific rules, especially for pre-1999 communities.

Product workflow implications:

- Admin can create annual assessment schedules.
- Assessment records attach to properties/lots.
- System tracks due dates, payment status, interest/late fee rules, and declaration-specific settings.
- Interest-rate configuration must cap rates according to applicable law and declaration settings.
- Payment history must preserve assessment, payment, adjustment, refund, and balance data.
- Board/admin can generate delinquency reports for follow-up.

### Fines and Suspension Workflow

North Carolina G.S. 47F-3-107.1 sets procedures for fines and suspension of planned community privileges or services unless the declaration provides a specific procedure. The statute requires notice of the charge, opportunity to be heard and present evidence, notice of decision, and appeal rights. Fines may not exceed $100 for the violation and may continue daily more than five days after the decision if the violation continues.

Product workflow implications:

- Violation/fine workflow should require charge description, notice, hearing date, evidence, decision, and appeal deadline.
- System should not allow a fine decision without recording notice and opportunity to be heard.
- Fine amount should support a configurable cap, with North Carolina default capped at $100 per violation/day after the statutory grace period unless legal configuration says otherwise.
- Appeal workflow tracks appeal receipt within 15 days and board decision.
- Suspension of privileges/services should track start, reason, cure condition, and end date.

### Damage and Common Element Repair Workflow

North Carolina G.S. 47F-3-107 addresses upkeep of common elements and responsibility for damage. The association is generally responsible for common element maintenance, repair, and replacement except as otherwise provided. If a lot owner is legally responsible for damage to common elements, the association may direct repair or perform repair and recover damages. For certain claims, a hearing may be required before an adjudicatory panel or executive board.

Product workflow implications:

- Maintenance/incident workflow can distinguish common element maintenance from lot-owner-caused damage.
- Damage claim workflow tracks notice, evidence, hearing, decision, amount assessed, and repair status.
- Liability assessments can attach to a property and become part of the property's financial record.

### Lien Initiation Workflow

North Carolina G.S. 47F-3-116 governs liens for sums due to the association. An assessment attributable to a lot that remains unpaid for 30 days or longer constitutes a lien when a claim of lien is filed with the clerk of superior court in the county where the lot is located. Before filing, the association must make reasonable and diligent efforts to ensure records contain the lot owner's current mailing address. No fewer than 15 days before filing the lien, the association must mail a statement of the assessment amount due by first-class mail to required addresses. The claim of lien must contain association information, owner information, lot description, amount claimed, and a statutory bold all-caps warning. A lien for unpaid assessments is extinguished unless proceedings to enforce it are instituted within three years after filing.

Product workflow implications:

- Delinquency workflow starts only after assessment/payment records show the required delinquency state.
- Lien readiness checklist verifies at least 30 days unpaid.
- Address verification checklist records property address, association address of record, county tax record address, and registered agent address if owner is an entity.
- Pre-lien notice workflow records mailing date and requires at least 15 days before lien filing.
- Claim-of-lien preparation checklist captures association name/address, record owner, lot description, claimed amount, county, statutory warning, service attempt, and certificate of service.
- Lien status tracks draft, pre-notice sent, ready for legal review, filed, released/satisfied, enforcement started, expired, or blocked.
- System should not file liens automatically. It should prepare records, reminders, and checklists for board/legal review.
- Three-year enforcement deadline reminder should be tracked after lien filing.

### Implementation Guardrail

These workflows should guide product requirements but not replace legal counsel. The product should include configurable legal settings by community and should preserve evidence of notices, deadlines, approvals, and decisions. Any workflow involving fines, suspension, liens, foreclosure, or owner records should include prominent "legal review required" status gates before external action.

Detailed compliance calendar requirements are captured in `_bmad-output/planning-artifacts/compliance-calendar-and-warning-emails.md`.

## 12. Competitive and Ecosystem Landscape

The HOA software ecosystem includes:

- Full HOA/community association management platforms
- Management company resident portals
- Public HOA website builders
- Payment processors
- Document management systems
- Amenity reservation systems
- Maintenance/request systems
- Accounting tools

Competitors and adjacent products commonly advertise combinations of:

- Public websites
- Resident portals
- Online payments
- Account history
- Document repositories
- Announcements
- Maintenance requests
- Architectural requests
- Violation management
- Amenity reservations
- Board/admin tools

This confirms the product direction for Spring Meadow Community: payments, documents, announcements, events, and resident self-service are table-stakes capabilities; property-centered privacy, guest payment privacy, configurable document visibility, and amenity maintenance can become differentiators.

## 13. Product Implications for Spring Meadow Community

### Recommended MVP

The MVP should include:

- Public HOA website
- Resident login
- Property-centered account model
- Multiple users per property
- Dashboard with dues status, pay dues button, announcements, and upcoming events
- Resident payment flow
- Guest payment by address and/or account number with receipt-only visibility
- Payment records for authorized users/admins
- Document library with privacy levels
- Resident-to-board communication
- Admin tools for users, properties, payments, documents, announcements, and events
- North Carolina-aware board compliance workflow foundations for meetings, records, annual financial statement availability, assessments, and delinquency tracking

### Recommended Data Model Concepts

Core domain entities:

- Community
- Property
- User
- PropertyMembership
- Role/Permission
- Payment
- Document
- Announcement
- Event
- Message
- Vendor
- VendorProposal
- VendorInvoice
- BoardMeeting
- MaintenanceRequest
- ArchitecturalRequest
- Amenity
- PoolMaintenanceLog
- RecordsRequest
- Assessment
- MeetingNotice
- ComplianceWorkflow
- LienCase

### Recommended Permission Model

Use layered permissions:

- Public visitor
- Guest payer
- Resident
- Property member
- Board member
- Vendor applicant
- Approved vendor
- Pool worker
- Admin
- Legal reviewer or compliance reviewer, if the HOA wants a separate review role

A user can hold more than one role. A resident can also be a board member or pool worker.

### Reusable HOA Platform Implications

To support future HOA customization, design early for:

- Community-level settings
- Custom branding
- Configurable dues rules
- Configurable document categories
- Configurable roles
- Configurable request types
- Configurable amenity modules
- Feature flags per HOA

## 14. Open Questions for PRD

- Which state law and governing documents apply to Spring Meadow Community?
- Was Spring Meadow Community created before or after January 1, 1999, and does its declaration opt into or out of any Chapter 47F provisions?
- Is Spring Meadow Community a planned community under Chapter 47F or a condominium under Chapter 47C?
- Should the first payment integration support card only, ACH only, or both?
- Should admin users be able to manually record checks/cash in MVP?
- Should residents receive email notifications for announcements and documents in MVP?
- Should property account numbers be generated by the system or imported from existing HOA records?
- How will initial resident/property data be imported?
- Who can invite additional users to a property?
- Does the HOA need renters/tenants as a separate access type?
- Should board communication support threaded messages in MVP or simple contact requests?
- What payment processor should be used?
- What are the pool's actual chemical standards, local health code requirements, and operator training requirements?
- Who should approve legally sensitive workflows before action: board president, treasurer, secretary, attorney, or property manager?
- Should the product generate legal document templates, or only maintain checklists and records for documents prepared externally?

## 15. Sources

- Community Associations Institute, "Condominiums, Homeowners Associations to See Continued Growth in 2024": https://www.caionline.org/condominiums-homeowners-associations-to-see-continued-growth-in-2024/
- Community Associations Institute homepage and resource positioning: https://www.caionline.org/
- Homeowner association statistics summary citing Foundation for Community Association Research data: https://startanhoamanagementcompany.com/homeowner-association-statistics-2024/
- This Old House HOA statistics summary citing FCAR: https://www.thisoldhouse.com/moving/hoa-statistics
- Weldon Brown, association website and resident portal feature examples: https://weldonbrown.com/associationwebsite/
- Clubhaus HOA platform feature examples: https://www.clubhaus.io/
- Perfect HOA website and resident portal feature examples: https://perfecthoa.com/features/website-templates-resident-portals/
- HOALife owner portal and public website feature examples: https://www.hoalife.com/features/owner-portal-public-websites
- CHOPAS community portal feature examples: https://chopas.net/
- CCMC portal examples for payments, guest payments, account history, resale documents, and self-service: https://ccmcnet.com/portal/
- Virginia Property Owners' Association Act, records and assessment account example: https://law.lis.virginia.gov/vacode/title8.01/chapter17/section55.1-1815/
- Texas State Law Library guide to property owners' association records: https://guides.sll.texas.gov/property-owners-associations/bylaws-and-records
- North Carolina Planned Community Act, Chapter 47F: https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/ByChapter/Chapter_47F.html
- North Carolina G.S. 47F-3-108, Meetings: https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_47f/GS_47F-3-108.html
- North Carolina G.S. 47F-3-118, Association records: https://www.ncleg.gov/enactedlegislation/statutes/html/bysection/chapter_47f/gs_47f-3-118.html
- North Carolina G.S. 47F-3-115, Assessments for common expenses: https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_47F/GS_47F-3-115.html
- North Carolina G.S. 47F-3-107.1, Fines and suspension procedures: https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_47f/GS_47F-3-107.1.html
- North Carolina G.S. 47F-3-107, Upkeep and assessments for damages: https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_47F/GS_47F-3-107.html
- North Carolina G.S. 47F-3-116, Lien for sums due the association; enforcement: https://www.ncleg.gov/enactedlegislation/statutes/html/bysection/chapter_47f/gs_47f-3-116.html
- North Carolina Condominium Act, Chapter 47C: https://house.ncleg.gov/EnactedLegislation/Statutes/HTML/ByChapter/Chapter_47C.html
- CDC, Pool Chemical Safety: https://www.cdc.gov/healthy-swimming/toolkit/pool-chemical-safety.html
- CDC, Guidelines for Keeping Your Pool Safe and Healthy: https://www.cdc.gov/healthy-swimming/safety/what-you-can-do-to-stay-healthy-in-swimming-pools.html
- CDC, Model Aquatic Health Code overview: https://www.cdc.gov/mahc/index.html
- CDC, MAHC current edition: https://www.cdc.gov/model-aquatic-health-code/php/our-work/index.html
