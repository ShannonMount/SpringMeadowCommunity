import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

function isResidentRoute(pathname: string) {
  return pathname === "/portal" || pathname.startsWith("/portal/");
}

function isAdminRoute(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isProtectedRoute(pathname: string) {
  return isResidentRoute(pathname) || isAdminRoute(pathname);
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);

  if (isProtectedRoute(request.nextUrl.pathname)) {
    loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  }

  if (!loginUrl.search) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.redirect(loginUrl);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });
  const { supabaseUrl, supabaseKey } = getSupabaseConfig();

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();

  if (isProtectedRoute(request.nextUrl.pathname) && (error || !data?.claims)) {
    return redirectToLogin(request);
  }

  return response;
}
