import "server-only";

import { createClient } from "@/lib/supabase/server";

export const PROFILE_UNAVAILABLE_MESSAGE =
  "Your resident profile is not available. Please contact the HOA for help.";

type ProfileStatus = "invited" | "active" | "suspended" | "disabled";

type ProfileRow = {
  id: string;
  auth_user_id: string;
  email: string;
  display_name: string | null;
  status: ProfileStatus;
  notification_preferences: Record<string, unknown> | null;
  deleted_at: string | null;
};

export type CurrentProfile = {
  id: string;
  authUserId: string;
  displayName: string;
  email: string;
  status: ProfileStatus;
  notificationPreferences: Record<string, unknown>;
};

export type CurrentProfileResult =
  | { kind: "active-profile"; profile: CurrentProfile }
  | { kind: "unauthenticated" }
  | { kind: "missing-profile"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "blocked-profile"; message: typeof PROFILE_UNAVAILABLE_MESSAGE }
  | { kind: "profile-error"; message: typeof PROFILE_UNAVAILABLE_MESSAGE };

const ACTIVE_STATUS: ProfileStatus = "active";

function toCurrentProfile(profile: ProfileRow): CurrentProfile {
  return {
    id: profile.id,
    authUserId: profile.auth_user_id,
    displayName: profile.display_name || profile.email,
    email: profile.email,
    status: profile.status,
    notificationPreferences: profile.notification_preferences ?? {},
  };
}

export async function getCurrentProfile(): Promise<CurrentProfileResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { kind: "unauthenticated" };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, auth_user_id, email, display_name, status, notification_preferences, deleted_at")
    .eq("auth_user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle<ProfileRow>();

  if (error) {
    return { kind: "profile-error", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  if (!data) {
    return { kind: "missing-profile", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  if (data.status !== ACTIVE_STATUS) {
    return { kind: "blocked-profile", message: PROFILE_UNAVAILABLE_MESSAGE };
  }

  return { kind: "active-profile", profile: toCurrentProfile(data) };
}
