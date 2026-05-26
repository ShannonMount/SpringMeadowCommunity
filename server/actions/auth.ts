"use server";

import { redirect } from "next/navigation";
import { safeCommunityRedirectPath } from "@/lib/auth/safe-redirect";
import { createClient } from "@/lib/supabase/server";

const GENERIC_SIGN_IN_ERROR = "We could not sign you in with those details.";

function safeRedirectPath(value: FormDataEntryValue | null) {
  return typeof value === "string" ? safeCommunityRedirectPath(value) : "/portal";
}

export async function signInResident(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextPath = safeRedirectPath(formData.get("next"));

  if (!email || !password) {
    redirect(`/login?authError=invalid&message=${encodeURIComponent(GENERIC_SIGN_IN_ERROR)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?authError=invalid&message=${encodeURIComponent(GENERIC_SIGN_IN_ERROR)}`);
  }

  if (nextPath === "/portal") {
    redirect("/portal");
  }

  redirect(nextPath);
}

export async function signOutCommunityUser() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function signOutResident() {
  await signOutCommunityUser();
}
