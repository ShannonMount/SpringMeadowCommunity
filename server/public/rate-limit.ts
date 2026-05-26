import "server-only";

import { createHash } from "node:crypto";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const MAX_PUBLIC_RATE_LIMIT_BUCKETS = 1000;
const CONTROL_CHARACTER_PATTERN = /[\x00-\x1f\x7f]/;
const buckets = new Map<string, RateLimitBucket>();

function pruneExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function trimOldestBuckets() {
  while (buckets.size > MAX_PUBLIC_RATE_LIMIT_BUCKETS) {
    let oldestKey = "";
    let oldestResetAt = Number.POSITIVE_INFINITY;

    for (const [key, bucket] of buckets) {
      if (bucket.resetAt < oldestResetAt) {
        oldestKey = key;
        oldestResetAt = bucket.resetAt;
      }
    }

    if (!oldestKey) {
      return;
    }

    buckets.delete(oldestKey);
  }
}

function sanitizeHeaderPart(value: string | null) {
  const part = value?.split(",")[0]?.trim() ?? "";

  if (!part || part.length > 180 || CONTROL_CHARACTER_PATTERN.test(part)) {
    return "";
  }

  return part;
}

function requestFingerprint(request: Request) {
  const source = [
    request.headers.get("user-agent") ?? "",
    request.headers.get("accept-language") ?? "",
    request.headers.get("accept") ?? "",
  ].join("|");

  return createHash("sha256").update(source).digest("hex").slice(0, 24);
}

export function derivePublicClientIp(request: Request) {
  return (
    sanitizeHeaderPart(request.headers.get("cf-connecting-ip")) ||
    sanitizeHeaderPart(request.headers.get("x-forwarded-for")) ||
    undefined
  );
}

export function createPublicRateLimitKey(scope: string, request: Request) {
  const clientIp = derivePublicClientIp(request);

  if (clientIp) {
    return `${scope}:ip:${clientIp}`;
  }

  return `${scope}:fingerprint:${requestFingerprint(request)}`;
}

export function checkPublicRateLimit(options: RateLimitOptions) {
  const now = options.now ?? Date.now();

  pruneExpiredBuckets(now);

  trimOldestBuckets();

  const existing = buckets.get(options.key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(options.key, {
      count: 1,
      resetAt: now + options.windowMs,
    });

    return { allowed: true };
  }

  if (existing.count >= options.limit) {
    return { allowed: false };
  }

  existing.count += 1;
  return { allowed: true };
}
