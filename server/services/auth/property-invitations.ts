import "server-only";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentProfile,
  PROFILE_UNAVAILABLE_MESSAGE,
} from "@/server/services/auth/current-profile";

export const PROPERTY_INVITATION_UNAVAILABLE_MESSAGE =
  "This invitation cannot be accepted. Please contact the HOA for help.";

export type PropertyInvitationAcceptanceResult =
  | { kind: "accepted" }
  | { kind: "unauthenticated" }
  | { kind: "profile-unavailable"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "invitation-unavailable"; message: typeof PROPERTY_INVITATION_UNAVAILABLE_MESSAGE };

export type PropertyInvitationAuthorityResult =
  | { kind: "authorized" }
  | { kind: "unauthorized"; message: typeof PROPERTY_INVITATION_UNAVAILABLE_MESSAGE };

type InvitationRpcResult = "accepted" | "unavailable" | null;

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function normalizeToken(token: string | null | undefined) {
  const normalizedToken = token?.trim();

  return normalizedToken && normalizedToken.length >= 32 ? normalizedToken : null;
}

export async function acceptPropertyInvitation(
  token: string | null | undefined,
): Promise<PropertyInvitationAcceptanceResult> {
  const normalizedToken = normalizeToken(token);

  if (!normalizedToken) {
    return { kind: "invitation-unavailable", message: PROPERTY_INVITATION_UNAVAILABLE_MESSAGE };
  }

  const profileResult = await getCurrentProfile();

  if (profileResult.kind === "unauthenticated") {
    return { kind: "unauthenticated" };
  }

  if (profileResult.kind !== "active-profile") {
    return { kind: "profile-unavailable", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_property_invitation", {
    incoming_token_hash: hashInvitationToken(normalizedToken),
  });

  if (error || (data as InvitationRpcResult) !== "accepted") {
    return { kind: "invitation-unavailable", message: PROPERTY_INVITATION_UNAVAILABLE_MESSAGE };
  }

  return { kind: "accepted" };
}

export async function canInvitePropertyMembers(
  propertyId: string,
): Promise<PropertyInvitationAuthorityResult> {
  const profileResult = await getCurrentProfile();

  if (profileResult.kind !== "active-profile") {
    return { kind: "unauthorized", message: PROPERTY_INVITATION_UNAVAILABLE_MESSAGE };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("property_memberships")
    .select("id, properties!inner(id)")
    .eq("profile_id", profileResult.profile.id)
    .eq("property_id", propertyId)
    .eq("status", "active")
    .eq("can_invite_members", true)
    .eq("properties.status", "active")
    .is("properties.deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    return { kind: "unauthorized", message: PROPERTY_INVITATION_UNAVAILABLE_MESSAGE };
  }

  return { kind: "authorized" };
}
