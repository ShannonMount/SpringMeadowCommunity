---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - "_bmad-output/planning-artifacts/product-brief-SpringMeadowCommunity.md"
  - "_bmad-output/planning-artifacts/research/domain-hoa-community-website-research-2026-04-30.md"
workflowType: "research"
lastStep: 6
research_type: "technical"
research_topic: "Affordable full-stack architecture, hosting, and pricing for a 200-resident HOA website"
research_goals: "Identify the best and most affordable stacks, tools, webservers, and hosting resources for an HOA website serving about 200 residents, and recommend competitive annual pricing that includes hosting and serving."
user_name: "Smount"
date: "2026-04-30"
web_research_enabled: true
source_verification: true
---

# Technical Research: Affordable Stack, Hosting, and Pricing for a 200-Resident HOA Website

## Executive Summary

A 200-resident HOA website does not need heavyweight infrastructure. The expected traffic pattern is low to moderate, with occasional spikes around dues deadlines, meetings, announcements, and document access. The right architecture should optimize for reliability, security, low maintenance, backups, payment safety, and predictable monthly cost.

The best practical stack for Spring Meadow Community is a managed modern web app: **Next.js + TypeScript + Supabase + Stripe + Cloudflare + Resend**. This gives a production-grade app with authentication, PostgreSQL, object/document storage, server-side workflows, payments, email, CDN/security, and low operational overhead. A typical production operating cost for the first HOA should be roughly **$30-$75/month** before support labor, depending on whether paid email and extra storage are needed.

If the product is later sold to other HOAs, the competitive annual price for a 200-resident or 200-home community should likely be **$1,200-$1,800/year for a core plan**, with payment processing fees passed through to residents/HOA. A more complete plan with board compliance workflows, vendor tools, pool maintenance, and higher support can reasonably sit around **$1,800-$2,400/year**. This positions the product below or near several HOA software competitors while still leaving room for hosting, maintenance, support, and profit.

## Recommended Stack

### Primary Recommendation: Managed SaaS Stack

Use this for the first production version:

- **Frontend/App:** Next.js with TypeScript
- **UI:** Tailwind CSS plus a component system such as shadcn/ui
- **Backend:** Next.js server actions/API routes for app-specific business logic
- **Database:** Supabase Postgres
- **Auth:** Supabase Auth
- **Document Storage:** Supabase Storage initially; Cloudflare R2 later if document storage grows
- **Payments:** Stripe Checkout or Payment Element
- **Email:** Resend
- **DNS/CDN/WAF/bot protection:** Cloudflare
- **Hosting:** Vercel Pro or Cloudflare Pages/Workers
- **Error monitoring:** Sentry free/low-tier or another lightweight monitoring option
- **Analytics:** privacy-conscious analytics or basic app event logging

### Why This Stack Fits

- Low operational overhead for one person or a small team.
- PostgreSQL is a strong fit for property-centered records, payments, documents, permissions, and compliance workflows.
- Supabase Auth and Row Level Security can support property-based access control.
- Stripe avoids direct card handling and reduces PCI scope.
- Cloudflare gives DNS, CDN, SSL, DDoS protection, and free Turnstile anti-bot widgets.
- Resend keeps transactional email simple.

## Hosting Options Compared

### Option A: Vercel + Supabase

Best for fastest development and easiest Next.js deployment.

Estimated monthly infrastructure:

- Vercel Pro: **$20/month** base, includes 1 deploying seat and $20 monthly usage credit.
- Supabase Pro: **$25/month** base. Official billing docs show Pro includes 100,000 MAUs, 8 GB database disk, 100 GB storage, and 250 GB egress before overages.
- Resend: free for 3,000 emails/month; Pro is **$20/month** for 50,000 emails/month.
- Cloudflare DNS/Turnstile: free tier likely sufficient.
- Optional Cloudflare R2: low cost if document storage grows; 10 GB-month free, then standard storage at **$0.015/GB-month** and no egress charges.

Likely total: **$45/month** without paid email, **$65/month** with Resend Pro.

Best when:

- You want the fastest path to production.
- You want minimal server administration.
- You are comfortable with Vercel commercial pricing and usage controls.

### Option B: Cloudflare Pages/Workers + Supabase

Best for lowest hosting cost and strong edge security.

Estimated monthly infrastructure:

- Cloudflare Workers Paid: **$5/month** minimum, with generous included usage and no additional charges for data transfer/throughput.
- Supabase Pro: **$25/month**.
- Resend: free or **$20/month** if email volume grows.
- Cloudflare R2: optional document storage; 10 GB-month free, then **$0.015/GB-month**.

Likely total: **$30/month** without paid email, **$50/month** with Resend Pro.

Best when:

- You want very low infrastructure cost.
- You are willing to design around Cloudflare's runtime model.
- You value cheap global serving and predictable bandwidth.

Tradeoff:

- Some Next.js features and Node APIs may require adaptation. This is workable, but Vercel is smoother for mainstream Next.js.

### Option C: DigitalOcean VPS + Docker + Postgres

Best for control and predictable flat cost, but higher operations burden.

Estimated monthly infrastructure:

- DigitalOcean basic Droplet: **$12/month** for 2 GB RAM or **$24/month** for 4 GB RAM.
- Backups: roughly 20%-30% of Droplet cost depending on backup plan.
- Managed database optional; self-hosted Postgres lowers cost but increases maintenance.
- Object storage/email/payment services still needed.

Likely total: **$15-$40/month** before paid email/object storage, but with more sysadmin responsibility.

Recommended webserver:

- **Caddy** for automatic HTTPS and simple reverse proxy configuration, or
- **Nginx** if using a more traditional setup.

Best when:

- You want maximum control.
- You are comfortable managing Linux, Docker, backups, patches, security updates, and database operations.

Tradeoff:

- Cheapest on paper, most expensive in hidden labor. For a compliance-sensitive HOA portal, managed services are safer early.

## Capacity for 200 Residents

For 200 residents, expected usage is small:

- A few hundred user accounts.
- A few thousand page views per month.
- Bursts around dues deadlines and announcements.
- Moderate document storage.
- Low database load.
- Low email volume unless announcements are frequent.

Supabase Pro limits are far above this likely workload. Vercel Pro, Cloudflare Workers Paid, or even a small VPS can serve this capacity comfortably.

The capacity concern is not CPU. It is:

- Correct access control.
- Secure payment handling.
- Backups.
- Document privacy.
- Audit trails.
- Admin workflow correctness.
- Legal/compliance workflow evidence.

## Payment Processor Recommendation

Use **Stripe**.

Stripe's standard U.S. card pricing is **2.9% + 30 cents** per successful domestic card transaction. ACH Direct Debit is listed at **0.8% with a $5 cap**. For HOA dues, ACH should be encouraged because dues payments may be larger and ACH caps processing fees.

Recommended payment strategy:

- Let residents pay by card or ACH.
- Pass processor fees through to the payer if the HOA wants dues net-of-fees.
- Use Stripe Checkout or Payment Element to avoid storing card data.
- Store Stripe payment intent/session IDs and receipt metadata in the app.
- Keep internal balance records in the HOA app, but use Stripe as the payment processor of record.

## Document Storage Recommendation

Start with Supabase Storage because it integrates cleanly with Supabase Auth and access policies. Supabase Pro includes **100 GB storage** and charges **$0.021/GB-month** over quota.

If the product later stores many photos, pool proof images, scanned records, and vendor documents across many HOAs, consider moving document objects to Cloudflare R2. R2 standard storage is **$0.015/GB-month**, includes 10 GB-month free, and has free egress.

Recommendation:

- MVP: Supabase Storage.
- Multi-HOA scale: Cloudflare R2 with app-level permission checks and signed URLs.

## Security and Compliance Tooling

Minimum production controls:

- Role-based access control.
- Property-based authorization.
- Row Level Security for data access where feasible.
- Private object storage with signed access.
- Audit logs for sensitive actions.
- Daily database backups.
- Payment processor webhooks with signature verification.
- Separate guest payment flow with no balance disclosure.
- Admin-only legal/compliance workflows.
- Rate limiting and bot protection on public forms.
- Cloudflare Turnstile for vendor proposal, contact, guest payment, and login abuse prevention.

Cloudflare Turnstile's free plan supports most production applications, with up to 20 widgets and unlimited challenges.

## Pricing Research: Competitor Anchors

Observed competitor pricing for HOA software:

- **PayHOA:** for 151-200 units, published pricing shows **$169/month billed yearly**, or about **$2,028/year**.
- **HOA Simplify:** standard plan up to 200 units shows **$179/month annually**, or about **$2,148/year** at launch pricing.
- **HOA Start:** packages start at **$39/month** professional and **$49/month** premium, billed annually, but pricing may vary by community size and package.
- **HOAworks:** software essentials starts at **$45/month**.
- **CommunityIQ:** public page shows a per-door model, e.g. base plus per-unit pricing.

Interpretation:

- A bare HOA website/document/payment portal can compete around **$600-$1,200/year**.
- A real resident portal with payments, documents, admin tools, compliance workflows, and support can compete around **$1,200-$2,400/year** for a 200-unit HOA.
- Full accounting-heavy HOA platforms may cost more, but they also provide broader accounting and management tooling.

## Recommended Annual Product Pricing

### Launch Pricing

For early customers:

- **Core Plan:** **$999/year** for up to 200 residents/homes.
- Includes hosting, SSL, public site, resident portal, documents, announcements, events, payments, and board contact.
- Payment processor fees passed through.
- Limited storage, e.g. 10 GB included.

### Sustainable Standard Pricing

For long-term pricing:

- **Core:** **$1,200/year** for up to 200 homes.
- **Standard:** **$1,800/year** for up to 200 homes.
- **Compliance/Operations:** **$2,400/year** for up to 200 homes.

Suggested plan split:

- **Core:** public site, resident dashboard, payments, documents, announcements, events, board contact.
- **Standard:** Core plus admin reporting, records requests, annual meeting workflows, assessment tracking, better email support.
- **Compliance/Operations:** Standard plus NC compliance workflows, delinquency/lien checklists, vendor proposals/bills, pool maintenance, advanced audit logs.

### Price Per Additional Home

For communities above 200 homes:

- Add **$3-$6 per home/year** depending on feature depth and support.

This keeps pricing below many per-door platforms while still covering hosting and support.

## Estimated Gross Margin

For one HOA on the managed stack:

- Infrastructure: **$30-$75/month**, or **$360-$900/year**.
- At **$1,200/year**, infrastructure margin may be thin if every customer has isolated Supabase/Vercel resources.
- At **$1,800/year**, there is more room for support and maintenance.
- At **$2,400/year**, there is enough room for hosting, support, backups, monitoring, and continued product development.

For multi-tenant architecture:

- Infrastructure cost per HOA can drop significantly because app hosting, database, storage, email, and monitoring are shared.
- This improves margins, but multi-tenancy increases implementation complexity and security requirements.

Recommendation:

- Build the first version so it can support multi-community later.
- Do not overcomplicate the first HOA deployment.
- Price early customers high enough to cover support, not just servers.

## Final Recommendation

Use **Next.js + TypeScript + Supabase + Stripe + Cloudflare + Resend**.

Deploy first on either:

- **Vercel + Supabase** for simplest development, or
- **Cloudflare Workers/Pages + Supabase** for lowest hosting cost.

For Spring Meadow Community specifically, Vercel + Supabase is the lowest-friction path. For a commercial multi-HOA product, Cloudflare + Supabase or Cloudflare + a managed Postgres provider may offer better cost control.

Recommended sales price:

- Start at **$1,200/year** for the core 200-resident product if support is light.
- Prefer **$1,800/year** as the sustainable standard plan.
- Offer **$2,400/year** for the version that includes legal/compliance workflows, vendor workflows, and pool maintenance.

Payment processing fees should be separate and passed through to the payer or HOA.

## Sources

- Vercel Pricing: https://vercel.com/pricing
- Vercel Pro Plan: https://vercel.com/docs/plans/pro
- Supabase billing and included usage: https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase storage pricing: https://supabase.com/docs/guides/storage/management/pricing
- Supabase egress pricing: https://supabase.com/docs/guides/platform/manage-your-usage/egress
- Supabase disk pricing: https://supabase.com/docs/guides/platform/manage-your-usage/disk-size
- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare Pages Functions pricing: https://developers.cloudflare.com/pages/functions/pricing/
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Cloudflare Turnstile plans: https://developers.cloudflare.com/turnstile/plans/
- Stripe U.S. pricing: https://stripe.com/us/pricing
- Resend pricing: https://resend.com/pricing
- DigitalOcean App Platform pricing: https://docs.digitalocean.com/products/app-platform/details/pricing/
- DigitalOcean Droplet pricing: https://www.digitalocean.com/pricing/droplets
- Fly.io resource pricing: https://fly.io/docs/about/pricing/
- Backblaze B2 pricing: https://www.backblaze.com/cloud-storage/pricing
- PayHOA pricing: https://www.payhoa.com/pricing/
- HOA Simplify pricing: https://www.hoasimplify.com/pricing
- HOA Start pricing: https://hoastart.com/pricing/
- HOAworks pricing: https://hoa.works/pricing/
- CommunityIQ pricing: https://www.communityiq.co/pricing
