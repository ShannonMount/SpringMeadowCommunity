import { NextResponse, type NextRequest } from "next/server";
import { safeCommunityRedirectPath } from "@/lib/auth/safe-redirect";
import { createClient } from "@/lib/supabase/server";

function safeRedirectPath(value: string | null) {
  return safeCommunityRedirectPath(value);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = safeRedirectPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/login?authError=expired", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?authError=expired", request.url));
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}
