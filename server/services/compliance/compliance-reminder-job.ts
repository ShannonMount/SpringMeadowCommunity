import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { reminderDueWindow } from "@/lib/compliance-reminder-timing";
import { sendEmail } from "@/server/services/email/send-email";

const REMINDER_TYPE = "compliance_warning";
const DEFAULT_SUBJECT = "Spring Meadow HOA compliance deadline reminder";

type TrustedClient = ReturnType<typeof createServiceRoleClient>;

type ReminderRule = {
  id: string;
  community_id: string;
  reminder_type: "compliance_event" | "compliance_task";
  days_before_due: number;
  recipient_role: string;
};

type ReminderRecord = {
  id: string;
  community_id: string;
  title: string;
  due_at: string;
  related_event_id: string | null;
  related_task_id: string | null;
};

type Recipient = {
  profile_id: string;
  email: string;
};

export type ComplianceReminderRunResult = {
  selected: number;
  sent: number;
  failed: number;
  skipped: number;
};

function isUsableEmail(value: string | null | undefined): value is string {
  return Boolean(value && value.includes("@") && !/\s/.test(value));
}

function reminderIdempotencyKey(ruleId: string, record: ReminderRecord, recipient: Recipient) {
  const recordKey = record.related_event_id ?? record.related_task_id ?? record.id;
  return `compliance-reminder:${ruleId}:${recordKey}:${record.due_at}:${recipient.profile_id}`;
}

function reminderSubject(record: ReminderRecord) {
  return `${DEFAULT_SUBJECT}: ${record.title}`;
}

function reminderText(record: ReminderRecord) {
  return `The compliance item "${record.title}" is due ${new Date(record.due_at).toLocaleString("en-US", { timeZone: "America/New_York" })}.`;
}

function reminderHtml(record: ReminderRecord) {
  return `<p>The compliance item <strong>${record.title.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</strong> is due ${new Date(record.due_at).toLocaleString("en-US", { timeZone: "America/New_York" })}.</p>`;
}

async function recipientsForRule(supabase: TrustedClient, rule: ReminderRule) {
  const { data } = await supabase
    .from("profile_roles")
    .select("profile_id, profiles!inner(id, email, status), roles!inner(key, community_id)")
    .eq("community_id", rule.community_id)
    .eq("status", "active")
    .eq("roles.key", rule.recipient_role)
    .eq("roles.community_id", rule.community_id)
    .eq("profiles.status", "active");

  return (data ?? [])
    .map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        profile_id: row.profile_id,
        email: profile?.email,
      };
    })
    .filter((recipient): recipient is Recipient => isUsableEmail(recipient.email));
}

async function recordsForRule(supabase: TrustedClient, rule: ReminderRule, now: Date) {
  const { dueStart, dueEnd } = reminderDueWindow(now, rule.days_before_due);

  if (rule.reminder_type === "compliance_event") {
    const { data } = await supabase
      .from("compliance_calendar_events")
      .select("id, community_id, title, due_at")
      .eq("community_id", rule.community_id)
      .gte("due_at", dueStart.toISOString())
      .lt("due_at", dueEnd.toISOString())
      .not("status", "in", "(completed)");

    return (data ?? []).map((record) => ({
      id: record.id,
      community_id: record.community_id,
      title: record.title,
      due_at: record.due_at,
      related_event_id: record.id,
      related_task_id: null,
    }));
  }

  const { data } = await supabase
    .from("compliance_tasks")
    .select("id, community_id, title, due_at, compliance_event_id")
    .eq("community_id", rule.community_id)
    .gte("due_at", dueStart.toISOString())
    .lt("due_at", dueEnd.toISOString())
    .not("status", "in", "(done)");

  return (data ?? []).map((record) => ({
    id: record.id,
    community_id: record.community_id,
    title: record.title,
    due_at: record.due_at,
    related_event_id: record.compliance_event_id,
    related_task_id: record.id,
  }));
}

async function claimDelivery(supabase: TrustedClient, rule: ReminderRule, record: ReminderRecord, recipient: Recipient) {
  const idempotencyKey = reminderIdempotencyKey(rule.id, record, recipient);
  const { data: existing } = await supabase
    .from("compliance_reminder_deliveries")
    .select("id, status, attempt_count")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle<{ id: string; status: string; attempt_count: number }>();

  if (existing?.status === "sent" || existing?.status === "queued") {
    return null;
  }

  if (existing?.status === "failed") {
    const { data: retried } = await supabase
      .from("compliance_reminder_deliveries")
      .update({ status: "queued", error: null, attempt_count: existing.attempt_count + 1 })
      .eq("id", existing.id)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();

    return retried ? { id: existing.id, idempotencyKey, attemptCount: existing.attempt_count + 1 } : null;
  }

  const { data, error } = await supabase
    .from("compliance_reminder_deliveries")
    .insert({
      community_id: rule.community_id,
      reminder_rule_id: rule.id,
      compliance_event_id: record.related_task_id ? null : record.related_event_id,
      compliance_task_id: record.related_task_id,
      recipient_profile_id: recipient.profile_id,
      recipient_email: recipient.email,
      due_occurrence: record.due_at,
      idempotency_key: idempotencyKey,
      status: "queued",
    })
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    return null;
  }

  return { id: data.id, idempotencyKey, attemptCount: 1 };
}

export async function runComplianceReminderJob(input: { now?: Date } = {}): Promise<ComplianceReminderRunResult> {
  const supabase = createServiceRoleClient();
  const now = input.now ?? new Date();
  const { data: rules, error } = await supabase
    .from("compliance_reminder_rules")
    .select("id, community_id, reminder_type, days_before_due, recipient_role")
    .eq("enabled", true);

  if (error) {
    throw new Error("Unable to load compliance reminder rules.");
  }

  const result: ComplianceReminderRunResult = { selected: 0, sent: 0, failed: 0, skipped: 0 };

  for (const rule of (rules ?? []) as ReminderRule[]) {
    const [records, recipients] = await Promise.all([
      recordsForRule(supabase, rule, now),
      recipientsForRule(supabase, rule),
    ]);

    for (const record of records) {
      for (const recipient of recipients) {
        result.selected += 1;
        const claim = await claimDelivery(supabase, rule, record, recipient);

        if (!claim) {
          result.skipped += 1;
          continue;
        }

        const sendResult = await sendEmail({
          html: reminderHtml(record),
          idempotencyKey: claim.idempotencyKey,
          subject: reminderSubject(record),
          text: reminderText(record),
          to: recipient.email,
        });

        if (sendResult.kind === "sent") {
          await supabase
            .from("compliance_reminder_deliveries")
            .update({ status: "sent", provider_message_id: sendResult.providerMessageId, sent_at: new Date().toISOString() })
            .eq("id", claim.id);
          await supabase.from("email_logs").insert({
            community_id: rule.community_id,
            type: REMINDER_TYPE,
            recipient_email: recipient.email,
            recipient_profile_id: recipient.profile_id,
            subject: reminderSubject(record),
            provider: "resend",
            provider_message_id: sendResult.providerMessageId,
            status: "sent",
            idempotency_key: `${claim.idempotencyKey}:attempt:${claim.attemptCount}`,
            attempt_count: 1,
            related_compliance_event_id: record.related_event_id,
            sent_at: new Date().toISOString(),
          });
          result.sent += 1;
        } else {
          await supabase
            .from("compliance_reminder_deliveries")
            .update({ status: "failed", error: sendResult.error })
            .eq("id", claim.id);
          await supabase.from("email_logs").insert({
            community_id: rule.community_id,
            type: REMINDER_TYPE,
            recipient_email: recipient.email,
            recipient_profile_id: recipient.profile_id,
            subject: reminderSubject(record),
            provider: "resend",
            status: "failed",
            error: sendResult.error,
            idempotency_key: `${claim.idempotencyKey}:attempt:${claim.attemptCount}`,
            attempt_count: 1,
            related_compliance_event_id: record.related_event_id,
          });
          result.failed += 1;
        }
      }
    }
  }

  return result;
}