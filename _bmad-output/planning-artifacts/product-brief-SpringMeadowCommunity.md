---
title: "Product Brief: Spring Meadow Community"
status: "complete"
created: "2026-04-30T19:46:04-0400"
updated: "2026-04-30T20:22:28-0400"
inputs:
  - "Brainstorming conversation, 2026-04-30"
  - "_bmad-output/planning-artifacts/research/domain-hoa-community-website-research-2026-04-30.md"
  - "_bmad-output/planning-artifacts/research/technical-hoa-website-stack-hosting-pricing-research-2026-04-30.md"
  - "_bmad-output/planning-artifacts/compliance-calendar-and-warning-emails.md"
---

# Product Brief: Spring Meadow Community

## Executive Summary

Spring Meadow Community is a full-stack HOA community website and operations portal for a real North Carolina homeowners association. The first version gives residents a simple, secure place to log in, see dues status, pay dues, read HOA announcements, view upcoming events, access private documents, and communicate with the board. For the board, it creates a controlled administrative workspace for properties, users, payments, documents, announcements, events, records, and compliance reminders.

The product is intentionally property-centered. Each property address is the durable operational record, while multiple individual users can be linked to the same property. That supports real household patterns such as spouses or co-owners having separate logins while sharing the same dues status, documents, and property communication history.

Although the first deployment serves Spring Meadow Community, the product should be built as a reusable prototype for other HOAs. The long-term opportunity is a configurable HOA portal that can be branded, priced, hosted, and customized for other communities without rebuilding the product from scratch.

## The Problem

Small and mid-sized HOAs often operate through disconnected tools: email threads, paper checks, spreadsheets, shared drives, informal meeting notes, and inconsistent vendor communication. Residents may not know where to find documents, what they owe, how to pay, whether an announcement is official, or how to contact the board. Board members must manage payments, documents, meetings, records requests, vendor proposals, invoices, compliance deadlines, and resident questions without one reliable system of record.

For North Carolina HOAs, the operational burden also includes legal-sensitive workflows: annual association meetings, meeting notice windows, financial records, annual income and expense statements, records access, assessment tracking, fines, suspension procedures, and lien-preparation steps. Missing these deadlines or failing to preserve records creates risk for the association and unnecessary stress for volunteer board members.

## The Solution

Spring Meadow Community provides a secure public website and private portal organized around properties, roles, documents, payments, and compliance workflows. The resident dashboard focuses on the highest-value information immediately after login: dues status, a pay dues button, HOA announcements, and upcoming events.

Payment support is central. Authorized property users can see dues status and payment history. Guests can pay dues on behalf of a property using address and/or account number, but they receive only a receipt for their own payment and cannot see owner names, balance, private documents, or payment history.

The board/admin experience adds operational control: user and property management, document visibility, announcements, events, payment records, resident-to-board messages, and a compliance calendar with warning emails for meetings, notes/minutes, annual financial statement deadlines, records requests, assessment cycles, delinquency review, and legal-sensitive workflows.

## What Makes This Different

Most simple HOA websites are either public brochure sites or generic portals. Spring Meadow Community combines public communication, resident self-service, board operations, and North Carolina-aware compliance workflows into one product.

The core differentiators are:

- Property-centered account model instead of simple user-only accounts.
- Privacy-safe guest payment flow.
- Document visibility levels: public, resident, board, vendor, property-specific, and admin.
- Board compliance calendar with warning emails for legally important workflows.
- Legal-review gates for fines, suspension, lien preparation, foreclosure-related tracking, and other sensitive actions.
- Financial safeguards such as audit logs, role separation, and approval workflows to reduce the risk of board misuse or theft.
- Reusable architecture for future HOA customers.

## Who This Serves

Residents need a trustworthy portal to pay dues, see official updates, view events, access documents, and communicate with the HOA board.

Board members need a structured workspace to manage records, payments, meetings, documents, compliance deadlines, resident communication, and future vendor workflows without relying on scattered files and memory.

Vendors need a clear path to submit public proposals, then, once approved by the HOA, submit invoices or bills through a controlled workflow.

Prospective buyers and public visitors need reliable public community information without exposing private resident, property, board, or financial records.

Guest payers need a safe payment path that lets them pay toward a property without receiving private account information.

## First Version Scope

The first version should include:

- Public HOA information pages.
- Resident login.
- Property-centered accounts with multiple linked users per property.
- Resident dashboard with dues status, pay dues button, announcements, and upcoming events.
- Online dues payments through Stripe.
- Guest dues payment by property address and/or account number, with receipt-only visibility.
- Payment records visible to authorized residents, board members, and admins.
- Admin-managed documents with privacy levels.
- HOA announcements and event calendar.
- Resident-to-board communication.
- Basic admin tools for users, properties, payments, documents, announcements, events, and messages.
- Compliance calendar and warning emails for North Carolina HOA operations.
- Board workflow foundations for meetings, records requests, annual financial statement availability, assessment cycles, and delinquency tracking.

## Later Scope

Later phases should add:

- Moderated community posts.
- Maintenance requests.
- Architectural requests.
- Vendor proposal intake.
- Approved vendor portal access.
- Vendor bill submission and board bill approval.
- Board meeting agendas, notes, and approved minutes.
- Financial safeguards with stronger two-person approvals and reconciliation workflows.
- Pool maintenance module with worker name, daily checklist, chemical readings, timestamped proof photos, alerts, and board/admin review.
- Fine, suspension, damage assessment, lien-preparation, and foreclosure-related tracking with legal-review gates.
- Multi-HOA configuration, onboarding, branding, and pricing tools.

## Technical and Business Approach

The recommended first production stack is **Next.js + TypeScript + Supabase + Stripe + Cloudflare + Resend**. This keeps the product affordable and maintainable while supporting authentication, PostgreSQL data modeling, document storage, payments, email, CDN/security, and future multi-HOA growth.

For one HOA of roughly 200 residents/homes, expected infrastructure cost is modest: approximately **$30-$75/month** depending on hosting and email choices. Vercel plus Supabase is the fastest production path; Cloudflare plus Supabase is likely the lowest-cost managed path.

If sold commercially, a competitive annual price for up to 200 homes should be:

- Launch/Core: **$999/year**
- Sustainable Core: **$1,200/year**
- Standard: **$1,800/year**
- Compliance/Operations: **$2,400/year**

Payment processor fees should be passed through to the payer or HOA rather than absorbed into the subscription price.

## Success Criteria

The first version is successful if residents can reliably log in, understand dues status, pay dues online, read official announcements, see upcoming events, access private documents, and contact the board without needing manual help.

Board success should be measured by fewer document-access questions, clearer payment records, more consistent meeting and financial recordkeeping, timely compliance reminders, and reduced reliance on informal email/spreadsheet processes.

Commercial prototype success should be measured by how much of the implementation can be reused for a second HOA with different branding, payment rules, document categories, board roles, compliance settings, and amenities.

## Guardrails

The product should not automatically take legal action. Workflows involving fines, privilege suspension, liens, foreclosure, attorney-fee collection, owner records, or legally sensitive notices should warn, document, and route for board/legal review before external action.

The product should not replace legal counsel, accounting advice, or certified pool operation requirements. It should help the HOA preserve dates, notices, records, approvals, and evidence so board members can operate more responsibly.

## Vision

If successful, Spring Meadow Community becomes a configurable HOA operations platform. A community could launch a branded public site, resident portal, dues payment system, document library, board workspace, compliance calendar, vendor workflow, and amenity maintenance tracker from one shared product foundation.

The product should grow from one real HOA's practical needs into a repeatable system that helps volunteer boards and community managers run associations with less friction, better records, stronger safeguards, and clearer communication.
