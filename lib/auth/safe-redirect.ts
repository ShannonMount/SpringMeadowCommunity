const FALLBACK_REDIRECT_PATH = "/portal";
const LOCAL_REDIRECT_ORIGIN = "https://spring-meadow.local";
const SAFE_REDIRECT_ROOTS = ["/portal", "/admin"];

function decodePathSegment(segment: string) {
  let decoded = segment;

  for (let index = 0; index < 2; index += 1) {
    const next = decodeURIComponent(decoded);

    if (next === decoded) {
      break;
    }

    decoded = next;
  }

  return decoded;
}

function hasUnsafePathSegment(pathname: string) {
  if (pathname.includes("\\")) {
    return true;
  }

  return pathname.split("/").some((segment) => {
    try {
      const decoded = decodePathSegment(segment);

      return (
        decoded === "." ||
        decoded === ".." ||
        decoded.includes("/") ||
        decoded.includes("\\")
      );
    } catch {
      return true;
    }
  });
}

export function safeCommunityRedirectPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return FALLBACK_REDIRECT_PATH;
  }

  const rawPathname = value.split(/[?#]/, 1)[0];

  if (hasUnsafePathSegment(rawPathname)) {
    return FALLBACK_REDIRECT_PATH;
  }

  const redirectUrl = new URL(value, LOCAL_REDIRECT_ORIGIN);
  const pathname = redirectUrl.pathname;
  const isAllowedPath = SAFE_REDIRECT_ROOTS.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );

  return isAllowedPath ? `${pathname}${redirectUrl.search}` : FALLBACK_REDIRECT_PATH;
}
