import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("resident property detail view", () => {
  it("renders My Property through a resident property detail service", () => {
    const pagePath = "app/(resident)/portal/(member)/my-property/page.tsx";
    const directPagePath = "app/(resident)/portal/(member)/my-property/[propertyId]/page.tsx";
    const viewPath = "components/resident/resident-property-detail-view.tsx";

    assert.ok(existsSync(join(root, pagePath)));
    assert.ok(existsSync(join(root, directPagePath)));
    assert.ok(existsSync(join(root, viewPath)));

    const page = read(pagePath);
    const directPage = read(directPagePath);
    const view = read(viewPath);

    assert.match(page, /getResidentPropertyDetails/);
    assert.match(directPage, /getResidentPropertyDetails\(propertyId\)/);
    assert.match(view, /My Property/);
    assert.match(view, /Property details unavailable/);
    assert.match(view, /maskedAccountNumber/);
    assert.match(view, /property\.canViewBalance/);
    assert.match(view, /property\.canPayDues/);
    assert.match(view, /property\.canViewDocuments/);
    assert.match(view, /property\.canInviteMembers/);
    assert.match(view, /linkedMemberSummary/);
    assert.match(view, /DATE_ONLY_PATTERN/);
    assert.match(view, /Date\.UTC\(year, month - 1, day, 12\)/);
    assert.doesNotMatch(page, /getResidentPortalMemberships/);
    assert.doesNotMatch(view, /format\(new Date\(value\)\)/);
  });

  it("implements a server-only property detail service with authorization-before-query guards", () => {
    const servicePath = "server/services/auth/resident-property-detail.ts";

    assert.ok(existsSync(join(root, servicePath)));

    const service = read(servicePath);
    const unauthorizedGuardIndex = service.indexOf(
      "requestedPropertyId && !authorizedPropertyIds.includes(requestedPropertyId)",
    );
    const propertyQueryIndex = service.indexOf('.from("properties")');

    assert.match(service, /import "server-only"/);
    assert.match(service, /getResidentPortalMemberships/);
    assert.match(service, /getResidentPropertyDetails/);
    assert.ok(unauthorizedGuardIndex >= 0);
    assert.ok(propertyQueryIndex >= 0);
    assert.ok(unauthorizedGuardIndex < propertyQueryIndex);
    assert.match(service, /property-unavailable/);
    assert.match(service, /\.from\("properties"\)/);
    assert.match(service, /\.in\("id", queryPropertyIds\)/);
    assert.match(service, /\.in\("community_id", communityIds\)/);
    assert.match(service, /\.eq\("status", ACTIVE_PROPERTY_STATUS\)/);
    assert.match(service, /\.is\("deleted_at", null\)/);

    for (const field of [
      "address_line1",
      "address_line2",
      "city",
      "state",
      "postal_code",
      "county",
      "lot_number",
      "parcel_number",
      "plat_reference",
      "current_balance_cents",
      "next_due_date",
      "last_payment_at",
      "delinquency_status",
    ]) {
      assert.match(service, new RegExp(field));
    }

    assert.doesNotMatch(
      service,
      /owner_display_name|account_number|public_payment_code|mailing_address|payment history|private documents|message contents|invitation_tokens|SERVICE_ROLE|service_role|error\.message/i,
    );
  });

  it("gates resident-facing fields and actions by membership permissions", () => {
    const service = read("server/services/auth/resident-property-detail.ts");
    const view = read("components/resident/resident-property-detail-view.tsx");
    const combined = `${service}\n${view}`;

    assert.match(service, /currentBalanceCents:\s*canViewBalance \? row\.current_balance_cents : null/);
    assert.match(service, /nextDueDate:\s*canViewBalance \? row\.next_due_date : null/);
    assert.match(service, /lastPaymentAt:\s*canViewBalance \? row\.last_payment_at : null/);
    assert.match(service, /duesStatus:\s*canViewBalance \? row\.delinquency_status : "unavailable"/);
    assert.match(service, /displayName:\s*"Current resident"/);
    assert.doesNotMatch(service, /displayName:\s*profile\.displayName/);
    assert.match(view, /property\.canPayDues \?/);
    assert.match(view, /property\.canViewDocuments \?/);
    assert.match(view, /property\.canInviteMembers \?/);
    assert.match(view, /property\.canViewBalance \?/);

    assert.doesNotMatch(
      combined,
      /email|phone|authUserId|auth_user_id|profileId|profile_id|can_view_balance|can_pay_dues|can_view_documents|can_invite_members|invited_at|removed_at|suspended|SERVICE_ROLE|service_role/i,
    );
  });
});
