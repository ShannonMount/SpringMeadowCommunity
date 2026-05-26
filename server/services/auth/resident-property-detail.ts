import "server-only";

import { createClient } from "@/lib/supabase/server";
import { type CurrentProfile } from "@/server/services/auth/current-profile";
import {
  PROPERTY_MEMBERSHIP_UNAVAILABLE_MESSAGE,
  type PropertyMembership,
} from "@/server/services/auth/property-memberships";
import { getResidentPortalMemberships } from "@/server/services/auth/resident-portal";

const ACTIVE_PROPERTY_STATUS = "active";
const PROPERTY_DETAIL_UNAVAILABLE_MESSAGE =
  "Property details are unavailable. Please contact the HOA for help.";

type PropertyDuesStatus =
  | "current"
  | "due_soon"
  | "overdue"
  | "delinquent"
  | "lien_review"
  | "disputed"
  | "unavailable";

type PropertyDetailRow = {
  id: string;
  community_id: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  county: string | null;
  lot_number: string | null;
  parcel_number: string | null;
  plat_reference: string | null;
  current_balance_cents: number;
  next_due_date: string | null;
  last_payment_at: string | null;
  delinquency_status: Exclude<PropertyDuesStatus, "unavailable">;
};

export type ResidentPropertyDetail = {
  membershipId: string;
  propertyId: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  county: string | null;
  lotNumber: string | null;
  parcelNumber: string | null;
  platReference: string | null;
  maskedAccountNumber: string;
  relationship: PropertyMembership["relationship"];
  canViewBalance: boolean;
  canPayDues: boolean;
  canViewDocuments: boolean;
  canInviteMembers: boolean;
  duesStatus: PropertyDuesStatus;
  currentBalanceCents: number | null;
  nextDueDate: string | null;
  lastPaymentAt: string | null;
  linkedMemberSummary: {
    currentResidentRelationship: PropertyMembership["relationship"];
    memberManagementAvailable: boolean;
    displayMembers: {
      displayName: string;
      relationship: PropertyMembership["relationship"];
    }[];
  };
};

export type ResidentPropertyDetailResult =
  | {
      kind: "property-details";
      profile: CurrentProfile;
      properties: ResidentPropertyDetail[];
    }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: string }
  | { kind: "no-active-membership"; message: typeof PROPERTY_MEMBERSHIP_UNAVAILABLE_MESSAGE }
  | { kind: "property-unavailable"; message: typeof PROPERTY_DETAIL_UNAVAILABLE_MESSAGE }
  | { kind: "property-detail-error"; message: typeof PROPERTY_DETAIL_UNAVAILABLE_MESSAGE };

function rowKey(communityId: string, propertyId: string) {
  return `${communityId}:${propertyId}`;
}

function toResidentPropertyDetail(
  _profile: CurrentProfile,
  membership: PropertyMembership,
  row: PropertyDetailRow,
): ResidentPropertyDetail {
  const canViewBalance = membership.membershipPermissions.canViewBalance;

  return {
    membershipId: membership.id,
    propertyId: membership.property.id,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    county: row.county,
    lotNumber: row.lot_number,
    parcelNumber: row.parcel_number,
    platReference: row.plat_reference,
    maskedAccountNumber: membership.property.maskedAccountNumber,
    relationship: membership.relationship,
    canViewBalance,
    canPayDues: membership.membershipPermissions.canPayDues,
    canViewDocuments: membership.membershipPermissions.canViewDocuments,
    canInviteMembers: membership.membershipPermissions.canInviteMembers,
    duesStatus: canViewBalance ? row.delinquency_status : "unavailable",
    currentBalanceCents: canViewBalance ? row.current_balance_cents : null,
    nextDueDate: canViewBalance ? row.next_due_date : null,
    lastPaymentAt: canViewBalance ? row.last_payment_at : null,
    linkedMemberSummary: {
      currentResidentRelationship: membership.relationship,
      memberManagementAvailable: membership.membershipPermissions.canInviteMembers,
      displayMembers: [
        {
          displayName: "Current resident",
          relationship: membership.relationship,
        },
      ],
    },
  };
}

export async function getResidentPropertyDetails(
  requestedPropertyId?: string,
): Promise<ResidentPropertyDetailResult> {
  const membershipResult = await getResidentPortalMemberships();

  if (membershipResult.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (membershipResult.kind === "profile-unavailable") {
    return { kind: "profile-unavailable", message: membershipResult.message };
  }

  if (membershipResult.kind !== "active-memberships") {
    return { kind: "no-active-membership", message: PROPERTY_MEMBERSHIP_UNAVAILABLE_MESSAGE };
  }

  const { profile, memberships } = membershipResult;
  const authorizedPropertyIds = memberships.map((membership) => membership.property.id);

  if (requestedPropertyId && !authorizedPropertyIds.includes(requestedPropertyId)) {
    return { kind: "property-unavailable", message: PROPERTY_DETAIL_UNAVAILABLE_MESSAGE };
  }

  const targetMemberships = requestedPropertyId
    ? memberships.filter((membership) => membership.property.id === requestedPropertyId)
    : memberships;
  const queryPropertyIds = targetMemberships.map((membership) => membership.property.id);
  const communityIds = Array.from(
    new Set(targetMemberships.map((membership) => membership.property.communityId)),
  );

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, community_id, address_line1, address_line2, city, state, postal_code, county, lot_number, parcel_number, plat_reference, current_balance_cents, next_due_date, last_payment_at, delinquency_status",
    )
    .in("id", queryPropertyIds)
    .in("community_id", communityIds)
    .eq("status", ACTIVE_PROPERTY_STATUS)
    .is("deleted_at", null)
    .returns<PropertyDetailRow[]>();

  if (error) {
    return { kind: "property-detail-error", message: PROPERTY_DETAIL_UNAVAILABLE_MESSAGE };
  }

  const propertyRows = new Map(
    (data ?? []).map((row) => [rowKey(row.community_id, row.id), row] as const),
  );

  const properties = targetMemberships
    .map((membership) => {
      const row = propertyRows.get(rowKey(membership.property.communityId, membership.property.id));

      return row ? toResidentPropertyDetail(profile, membership, row) : null;
    })
    .filter((property): property is ResidentPropertyDetail => Boolean(property));

  if (properties.length === 0) {
    return { kind: "property-unavailable", message: PROPERTY_DETAIL_UNAVAILABLE_MESSAGE };
  }

  return {
    kind: "property-details",
    profile,
    properties,
  };
}
