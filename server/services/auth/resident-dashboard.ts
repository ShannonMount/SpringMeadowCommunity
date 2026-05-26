import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  listAnnouncements,
  type AnnouncementRecord,
} from "@/server/services/announcements/announcement-management";
import { type CurrentProfile } from "@/server/services/auth/current-profile";
import {
  PROPERTY_MEMBERSHIP_UNAVAILABLE_MESSAGE,
  type PropertyMembership,
} from "@/server/services/auth/property-memberships";
import { getResidentPortalMemberships } from "@/server/services/auth/resident-portal";
import { listEvents, type EventRecord } from "@/server/services/events/event-management";

const ACTIVE_PROPERTY_STATUS = "active";
const DASHBOARD_ANNOUNCEMENT_LIMIT = 3;
const DASHBOARD_EVENT_LIMIT = 3;
const DASHBOARD_UNAVAILABLE_MESSAGE =
  "Dashboard information is temporarily unavailable. Please try again later.";

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

export type DashboardAnnouncement = {
  id: string;
  title: string;
  summary: string;
  publishAt: string;
  pinned: boolean;
};

export type DashboardEvent = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  location: string | null;
};

export type DashboardPropertySummary = {
  membershipId: string;
  propertyId: string;
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
};

export type ResidentDashboardResult =
  | {
      kind: "dashboard";
      profile: CurrentProfile;
      properties: DashboardPropertySummary[];
      announcements: DashboardAnnouncement[];
      upcomingEvents: DashboardEvent[];
    }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: string }
  | { kind: "no-active-membership"; message: typeof PROPERTY_MEMBERSHIP_UNAVAILABLE_MESSAGE }
  | { kind: "dashboard-error"; message: typeof DASHBOARD_UNAVAILABLE_MESSAGE };

function rowKey(communityId: string, propertyId: string) {
  return `${communityId}:${propertyId}`;
}

function toDashboardPropertySummary(
  membership: PropertyMembership,
  row: PropertySummaryRow | undefined,
): DashboardPropertySummary {
  const canViewBalance = membership.membershipPermissions.canViewBalance;

  return {
    membershipId: membership.id,
    propertyId: membership.property.id,
    addressLine1: membership.property.addressLine1,
    addressLine2: membership.property.addressLine2,
    city: membership.property.city,
    state: membership.property.state,
    postalCode: membership.property.postalCode,
    maskedAccountNumber: membership.property.maskedAccountNumber,
    relationship: membership.relationship,
    canViewBalance,
    canPayDues: membership.membershipPermissions.canPayDues,
    duesStatus: canViewBalance ? (row?.delinquency_status ?? "unavailable") : "unavailable",
    currentBalanceCents: canViewBalance ? row?.current_balance_cents ?? null : null,
    nextDueDate: canViewBalance ? row?.next_due_date ?? null : null,
    lastPaymentAt: canViewBalance ? row?.last_payment_at ?? null : null,
  };
}

function toDashboardAnnouncement(record: AnnouncementRecord): DashboardAnnouncement {
  return {
    id: record.id,
    title: record.title,
    summary: record.body,
    publishAt: record.publishAt,
    pinned: record.pinned,
  };
}

function mergeAnnouncementRecords(groups: AnnouncementRecord[][]) {
  const recordsById = new Map<string, AnnouncementRecord>();

  for (const records of groups) {
    for (const record of records) {
      recordsById.set(record.id, record);
    }
  }

  return Array.from(recordsById.values()).sort((first, second) => {
    if (first.pinned !== second.pinned) {
      return first.pinned ? -1 : 1;
    }

    return new Date(second.publishAt).getTime() - new Date(first.publishAt).getTime();
  });
}

function mergeEventRecords(groups: EventRecord[][]) {
  const recordsById = new Map<string, EventRecord>();

  for (const records of groups) {
    for (const record of records) {
      recordsById.set(record.id, record);
    }
  }

  return Array.from(recordsById.values()).sort(
    (first, second) => new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime(),
  );
}

function toDashboardEvent(record: EventRecord): DashboardEvent {
  return {
    id: record.id,
    title: record.title,
    description: record.description ?? "",
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    allDay: record.allDay,
    location: record.location,
  };
}

export async function getResidentDashboardSummary(): Promise<ResidentDashboardResult> {
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
  const propertyIds = memberships.map((membership) => membership.property.id);
  const communityIds = Array.from(
    new Set(memberships.map((membership) => membership.property.communityId)),
  );

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select("id, community_id, current_balance_cents, next_due_date, last_payment_at, delinquency_status")
    .in("id", propertyIds)
    .in("community_id", communityIds)
    .eq("status", ACTIVE_PROPERTY_STATUS)
    .is("deleted_at", null)
    .returns<PropertySummaryRow[]>();

  if (error) {
    return { kind: "dashboard-error", message: DASHBOARD_UNAVAILABLE_MESSAGE };
  }

  const propertyRows = new Map(
    (data ?? []).map((row) => [rowKey(row.community_id, row.id), row] as const),
  );
  const [
    publicAnnouncements,
    residentAnnouncements,
    publicEventResult,
    residentEventResult,
    ...propertyAnnouncementResults
  ] =
    await Promise.all([
      listAnnouncements({
        visibility: "public",
        status: "published",
        currentOnly: true,
        pageSize: DASHBOARD_ANNOUNCEMENT_LIMIT,
        pageOffset: 0,
      }),
      listAnnouncements({
        visibility: "resident",
        status: "published",
        currentOnly: true,
        pageSize: DASHBOARD_ANNOUNCEMENT_LIMIT,
        pageOffset: 0,
      }),
      listEvents({
        visibility: "public",
        status: "scheduled",
        includeArchived: false,
        upcomingOnly: true,
        pageSize: DASHBOARD_EVENT_LIMIT,
        pageOffset: 0,
      }),
      listEvents({
        visibility: "resident",
        status: "scheduled",
        includeArchived: false,
        upcomingOnly: true,
        pageSize: DASHBOARD_EVENT_LIMIT,
        pageOffset: 0,
      }),
      ...propertyIds.map((propertyId) =>
        listAnnouncements({
          visibility: "property_specific",
          status: "published",
          propertyId,
          currentOnly: true,
          pageSize: DASHBOARD_ANNOUNCEMENT_LIMIT,
          pageOffset: 0,
        }),
      ),
    ]);
  const dashboardAnnouncements = mergeAnnouncementRecords([
    publicAnnouncements.kind === "records" ? publicAnnouncements.records : [],
    residentAnnouncements.kind === "records" ? residentAnnouncements.records : [],
    ...propertyAnnouncementResults.map((result) => (result.kind === "records" ? result.records : [])),
  ])
    .slice(0, DASHBOARD_ANNOUNCEMENT_LIMIT)
    .map(toDashboardAnnouncement);
  const dashboardEvents = mergeEventRecords([
    publicEventResult.kind === "records" ? publicEventResult.records : [],
    residentEventResult.kind === "records" ? residentEventResult.records : [],
  ])
    .slice(0, DASHBOARD_EVENT_LIMIT)
    .map(toDashboardEvent);

  return {
    kind: "dashboard",
    profile,
    properties: memberships.map((membership) =>
      toDashboardPropertySummary(
        membership,
        propertyRows.get(rowKey(membership.property.communityId, membership.property.id)),
      ),
    ),
    announcements: dashboardAnnouncements,
    upcomingEvents: dashboardEvents,
  };
}
