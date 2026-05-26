import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  getCurrentProfile,
  PROFILE_UNAVAILABLE_MESSAGE,
  type CurrentProfile,
} from "@/server/services/auth/current-profile";

export const PROPERTY_MEMBERSHIP_UNAVAILABLE_MESSAGE =
  "Your resident account is not linked to an active property. Please contact the HOA for help.";

type MembershipRelationship =
  | "owner"
  | "co_owner"
  | "resident"
  | "renter"
  | "manager"
  | "family"
  | "other";

type MembershipRow = {
  id: string;
  community_id: string;
  property_id: string;
  relationship: MembershipRelationship;
  can_view_balance: boolean;
  can_pay_dues: boolean;
  can_view_documents: boolean;
  can_invite_members: boolean;
  properties:
    | {
        id: string;
        community_id: string;
        account_number: string;
        address_line1: string;
        address_line2: string | null;
        city: string;
        state: string;
        postal_code: string;
      }
    | {
        id: string;
        community_id: string;
        account_number: string;
        address_line1: string;
        address_line2: string | null;
        city: string;
        state: string;
        postal_code: string;
      }[];
};

export type PropertyMembership = {
  id: string;
  communityId: string;
  relationship: MembershipRelationship;
  membershipPermissions: {
    canViewBalance: boolean;
    canPayDues: boolean;
    canViewDocuments: boolean;
    canInviteMembers: boolean;
  };
  property: {
    id: string;
    communityId: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
    maskedAccountNumber: string;
  };
};

export type CurrentPropertyMembershipsResult =
  | { kind: "active-memberships"; profile: CurrentProfile; memberships: PropertyMembership[] }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "no-active-membership"; message: typeof PROPERTY_MEMBERSHIP_UNAVAILABLE_MESSAGE }
  | { kind: "property-membership-error"; message: typeof PROPERTY_MEMBERSHIP_UNAVAILABLE_MESSAGE };

const ACTIVE_MEMBERSHIP_STATUS = "active";
const ACTIVE_PROPERTY_STATUS = "active";

function maskAccountNumber(accountNumber: string) {
  if (accountNumber.length <= 4) {
    return "****";
  }

  return `****${accountNumber.slice(-4)}`;
}

function normalizeProperty(property: MembershipRow["properties"]) {
  return Array.isArray(property) ? property[0] : property;
}

function toPropertyMembership(row: MembershipRow): PropertyMembership | null {
  const property = normalizeProperty(row.properties);

  if (!property) {
    return null;
  }

  return {
    id: row.id,
    communityId: row.community_id,
    relationship: row.relationship,
    membershipPermissions: {
      canViewBalance: row.can_view_balance,
      canPayDues: row.can_pay_dues,
      canViewDocuments: row.can_view_documents,
      canInviteMembers: row.can_invite_members,
    },
    property: {
      id: property.id,
      communityId: property.community_id,
      addressLine1: property.address_line1,
      addressLine2: property.address_line2,
      city: property.city,
      state: property.state,
      postalCode: property.postal_code,
      maskedAccountNumber: maskAccountNumber(property.account_number),
    },
  };
}

export async function getCurrentPropertyMemberships(): Promise<CurrentPropertyMembershipsResult> {
  const profileResult = await getCurrentProfile();

  if (profileResult.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (profileResult.kind !== "active-profile") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("property_memberships")
    .select(
      "id, community_id, property_id, relationship, can_view_balance, can_pay_dues, can_view_documents, can_invite_members, properties!inner(id, community_id, account_number, address_line1, address_line2, city, state, postal_code)",
    )
    .eq("profile_id", profileResult.profile.id)
    .eq("status", ACTIVE_MEMBERSHIP_STATUS)
    .eq("properties.status", ACTIVE_PROPERTY_STATUS)
    .is("properties.deleted_at", null)
    .order("created_at", { ascending: true })
    .returns<MembershipRow[]>();

  if (error) {
    return { kind: "property-membership-error", message: PROPERTY_MEMBERSHIP_UNAVAILABLE_MESSAGE };
  }

  const memberships = (data ?? [])
    .map((membership) => toPropertyMembership(membership))
    .filter((membership): membership is PropertyMembership => Boolean(membership));

  if (memberships.length === 0) {
    return { kind: "no-active-membership", message: PROPERTY_MEMBERSHIP_UNAVAILABLE_MESSAGE };
  }

  return { kind: "active-memberships", profile: profileResult.profile, memberships };
}

export async function canAccessProperty(propertyId: string) {
  const membershipsResult = await getCurrentPropertyMemberships();

  if (membershipsResult.kind !== "active-memberships") {
    return false;
  }

  return membershipsResult.memberships.some((membership) => membership.property.id === propertyId);
}
