import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  getCurrentProfile,
  PROFILE_UNAVAILABLE_MESSAGE,
} from "@/server/services/auth/current-profile";
import { PERMISSION_DENIED_MESSAGE } from "@/server/services/auth/permissions";

const DEFAULT_COMMUNITY_SLUG = "spring-meadow-community";
const EVENTS_UNAVAILABLE_MESSAGE = "Events are temporarily unavailable. Please try again later.";
const INVALID_EVENT_INPUT_MESSAGE = "Please check the event details and try again.";
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_LOCATION_LENGTH = 300;
const MAX_QUERY_LENGTH = 200;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_OFFSET = 10000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EVENT_VISIBILITIES = ["public", "resident", "board", "admin"] as const;
const EVENT_STATUSES = ["scheduled", "cancelled", "completed", "archived"] as const;
const EVENT_TYPES = [
  "hoa_meeting",
  "board_meeting",
  "community_event",
  "pool",
  "maintenance_window",
  "dues_deadline",
  "other",
] as const;

type FieldErrors = Record<string, string[]>;

export type EventVisibility = (typeof EVENT_VISIBILITIES)[number];
export type EventStatus = (typeof EVENT_STATUSES)[number];
export type EventType = (typeof EVENT_TYPES)[number];

export type EventRecord = {
  id: string;
  communityId: string;
  title: string;
  description: string | null;
  type: EventType;
  visibility: EventVisibility;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  location: string | null;
  relatedMeetingId: string | null;
  relatedComplianceEventId: string | null;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
};

export type ListEventsInput = {
  communitySlug?: string | null;
  visibility?: string | null;
  status?: string | null;
  type?: string | null;
  query?: string | null;
  startsFrom?: string | null;
  startsTo?: string | null;
  includeArchived?: boolean | null;
  upcomingOnly?: boolean | null;
  pageSize?: number | null;
  pageOffset?: number | null;
};

export type EventMutationInput = {
  communitySlug?: string | null;
  eventId?: string | null;
  title: string;
  description?: string | null;
  type: string;
  visibility: string;
  startsAt: string | null;
  endsAt?: string | null;
  allDay?: boolean | null;
  location?: string | null;
  relatedMeetingId?: string | null;
  relatedComplianceEventId?: string | null;
  status?: string | null;
};

export type EventLifecycleInput = {
  eventId: string;
};

type EventRpcRow = {
  id?: string | null;
  community_id?: string | null;
  title?: string | null;
  description?: string | null;
  type?: string | null;
  visibility?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  all_day?: boolean | null;
  location?: string | null;
  related_meeting_id?: string | null;
  related_compliance_event_id?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type EventRpcResult = {
  status?:
    | "ok"
    | "created"
    | "updated"
    | "cancelled"
    | "archived"
    | "permission_denied"
    | "invalid"
    | "unavailable";
  record?: EventRpcRow | null;
  before_record?: EventRpcRow | null;
  records?: EventRpcRow[] | null;
};

export type EventResult =
  | { kind: "records"; records: EventRecord[] }
  | { kind: "record"; record: EventRecord }
  | { kind: "created" | "updated" | "cancelled" | "archived"; record: EventRecord }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "permission-denied"; message: typeof PERMISSION_DENIED_MESSAGE }
  | { kind: "invalid-input"; message: typeof INVALID_EVENT_INPUT_MESSAGE; fieldErrors: FieldErrors }
  | { kind: "events-unavailable"; message: typeof EVENTS_UNAVAILABLE_MESSAGE };

type ValidatedListInput =
  | {
      kind: "valid";
      communitySlug: string;
      visibility: EventVisibility | null;
      status: EventStatus | null;
      type: EventType | null;
      query: string | null;
      startsFrom: string | null;
      startsTo: string | null;
      includeArchived: boolean;
      upcomingOnly: boolean;
      pageSize: number;
      pageOffset: number;
    }
  | { kind: "invalid"; fieldErrors: FieldErrors };

type ValidatedMutationInput =
  | {
      kind: "valid";
      communitySlug: string;
      eventId: string | null;
      title: string;
      description: string | null;
      type: EventType;
      visibility: EventVisibility;
      startsAt: string;
      endsAt: string | null;
      allDay: boolean;
      location: string | null;
      relatedMeetingId: string | null;
      relatedComplianceEventId: string | null;
      status: EventStatus;
    }
  | { kind: "invalid"; fieldErrors: FieldErrors };

function safeString(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: string | null | undefined) {
  const trimmed = safeString(value);

  return trimmed || null;
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isVisibility(value: string): value is EventVisibility {
  return EVENT_VISIBILITIES.includes(value as EventVisibility);
}

function isStatus(value: string): value is EventStatus {
  return EVENT_STATUSES.includes(value as EventStatus);
}

function isType(value: string): value is EventType {
  return EVENT_TYPES.includes(value as EventType);
}

function boundedPageSize(value: number | null | undefined) {
  if (!Number.isInteger(value)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.max(Number(value), 1), MAX_PAGE_SIZE);
}

function boundedPageOffset(value: number | null | undefined) {
  if (!Number.isInteger(value)) {
    return 0;
  }

  return Math.min(Math.max(Number(value), 0), MAX_PAGE_OFFSET);
}

function invalid(fieldErrors: FieldErrors): Extract<EventResult, { kind: "invalid-input" }> {
  return { kind: "invalid-input", message: INVALID_EVENT_INPUT_MESSAGE, fieldErrors };
}

function unavailable(): Extract<EventResult, { kind: "events-unavailable" }> {
  return { kind: "events-unavailable", message: EVENTS_UNAVAILABLE_MESSAGE };
}

function normalizeTimestamp(value: string | null | undefined) {
  const trimmed = safeString(value);

  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function addOptionalUuidError(fieldErrors: FieldErrors, fieldName: string, value: string | null) {
  if (value && !isUuid(value)) {
    fieldErrors[fieldName] = ["Use a valid identifier."];
  }
}

function asVisibility(value: string | null | undefined): EventVisibility {
  return isVisibility(value ?? "") ? (value as EventVisibility) : "admin";
}

function asStatus(value: string | null | undefined): EventStatus {
  return isStatus(value ?? "") ? (value as EventStatus) : "scheduled";
}

function asType(value: string | null | undefined): EventType {
  return isType(value ?? "") ? (value as EventType) : "other";
}

function asRecord(row: EventRpcRow): EventRecord {
  return {
    id: row.id ?? "",
    communityId: row.community_id ?? "",
    title: row.title ?? "",
    description: row.description ?? null,
    type: asType(row.type),
    visibility: asVisibility(row.visibility),
    startsAt: row.starts_at ?? "",
    endsAt: row.ends_at ?? null,
    allDay: row.all_day === true,
    location: row.location ?? null,
    relatedMeetingId: row.related_meeting_id ?? null,
    relatedComplianceEventId: row.related_compliance_event_id ?? null,
    status: asStatus(row.status),
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

function validateListInput(input: ListEventsInput = {}): ValidatedListInput {
  const fieldErrors: FieldErrors = {};
  const visibility = optionalString(input.visibility);
  const status = optionalString(input.status);
  const type = optionalString(input.type);
  const query = safeString(input.query);
  const startsFrom = normalizeTimestamp(input.startsFrom);
  const startsTo = normalizeTimestamp(input.startsTo);

  if (visibility && !isVisibility(visibility)) {
    fieldErrors.visibility = ["Choose a valid visibility."];
  }

  if (status && !isStatus(status)) {
    fieldErrors.status = ["Choose a valid status."];
  }

  if (type && !isType(type)) {
    fieldErrors.type = ["Choose a valid event type."];
  }

  if (query.length > MAX_QUERY_LENGTH) {
    fieldErrors.query = ["Search is too long."];
  }

  if (safeString(input.startsFrom) && !startsFrom) {
    fieldErrors.startsFrom = ["Enter a valid start date."];
  }

  if (safeString(input.startsTo) && !startsTo) {
    fieldErrors.startsTo = ["Enter a valid end date."];
  }

  if (startsFrom && startsTo && new Date(startsTo) < new Date(startsFrom)) {
    fieldErrors.startsTo = ["End date must be after the start date."];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { kind: "invalid", fieldErrors };
  }

  return {
    kind: "valid",
    communitySlug: optionalString(input.communitySlug) ?? DEFAULT_COMMUNITY_SLUG,
    visibility: visibility as EventVisibility | null,
    status: status as EventStatus | null,
    type: type as EventType | null,
    query: query || null,
    startsFrom,
    startsTo,
    includeArchived: input.includeArchived === true,
    upcomingOnly: input.upcomingOnly === true,
    pageSize: boundedPageSize(input.pageSize),
    pageOffset: boundedPageOffset(input.pageOffset),
  };
}

function validateMutationInput(input: EventMutationInput, requireId = false): ValidatedMutationInput {
  const fieldErrors: FieldErrors = {};
  const title = safeString(input.title);
  const description = optionalString(input.description);
  const type = safeString(input.type);
  const visibility = safeString(input.visibility);
  const status = optionalString(input.status) ?? "scheduled";
  const eventId = optionalString(input.eventId);
  const startsAt = normalizeTimestamp(input.startsAt);
  const endsAt = normalizeTimestamp(input.endsAt);
  const location = optionalString(input.location);
  const relatedMeetingId = optionalString(input.relatedMeetingId);
  const relatedComplianceEventId = optionalString(input.relatedComplianceEventId);

  if (requireId && !isUuid(eventId)) {
    fieldErrors.eventId = ["Event is invalid."];
  }

  if (!title || title.length > MAX_TITLE_LENGTH) {
    fieldErrors.title = ["Enter a title of 200 characters or fewer."];
  }

  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    fieldErrors.description = ["Enter a description of 5000 characters or fewer."];
  }

  if (location && location.length > MAX_LOCATION_LENGTH) {
    fieldErrors.location = ["Enter a location of 300 characters or fewer."];
  }

  if (!isType(type)) {
    fieldErrors.type = ["Choose a valid event type."];
  }

  if (!isVisibility(visibility)) {
    fieldErrors.visibility = ["Choose a valid visibility."];
  }

  if (!isStatus(status)) {
    fieldErrors.status = ["Choose a valid status."];
  }

  if (!startsAt) {
    fieldErrors.startsAt = ["Enter a valid start date."];
  }

  if (safeString(input.endsAt) && !endsAt) {
    fieldErrors.endsAt = ["Enter a valid end date."];
  }

  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    fieldErrors.endsAt = ["End date must be after start date."];
  }

  addOptionalUuidError(fieldErrors, "relatedMeetingId", relatedMeetingId);
  addOptionalUuidError(fieldErrors, "relatedComplianceEventId", relatedComplianceEventId);

  if (
    Object.keys(fieldErrors).length > 0 ||
    !startsAt ||
    !isType(type) ||
    !isVisibility(visibility) ||
    !isStatus(status)
  ) {
    return { kind: "invalid", fieldErrors };
  }

  return {
    kind: "valid",
    communitySlug: optionalString(input.communitySlug) ?? DEFAULT_COMMUNITY_SLUG,
    eventId: eventId ?? null,
    title,
    description,
    type,
    visibility,
    startsAt,
    endsAt,
    allDay: input.allDay === true,
    location,
    relatedMeetingId,
    relatedComplianceEventId,
    status,
  };
}

async function requireActiveProfile(): Promise<EventResult | null> {
  const profileResult = await getCurrentProfile();

  if (profileResult.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (profileResult.kind !== "active-profile") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  return null;
}

function rpcDenied(): EventResult {
  return { kind: "permission-denied", message: PERMISSION_DENIED_MESSAGE };
}

function rpcResultToMutation(
  result: EventRpcResult | null,
  expectedStatus: "created" | "updated" | "cancelled" | "archived",
): EventResult {
  if (!result) {
    return unavailable();
  }

  if (result.status === "permission_denied") {
    return rpcDenied();
  }

  if (result.status === "invalid") {
    return invalid({ form: ["Event details are invalid."] });
  }

  if (result.status !== expectedStatus || !result.record) {
    return unavailable();
  }

  return { kind: expectedStatus, record: asRecord(result.record) };
}

export async function listEvents(input: ListEventsInput = {}): Promise<EventResult> {
  const validated = validateListInput(input);

  if (validated.kind === "invalid") {
    return invalid(validated.fieldErrors);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_events", {
    target_community_slug: validated.communitySlug,
    filter_visibility: validated.visibility,
    filter_status: validated.status,
    filter_type: validated.type,
    filter_query: validated.query,
    starts_from: validated.startsFrom,
    starts_to: validated.startsTo,
    include_archived: validated.includeArchived,
    upcoming_only: validated.upcomingOnly,
    page_limit: validated.pageSize,
    page_offset: validated.pageOffset,
  });
  const result = data as EventRpcResult | null;

  if (error || !result) {
    return unavailable();
  }

  if (result.status === "invalid") {
    return invalid({ form: ["Event filters are invalid."] });
  }

  if (result.status !== "ok") {
    return unavailable();
  }

  return {
    kind: "records",
    records: (result.records ?? []).map(asRecord),
  };
}

export async function createEvent(input: EventMutationInput): Promise<EventResult> {
  const validated = validateMutationInput(input);

  if (validated.kind === "invalid") {
    return invalid(validated.fieldErrors);
  }

  const profileBlocker = await requireActiveProfile();

  if (profileBlocker) {
    return profileBlocker;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_event", {
    target_community_slug: validated.communitySlug,
    event_title: validated.title,
    event_description: validated.description,
    event_type_value: validated.type,
    event_visibility_value: validated.visibility,
    event_starts_at: validated.startsAt,
    event_ends_at: validated.endsAt,
    event_all_day: validated.allDay,
    event_location: validated.location,
    event_related_meeting_id: validated.relatedMeetingId,
    event_related_compliance_event_id: validated.relatedComplianceEventId,
    event_status_value: validated.status,
  });

  if (error) {
    return unavailable();
  }

  return rpcResultToMutation(data as EventRpcResult | null, "created");
}

export async function updateEvent(input: EventMutationInput): Promise<EventResult> {
  const validated = validateMutationInput(input, true);

  if (validated.kind === "invalid") {
    return invalid(validated.fieldErrors);
  }

  const profileBlocker = await requireActiveProfile();

  if (profileBlocker) {
    return profileBlocker;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_event", {
    target_event_id: validated.eventId,
    event_title: validated.title,
    event_description: validated.description,
    event_type_value: validated.type,
    event_visibility_value: validated.visibility,
    event_starts_at: validated.startsAt,
    event_ends_at: validated.endsAt,
    event_all_day: validated.allDay,
    event_location: validated.location,
    event_related_meeting_id: validated.relatedMeetingId,
    event_related_compliance_event_id: validated.relatedComplianceEventId,
    event_status_value: validated.status,
  });

  if (error) {
    return unavailable();
  }

  return rpcResultToMutation(data as EventRpcResult | null, "updated");
}

async function lifecycleEvent(
  input: EventLifecycleInput,
  rpcName: "cancel_event" | "archive_event",
  expectedStatus: "cancelled" | "archived",
): Promise<EventResult> {
  if (!isUuid(input.eventId)) {
    return invalid({ eventId: ["Event is invalid."] });
  }

  const profileBlocker = await requireActiveProfile();

  if (profileBlocker) {
    return profileBlocker;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(rpcName, {
    target_event_id: input.eventId,
  });

  if (error) {
    return unavailable();
  }

  return rpcResultToMutation(data as EventRpcResult | null, expectedStatus);
}

export async function cancelEvent(input: EventLifecycleInput): Promise<EventResult> {
  return lifecycleEvent(input, "cancel_event", "cancelled");
}

export async function archiveEvent(input: EventLifecycleInput): Promise<EventResult> {
  return lifecycleEvent(input, "archive_event", "archived");
}
