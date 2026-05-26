import "server-only";

import { createClient } from "@/lib/supabase/server";
import { type CurrentProfile } from "@/server/services/auth/current-profile";
import {
  PROPERTY_MEMBERSHIP_UNAVAILABLE_MESSAGE,
  type PropertyMembership,
} from "@/server/services/auth/property-memberships";
import { getResidentPortalMemberships } from "@/server/services/auth/resident-portal";

const ACTIVE_PROPERTY_STATUS = "active";
const DUES_UNAVAILABLE_MESSAGE =
  "Dues and payment history are unavailable. Please contact the HOA for help.";
const POSTED_PAYMENT_STATUSES = ["succeeded", "refunded", "partially_refunded"];
const OPEN_ASSESSMENT_STATUSES = ["open", "partially_paid", "overdue", "disputed"];
const PAYMENT_HISTORY_LIMIT_PER_PROPERTY = 10;

type PropertyDuesStatus =
  | "current"
  | "due_soon"
  | "overdue"
  | "delinquent"
  | "lien_review"
  | "disputed"
  | "unavailable";

type PropertySummaryRow = {
  id: string;
  community_id: string;
  current_balance_cents: number;
  next_due_date: string | null;
  last_payment_at: string | null;
  delinquency_status: Exclude<PropertyDuesStatus, "unavailable">;
};

type AssessmentRow = {
  id: string;
  community_id: string;
  property_id: string;
  type:
    | "regular_dues"
    | "special_assessment"
    | "late_fee"
    | "interest"
    | "fine"
    | "damage_assessment"
    | "manual_adjustment";
  description: string;
  amount_cents: number;
  paid_cents: number;
  balance_cents: number;
  due_date: string;
  status: "open" | "partially_paid" | "overdue" | "disputed";
};

type PaymentRow = {
  id: string;
  community_id: string;
  property_id: string;
  amount_cents: number;
  currency: "USD";
  method: "card" | "ach" | "check" | "cash" | "manual" | "other";
  status: "succeeded" | "refunded" | "partially_refunded";
  payer_type: "resident" | "guest" | "admin_recorded";
  paid_at: string | null;
  receipt_number: string | null;
  created_at: string;
  resident_history_rank: number;
};

export type ResidentAssessmentSummary = {
  id: string;
  description: string;
  type: AssessmentRow["type"];
  amountCents: number;
  paidCents: number;
  balanceCents: number;
  dueDate: string;
  status: AssessmentRow["status"];
};

export type ResidentPaymentSummary = {
  id: string;
  amountCents: number;
  currency: "USD";
  method: PaymentRow["method"];
  status: PaymentRow["status"];
  payerType: PaymentRow["payer_type"];
  paidAt: string | null;
  receiptNumber: string | null;
};

export type ResidentDuesProperty = {
  membershipId: string;
  propertyId: string;
  communityId: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  maskedAccountNumber: string;
  relationship: PropertyMembership["relationship"];
  canViewBalance: boolean;
  canPayDues: boolean;
  duesStatus: PropertyDuesStatus;
  currentBalanceCents: number | null;
  nextDueDate: string | null;
  lastPaymentAt: string | null;
  openAssessments: ResidentAssessmentSummary[];
  paymentHistory: ResidentPaymentSummary[];
};

export type ResidentDuesResult =
  | {
      kind: "resident-dues";
      profile: CurrentProfile;
      properties: ResidentDuesProperty[];
    }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: string }
  | { kind: "no-active-membership"; message: typeof PROPERTY_MEMBERSHIP_UNAVAILABLE_MESSAGE }
  | { kind: "dues-unavailable"; message: typeof DUES_UNAVAILABLE_MESSAGE };

function propertyKey(communityId: string, propertyId: string) {
  return `${communityId}:${propertyId}`;
}

function assessmentSummary(row: AssessmentRow): ResidentAssessmentSummary {
  return {
    id: row.id,
    description: row.description,
    type: row.type,
    amountCents: row.amount_cents,
    paidCents: row.paid_cents,
    balanceCents: row.balance_cents,
    dueDate: row.due_date,
    status: row.status,
  };
}

function paymentSummary(row: PaymentRow): ResidentPaymentSummary {
  return {
    id: row.id,
    amountCents: row.amount_cents,
    currency: row.currency,
    method: row.method,
    status: row.status,
    payerType: row.payer_type,
    paidAt: row.paid_at,
    receiptNumber: row.receipt_number,
  };
}

function groupRowsByProperty<T extends { community_id: string; property_id: string }>(
  rows: T[] | null,
) {
  const grouped = new Map<string, T[]>();

  for (const row of rows ?? []) {
    const key = propertyKey(row.community_id, row.property_id);
    const existing = grouped.get(key) ?? [];

    existing.push(row);
    grouped.set(key, existing);
  }

  return grouped;
}

function toResidentDuesProperty(input: {
  membership: PropertyMembership;
  propertyRow: PropertySummaryRow | undefined;
  assessmentRowsByProperty: Map<string, ResidentAssessmentSummary[]>;
  paymentRowsByProperty: Map<string, ResidentPaymentSummary[]>;
}): ResidentDuesProperty {
  const { membership, propertyRow, assessmentRowsByProperty, paymentRowsByProperty } = input;
  const canViewBalance = membership.membershipPermissions.canViewBalance;
  const propertyKey = `${membership.property.communityId}:${membership.property.id}`;

  return {
    membershipId: membership.id,
    propertyId: membership.property.id,
    communityId: membership.property.communityId,
    addressLine1: membership.property.addressLine1,
    addressLine2: membership.property.addressLine2,
    city: membership.property.city,
    state: membership.property.state,
    postalCode: membership.property.postalCode,
    maskedAccountNumber: membership.property.maskedAccountNumber,
    relationship: membership.relationship,
    canViewBalance,
    canPayDues: membership.membershipPermissions.canPayDues,
    duesStatus: canViewBalance ? (propertyRow?.delinquency_status ?? "unavailable") : "unavailable",
    currentBalanceCents: canViewBalance ? propertyRow?.current_balance_cents ?? null : null,
    nextDueDate: canViewBalance ? propertyRow?.next_due_date ?? null : null,
    lastPaymentAt: canViewBalance ? propertyRow?.last_payment_at ?? null : null,
    openAssessments: canViewBalance ? assessmentRowsByProperty.get(propertyKey) ?? [] : [],
    paymentHistory: canViewBalance ? paymentRowsByProperty.get(propertyKey) ?? [] : [],
  };
}

export async function getResidentDuesStatus(): Promise<ResidentDuesResult> {
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
  const visibleMemberships = memberships.filter(
    (membership) => membership.membershipPermissions.canViewBalance,
  );
  const visiblePropertyIds = visibleMemberships.map((membership) => membership.property.id);
  const visibleCommunityIds = Array.from(
    new Set(visibleMemberships.map((membership) => membership.property.communityId)),
  );

  let propertyRows = new Map<string, PropertySummaryRow>();
  let assessmentRowsByProperty = new Map<string, ResidentAssessmentSummary[]>();
  let paymentRowsByProperty = new Map<string, ResidentPaymentSummary[]>();

  if (visiblePropertyIds.length > 0) {
    const supabase = await createClient();
    const { data: propertyData, error: propertyError } = await supabase
      .from("properties")
      .select("id, community_id, current_balance_cents, next_due_date, last_payment_at, delinquency_status")
      .in("id", visiblePropertyIds)
      .in("community_id", visibleCommunityIds)
      .eq("status", ACTIVE_PROPERTY_STATUS)
      .is("deleted_at", null)
      .returns<PropertySummaryRow[]>();

    if (propertyError) {
      return { kind: "dues-unavailable", message: DUES_UNAVAILABLE_MESSAGE };
    }

    const { data: assessmentData, error: assessmentError } = await supabase
      .from("assessments")
      .select("id, community_id, property_id, type, description, amount_cents, paid_cents, balance_cents, due_date, status")
      .in("property_id", visiblePropertyIds)
      .in("community_id", visibleCommunityIds)
      .in("status", OPEN_ASSESSMENT_STATUSES)
      .order("due_date", { ascending: true })
      .returns<AssessmentRow[]>();

    if (assessmentError) {
      return { kind: "dues-unavailable", message: DUES_UNAVAILABLE_MESSAGE };
    }

    const { data: paymentData, error: paymentError } = await supabase
      .from("resident_payment_history")
      .select("id, community_id, property_id, amount_cents, currency, method, status, payer_type, paid_at, receipt_number, created_at, resident_history_rank")
      .in("property_id", visiblePropertyIds)
      .in("community_id", visibleCommunityIds)
      .in("status", POSTED_PAYMENT_STATUSES)
      .lte("resident_history_rank", PAYMENT_HISTORY_LIMIT_PER_PROPERTY)
      .order("paid_at", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<PaymentRow[]>();

    if (paymentError) {
      return { kind: "dues-unavailable", message: DUES_UNAVAILABLE_MESSAGE };
    }

    propertyRows = new Map(
      (propertyData ?? []).map((row) => [propertyKey(row.community_id, row.id), row] as const),
    );
    assessmentRowsByProperty = new Map(
      Array.from(groupRowsByProperty(assessmentData)).map(([key, rows]) => [
        key,
        rows.map(assessmentSummary),
      ]),
    );
    paymentRowsByProperty = new Map(
      Array.from(groupRowsByProperty(paymentData)).map(([key, rows]) => [
        key,
        rows.map(paymentSummary),
      ]),
    );
  }

  return {
    kind: "resident-dues",
    profile,
    properties: memberships.map((membership) =>
      toResidentDuesProperty({
        membership,
        propertyRow: propertyRows.get(
          propertyKey(membership.property.communityId, membership.property.id),
        ),
        assessmentRowsByProperty,
        paymentRowsByProperty,
      }),
    ),
  };
}
