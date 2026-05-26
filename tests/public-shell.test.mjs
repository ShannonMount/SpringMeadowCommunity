import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function listFiles(path) {
  const absolutePath = join(root, path);

  if (!existsSync(absolutePath)) {
    return [];
  }

  return readdirSync(absolutePath).flatMap((entry) => {
    const relativePath = `${path}/${entry}`;
    const entryPath = join(root, relativePath);

    return statSync(entryPath).isDirectory() ? listFiles(relativePath) : [relativePath];
  });
}

describe("public website shell", () => {
  it("defines the public App Router shell files", () => {
    assert.ok(existsSync(join(root, "app/(public)/layout.tsx")));
    assert.ok(existsSync(join(root, "app/(public)/page.tsx")));
    assert.ok(existsSync(join(root, "app/(public)/login/page.tsx")));
    assert.ok(existsSync(join(root, "app/globals.css")));
    assert.ok(existsSync(join(root, "components/public/public-nav.tsx")));
    assert.ok(existsSync(join(root, "lib/public/navigation.ts")));
    assert.ok(existsSync(join(root, "server/.gitkeep")));
  });

  it("renders every required public navigation label", () => {
    const navConfig = read("lib/public/navigation.ts");
    const requiredLabels = [
      "Home",
      "About/Community Info",
      "Announcements",
      "Events",
      "Documents/Public Resources",
      "Contact",
      "Pay Dues",
      "Login",
    ];

    for (const label of requiredLabels) {
      assert.match(navConfig, new RegExp(`label:\\s*"${label.replace("/", "\\/")}"`));
    }
  });

  it("keeps public navigation destinations inside the public shell", () => {
    const navConfig = read("lib/public/navigation.ts");
    const hrefMatches = [...navConfig.matchAll(/href:\s*"([^"]+)"/g)];

    for (const [, href] of hrefMatches) {
      if (href === "/") {
        assert.ok(existsSync(join(root, "app/(public)/page.tsx")));
        continue;
      }

      const routeSegment = href.slice(1);
      assert.ok(
        existsSync(join(root, `app/(public)/${routeSegment}/page.tsx`)),
        `${href} should render inside the public route group`,
      );
    }
  });

  it("keeps mobile navigation keyboard-operable and stateful", () => {
    const nav = read("components/public/public-nav.tsx");
    assert.match(nav, /<nav[\s\S]*aria-label="Primary"/);
    assert.match(nav, /aria-expanded=\{isOpen\}/);
    assert.match(nav, /aria-controls="public-mobile-menu"/);
    assert.match(nav, /onKeyDown=\{handleMobileMenuKeyDown\}/);
    assert.match(nav, /focus-visible:/);
  });

  it("does not import private data services into the public shell", () => {
    const files = [
      read("app/(public)/layout.tsx"),
      read("app/(public)/page.tsx"),
      read("app/(public)/about/page.tsx"),
      read("components/public/public-nav.tsx"),
    ].join("\n");

    assert.doesNotMatch(files, /from\s+["']@\/server\/services/);
    assert.doesNotMatch(files, /from\s+["']@\/server\/queries/);
    assert.doesNotMatch(files, /get(Property|Payment|Document|Resident|Board)/);
    assert.doesNotMatch(files, /property_memberships/);
    assert.doesNotMatch(files, /documents\/private/);
  });

  it("renders real public home and community information content", () => {
    const home = read("app/(public)/page.tsx");
    const about = read("app/(public)/about/page.tsx");

    assert.match(home, /Spring Meadow Community/);
    assert.match(home, /official HOA/i);
    assert.match(home, /Public resources/i);
    assert.match(home, /Resident and visitor entry points/i);
    assert.doesNotMatch(home, /This public shell is intentionally privacy-safe/);

    assert.match(about, /About Spring Meadow Community/);
    assert.match(about, /Community amenities/i);
    assert.match(about, /Official updates/i);
    assert.doesNotMatch(about, /<PlaceholderPage/);
  });

  it("keeps community page content static, public-safe, and empty-state aware", () => {
    const content = read("lib/public/community-content.ts");
    const emptyState = read("components/public/community-content-empty-state.tsx");
    const home = read("app/(public)/page.tsx");
    const about = read("app/(public)/about/page.tsx");

    assert.match(content, /communityContent/);
    assert.match(content, /hasCommunityOverviewContent/);
    assert.match(emptyState, /CommunityContentEmptyState/);
    assert.match(`${home}\n${about}`, /CommunityContentEmptyState/);
    assert.doesNotMatch(`${content}\n${home}\n${about}`, /from\s+["']@\/server\/(services|queries)/);
    assert.doesNotMatch(`${content}\n${home}\n${about}`, /owner|account number|dues balance|payment history/i);
  });

  it("uses meaningful image alt text on public home and about pages", () => {
    const files = [read("app/(public)/page.tsx"), read("app/(public)/about/page.tsx")].join("\n");

    assert.match(files, /from\s+["']next\/image["']/);
    assert.match(files, /alt="Spring Meadow Community entrance sign"/);
    assert.match(files, /alt="Spring Meadow Community pool and gathering area"/);
    assert.doesNotMatch(files, /alt=\{\s*undefined\s*\}/);
  });

  it("renders the public announcements listing page instead of the placeholder", () => {
    const page = read("app/(public)/announcements/page.tsx");

    assert.match(page, /Official announcements/);
    assert.match(page, /listAnnouncements/);
    assert.match(page, /announcementEmptyState/);
    assert.doesNotMatch(page, /<PlaceholderPage/);
  });

  it("filters public announcements by visibility, status, publish window, and expiration", () => {
    const page = read("app/(public)/announcements/page.tsx");
    const migration = read("supabase/migrations/202605110013_announcement_management_and_display.sql");

    assert.match(page, /visibility:\s*"public"/);
    assert.match(page, /status:\s*"published"/);
    assert.match(page, /currentOnly:\s*true/);
    assert.match(migration, /visibility = 'public'::announcement_visibility/);
    assert.match(migration, /status = 'published'::announcement_status/);
    assert.match(migration, /publish_at <= now\(\)/);
    assert.match(migration, /expires_at is null[\s\S]*or announcements\.expires_at > now\(\)/);
    assert.match(migration, /'resident'[\s\S]*'board'[\s\S]*'property_specific'[\s\S]*'admin'/);
    assert.match(migration, /'draft'[\s\S]*'published'[\s\S]*'expired'[\s\S]*'archived'/);
  });

  it("sorts pinned announcements first and exposes only public-safe attachments", () => {
    const migration = read("supabase/migrations/202605110013_announcement_management_and_display.sql");
    const page = read("app/(public)/announcements/page.tsx");

    assert.match(migration, /order by announcements\.pinned desc, announcements\.publish_at desc/);
    assert.match(migration, /app\.can_read_document\(documents\.id\)/);
    assert.match(page, /attachment\.documentId/);
    assert.match(page, /\/api\/documents\/\$\{attachment\.documentId\}\/signed-url\?redirect=1/);
    assert.doesNotMatch(`${migration}\n${page}`, /\/documents\/private|Private inspection worksheet|storage_path|storage_bucket/);
  });

  it("keeps announcement empty-state and page data privacy-safe", () => {
    const page = read("app/(public)/announcements/page.tsx");
    const service = read("server/services/announcements/announcement-management.ts");

    assert.match(page, /title: "No public announcements right now"/);
    assert.match(page, /description:\s*"Official community announcements will appear here/);
    assert.doesNotMatch(`${page}\n${service}`, /private-documents|owner_display_name|account number|dues balance|payment history/i);
  });

  it("renders the public events listing page instead of the placeholder", () => {
    const page = read("app/(public)/events/page.tsx");

    assert.match(page, /Community events/);
    assert.match(page, /listEvents/);
    assert.match(page, /eventEmptyState/);
    assert.match(page, /<time dateTime=\{/);
    assert.doesNotMatch(page, /<PlaceholderPage/);
  });

  it("queries public events through the database-backed event service", () => {
    const page = read("app/(public)/events/page.tsx");
    const migration = read("supabase/migrations/202605110014_event_management_and_calendar_display.sql");

    assert.match(page, /visibility:\s*"public"/);
    assert.match(page, /includeArchived:\s*false/);
    assert.match(page, /startsFrom:\s*recentWindowStart\(\)/);
    assert.match(page, /PUBLIC_EVENT_PAGE_SIZE/);
    assert.doesNotMatch(page, /getVisiblePublicEvents|publicEvents/);
    assert.match(migration, /visibility = 'public'::event_visibility/);
    assert.match(migration, /events\.status <> 'archived'::event_status/);
    assert.match(migration, /order by[\s\S]*events\.starts_at/i);
    assert.match(migration, /'resident'[\s\S]*'board'[\s\S]*'admin'/);
    assert.match(migration, /'scheduled'[\s\S]*'cancelled'[\s\S]*'completed'[\s\S]*'archived'/);
  });

  it("renders complete event details and cancelled status context", () => {
    const data = read("lib/public/events.ts");
    const page = read("app/(public)/events/page.tsx");

    assert.match(data, /export function formatEventDate/);
    assert.match(data, /export function formatEventTimeRange/);
    assert.match(data, /export function getEventStatusLabel/);
    assert.match(data, /board_meeting/);
    assert.match(data, /maintenance_window/);
    assert.match(data, /dues_deadline/);
    assert.match(page, /formatEventDate/);
    assert.match(page, /formatEventTimeRange/);
    assert.match(page, /getEventStatusLabel/);
    assert.match(page, /event\.type/);
    assert.match(page, /event\.description/);
    assert.match(page, /event\.location/);
    assert.match(page, /event\.status === "cancelled"/);
    assert.match(page, /Cancelled/);
  });

  it("keeps event empty-state and public event files privacy-safe", () => {
    const page = read("app/(public)/events/page.tsx");
    const data = read("lib/public/events.ts");

    assert.match(data, /title: "No public events right now"/);
    assert.match(data, /description:\s*"Upcoming public community events will appear here/);
    assert.doesNotMatch(
      `${page}\n${data}`,
      /supabase|auth|signed-url|private-documents|documents\/private|owner|property address|account number|dues balance|payment history|related_meeting_id|related_compliance_event_id|workflow path/i,
    );
  });

  it("renders the public contact form page instead of the placeholder", () => {
    const page = read("app/(public)/contact/page.tsx");

    assert.match(page, /Contact the HOA/);
    assert.match(page, /ContactForm/);
    assert.match(page, /metadata/);
    assert.match(page, /general community questions/i);
    assert.doesNotMatch(page, /<PlaceholderPage/);
  });

  it("defines an accessible contact form with Turnstile token handling", () => {
    const form = read("components/public/contact-form.tsx");

    assert.match(form, /"use client"/);
    assert.match(form, /name="name"/);
    assert.match(form, /name="email"/);
    assert.match(form, /name="phone"/);
    assert.match(form, /name="message"/);
    assert.match(form, /cf-turnstile-response/);
    assert.match(form, /turnstileToken/);
    assert.match(form, /aria-live="polite"/);
    assert.match(form, /aria-invalid=\{/);
    assert.match(form, /aria-describedby=\{/);
    assert.match(form, /focus-visible:/);
  });

  it("defines public-safe contact validation and response copy", () => {
    const contact = read("lib/public/contact.ts");

    assert.match(contact, /export type PublicContactRequest/);
    assert.match(contact, /export type PublicContactErrors/);
    assert.match(contact, /export function validatePublicContactRequest/);
    assert.match(contact, /name\.trim\(\)/);
    assert.match(contact, /email\.trim\(\)/);
    assert.match(contact, /message\.trim\(\)/);
    assert.match(contact, /turnstileToken/);
    assert.match(contact, /contactSuccessMessage/);
    assert.match(contact, /contactFormErrorMessage/);
    assert.doesNotMatch(contact, /stack|error-codes|secret|provider|ip address|rate-limit/i);
  });

  it("defines the public contact API route with bot protection and safe routing", () => {
    const route = read("app/api/public/contact/route.ts");

    assert.match(route, /export async function POST/);
    assert.match(route, /validatePublicContactRequest/);
    assert.match(route, /verifyTurnstile/);
    assert.match(route, /routePublicContactRequest/);
    assert.match(route, /Response\.json/);
    assert.match(route, /ok: true/);
    assert.match(route, /turnstileToken/);
    assert.doesNotMatch(route, /@\/server\/(services|queries)/);
    assert.doesNotMatch(route, /supabase|stripe|payment|document|resident|property|board|admin/i);
  });

  it("defines server-only Turnstile and contact routing helpers", () => {
    const turnstile = read("server/public/turnstile.ts");
    const routing = read("server/public/contact-routing.ts");

    assert.match(turnstile, /import "server-only"/);
    assert.match(turnstile, /export async function verifyTurnstile/);
    assert.match(turnstile, /TURNSTILE_SECRET_KEY/);
    assert.match(turnstile, /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/);
    assert.match(turnstile, /timeout-or-duplicate/);
    assert.match(routing, /import "server-only"/);
    assert.match(routing, /export async function routePublicContactRequest/);
    assert.match(routing, /CONTACT_TO_EMAIL/);
    assert.match(routing, /process\.env\.NODE_ENV === "production"[\s\S]*?return \{ ok: false \}/);
    assert.doesNotMatch(`${turnstile}\n${routing}`, /@\/server\/(services|queries)/);
    assert.doesNotMatch(`${turnstile}\n${routing}`, /supabase|stripe|payment|document|resident|property|board|admin/i);
  });

  it("keeps public contact files privacy-safe", () => {
    const files = [
      read("app/(public)/contact/page.tsx"),
      read("components/public/contact-form.tsx"),
      read("lib/public/contact.ts"),
      read("app/api/public/contact/route.ts"),
      read("server/public/turnstile.ts"),
      read("server/public/contact-routing.ts"),
    ].join("\n");

    assert.doesNotMatch(files, /from\s+["']@\/server\/(services|queries)/);
    assert.doesNotMatch(
      files,
      /account number|property address|dues balance|owner name|payment history|private documents|resident contact data|board-only|admin-only|private workflow|stack trace|turnstile failure code/i,
    );
  });

  it("renders the public Pay Dues entry page instead of the placeholder", () => {
    const page = read("app/(public)/pay-dues/page.tsx");

    assert.match(page, /Pay Dues/);
    assert.match(page, /publicPaymentSettings/);
    assert.match(page, /paymentEntryRoutes/);
    assert.match(page, /\{entryState\.primaryLabel\}/);
    assert.match(page, /aria-label=\{entryState\.primaryLabel\}/);
    assert.match(page, /Contact the HOA about dues/);
    assert.doesNotMatch(page, /<PlaceholderPage/);
  });

  it("defines public-safe payment entry configuration", () => {
    const payments = read("lib/public/payments.ts");

    assert.match(payments, /export type PublicPaymentSettings/);
    assert.match(payments, /export const paymentEntryRoutes/);
    assert.match(payments, /lookup: "\/pay-dues\/lookup"/);
    assert.match(payments, /contact: "\/contact"/);
    assert.match(payments, /guestPaymentsEnabled: true/);
    assert.match(payments, /"Start guest payment lookup"/);
    assert.match(payments, /export function getPublicPaymentEntryState/);
    assert.match(payments, /export function getDisabledPaymentGuidance/);
    assert.doesNotMatch(payments, /process\.env|NEXT_PUBLIC|STRIPE|SUPABASE/);
  });

  it("defines a real public guest payment lookup entry without Stripe processing", () => {
    const lookup = read("app/(public)/pay-dues/lookup/page.tsx");

    assert.match(lookup, /Guest payment lookup/);
    assert.match(lookup, /GuestPaymentLookupForm/);
    assert.match(lookup, /NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
    assert.match(lookup, /publicPaymentSettings\.communitySlug/);
    assert.match(lookup, /Contact the HOA about dues/);
    assert.doesNotMatch(lookup, /fetch\(|action=|create-session|checkoutUrl|PaymentIntent|Checkout/);
    assert.doesNotMatch(lookup, /readOnly|aria-disabled|being prepared|disabled/);
  });

  it("keeps public payment lookup privacy-safe and isolated from payment sessions", () => {
    const files = [
      read("app/(public)/pay-dues/page.tsx"),
      read("app/(public)/pay-dues/lookup/page.tsx"),
      read("lib/public/payments.ts"),
      read("components/public/guest-payment-lookup-form.tsx"),
      read("lib/public/guest-payment-lookup.ts"),
      read("app/api/guest-payments/lookup/route.ts"),
    ].join("\n");

    assert.doesNotMatch(files, /from\s+["']@\/server\/(actions|queries|payments)/);
    assert.doesNotMatch(files, /stripe|createPayment|createSession|paymentIntent|checkoutUrl/i);
    assert.doesNotMatch(
      files,
      /owner name|dues balance|payment history|private documents|resident contact data|board-only|admin-only|property exists|account exists/i,
    );
    assert.ok(existsSync(join(root, "app/api/guest-payments/lookup/route.ts")));
    assert.ok(existsSync(join(root, "app/api/guest-payments/create-session/route.ts")));
  });

  it("defines public-safe vendor proposal placeholder configuration", () => {
    const vendor = read("lib/public/vendor-proposals.ts");

    assert.match(vendor, /export type PublicVendorProposalSettings/);
    assert.match(vendor, /export const vendorProposalRoutes/);
    assert.match(vendor, /placeholder: "\/vendors"/);
    assert.match(vendor, /futureProposal: "\/vendors\/proposals"/);
    assert.match(vendor, /contact: "\/contact"/);
    assert.match(vendor, /proposalIntakeEnabled: false/);
    assert.match(vendor, /export function getVendorProposalPlaceholderState/);
    assert.doesNotMatch(vendor, /process\.env|NEXT_PUBLIC|SUPABASE|STRIPE/);
  });

  it("renders the public vendor proposal placeholder with contact fallback", () => {
    const page = read("app/(public)/vendors/page.tsx");

    assert.match(page, /Vendor proposal intake/);
    assert.match(page, /vendorProposalSettings/);
    assert.match(page, /getVendorProposalPlaceholderState/);
    assert.match(page, /Contact the HOA about vendor services/);
    assert.match(page, /aria-label=\{placeholderState\.primaryLabel\}/);
    assert.doesNotMatch(page, /<PlaceholderPage/);
    assert.doesNotMatch(page, /<form|name="vendorName"|name="workCategory"|type="file"|upload/i);
  });

  it("keeps vendor inquiries on the existing public contact path", () => {
    const contactPage = read("app/(public)/contact/page.tsx");
    const contactRoute = read("app/api/public/contact/route.ts");
    const routeFiles = listFiles("app").filter((path) => path.endsWith("/route.ts"));

    assert.match(contactPage, /vendor services/i);
    assert.match(contactPage, /general public contact request/i);
    assert.match(contactPage, /does not create portal access/i);
    assert.match(contactPage, /ContactForm/);
    assert.match(contactRoute, /export async function POST/);
    assert.ok(!existsSync(join(root, "app/api/public/vendor-proposals/route.ts")));
    assert.ok(!existsSync(join(root, "app/api/vendors/proposals/route.ts")));

    for (const route of routeFiles) {
      assert.doesNotMatch(
        route,
        /vendor|proposal|upload|invoice|portal|admin\/vendors|board\/vendors/i,
      );
    }
  });

  it("keeps public vendor placeholder files privacy-safe and non-mutating", () => {
    const files = [
      read("app/(public)/vendors/page.tsx"),
      read("app/(public)/contact/page.tsx"),
      read("lib/public/vendor-proposals.ts"),
    ].join("\n");
    const implementationFiles = listFiles("app")
      .concat(listFiles("server"), listFiles("lib"))
      .filter((path) => !path.endsWith(".gitkeep"));

    assert.doesNotMatch(files, /from\s+["']@\/server\/(services|queries|actions|vendors|admin|documents|payments)/);
    assert.doesNotMatch(files, /supabase|stripe|createVendor|submitProposal|upload|invoice|contract|payment detail/i);
    assert.doesNotMatch(files, /board-only|admin-only|private documents|portal access granted|approved vendor record/i);
    assert.ok(!existsSync(join(root, "app/(public)/vendors/proposals/page.tsx")));
    assert.ok(!existsSync(join(root, "app/(public)/vendor-portal/page.tsx")));
    assert.ok(!existsSync(join(root, "app/(admin)/vendors/page.tsx")));

    for (const path of implementationFiles) {
      assert.doesNotMatch(
        path,
        /vendor-(portal|upload|invoice)|vendor\/(portal|uploads|invoices)|vendors\/(proposals|uploads|invoices|portal)|admin\/vendors|board\/vendors|server\/(vendors|vendor|services\/vendors|services\/vendor)|server\/.*vendor.*(invoice|upload|proposal)/i,
      );
    }
  });
});
