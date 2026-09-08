import { NextRequest, NextResponse } from "next/server";
import { runComplianceReminderJob } from "@/server/services/compliance/compliance-reminder-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET?.trim();

  if (!configuredSecret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-cron-secret");

  return authorization === `Bearer ${configuredSecret}` || cronHeader === configuredSecret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runComplianceReminderJob();
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: false, code: "reminder-job-failed" }, { status: 500 });
  }
}