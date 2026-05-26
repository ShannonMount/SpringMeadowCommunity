import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendEmail } from "@/server/services/email/send-email";

const MESSAGE_NOTIFICATION_SUBJECT = "Spring Meadow HOA message update";
const MISSING_RECIPIENT_EMAIL = "missing-message-recipient@spring-meadow.invalid";
const QUEUED_EMAIL_RETRY_AFTER_MS = 10 * 60 * 1000;
const PARTICIPANT_VISIBLE_MESSAGE = "thread_participants";
const ARCHIVED_THREAD_STATUS = "archived";

type NotificationType = "resident_thread_created" | "resident_reply" | "board_admin_reply";
type EmailLogStatus = "queued" | "sent" | "delivered" | "bounced" | "failed" | "suppressed";

type TrustedClient = ReturnType<typeof createServiceRoleClient>;

type MessageRow = {
  id: string;
  community_id: string;
  thread_id: string;
  property_id: string;
  sender_id: string;
  sender_role: string;
  visibility: string;
  deleted_at: string | null;
};

type ThreadRow = {
  id: string;
  community_id: string;
  property_id: string;
  created_by: string;
  assigned_to: string | null;
  status: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  notification_preferences: Record<string, unknown> | null;
};

type ManagerRoleRow = {
  profile_id: string | null;
  profiles: ProfileRow | ProfileRow[] | null;
  roles:
    | {
        permissions: string[] | null;
      }
    | {
        permissions: string[] | null;
      }[]
    | null;
};

type Recipient = {
  profileId: string;
  email: string | null;
  notificationPreferences: Record<string, unknown> | null;
};

type EmailLogRow = {
  id: string;
  status: EmailLogStatus;
  provider_message_id: string | null;
  attempt_count: number;
  updated_at: string;
};

type NotificationContext = {
  message: MessageRow;
  thread: ThreadRow;
};

export type MessageNotificationInput = {
  messageId: string;
  type: NotificationType;
};

export type MessageNotificationResult =
  | { kind: "sent"; messageId: string; recipientCount: number }
  | { kind: "already-sent"; messageId: string; recipientCount: number }
  | { kind: "suppressed"; messageId: string; recipientCount: number }
  | { kind: "not-eligible"; messageId?: string }
  | { kind: "failed"; messageId?: string; retryable: boolean };

function getTrustedClientOrNull() {
  try {
    return createServiceRoleClient();
  } catch {
    return null;
  }
}

function normalizeOne<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value ?? null;
}

function isUsableEmail(value: string | null | undefined): value is string {
  return Boolean(value && value.includes("@") && !/\s/.test(value));
}

function safeNotificationPreferences(value: Record<string, unknown> | null | undefined) {
  return value ?? {};
}

function allowsMessageEmail(preferences: Record<string, unknown> | null | undefined) {
  const messages = safeNotificationPreferences(preferences).messages as
    | { email?: unknown }
    | undefined;

  return messages?.email !== false;
}

function notificationText() {
  return [
    MESSAGE_NOTIFICATION_SUBJECT,
    "",
    "A message thread in your Spring Meadow HOA portal has an update.",
    "Please sign in to view the message.",
  ].join("\n");
}

function notificationHtml() {
  return [
    "<h1>Spring Meadow HOA message update</h1>",
    "<p>A message thread in your Spring Meadow HOA portal has an update.</p>",
    "<p>Please sign in to view the message.</p>",
  ].join("");
}

function sanitizeNotificationError(error: string | null | undefined) {
  if (!error) {
    return null;
  }

  if (error === "resend-rate-limited" || error === "resend-validation-error") {
    return error;
  }

  if (error === "resend-configuration-error") {
    return error;
  }

  return "message-notification-send-failed";
}

function idempotencyKeyForMessage(message: MessageRow, recipient: Recipient) {
  return `message-notification/${message.id}/${recipient.profileId}`;
}

function isEligibleNotificationContext(context: NotificationContext, type: NotificationType) {
  if (
    context.message.visibility !== PARTICIPANT_VISIBLE_MESSAGE ||
    context.message.deleted_at ||
    context.thread.status === ARCHIVED_THREAD_STATUS ||
    context.message.community_id !== context.thread.community_id ||
    context.message.property_id !== context.thread.property_id
  ) {
    return false;
  }

  if (type === "resident_thread_created" || type === "resident_reply") {
    return context.message.sender_role === "resident";
  }

  return context.message.sender_role === "board_member" || context.message.sender_role === "admin";
}

async function getNotificationContext(
  supabase: TrustedClient,
  messageId: string,
): Promise<NotificationContext | null> {
  const { data: message, error: messageError } = await supabase
    .from("messages")
    .select("id, community_id, thread_id, property_id, sender_id, sender_role, visibility, deleted_at")
    .eq("id", messageId)
    .maybeSingle<MessageRow>();

  if (messageError || !message) {
    return null;
  }

  const { data: thread, error: threadError } = await supabase
    .from("message_threads")
    .select("id, community_id, property_id, created_by, assigned_to, status")
    .eq("id", message.thread_id)
    .maybeSingle<ThreadRow>();

  if (threadError || !thread) {
    return null;
  }

  return { message, thread };
}

async function notificationsEnabled(supabase: TrustedClient, communityId: string) {
  const { data } = await supabase
    .from("community_settings")
    .select("message_notifications_enabled")
    .eq("community_id", communityId)
    .maybeSingle<{ message_notifications_enabled: boolean | null }>();

  return data?.message_notifications_enabled !== false;
}

function recipientFromProfile(profile: ProfileRow | null | undefined): Recipient | null {
  if (!profile?.id) {
    return null;
  }

  return {
    profileId: profile.id,
    email: profile.email,
    notificationPreferences: profile.notification_preferences ?? {},
  };
}

function managerRowToRecipient(row: ManagerRoleRow, senderProfileId: string) {
  const profile = normalizeOne(row.profiles);
  const role = normalizeOne(row.roles);

  if (
    !profile?.id ||
    profile.id === senderProfileId ||
    !role?.permissions?.includes("admin.messages.manage")
  ) {
    return null;
  }

  return recipientFromProfile(profile);
}

function dedupeRecipients(recipients: Recipient[]) {
  const seen = new Set<string>();

  return recipients.filter((recipient) => {
    if (seen.has(recipient.profileId)) {
      return false;
    }

    seen.add(recipient.profileId);
    return true;
  });
}

async function managerRecipients(input: {
  supabase: TrustedClient;
  communityId: string;
  assignedTo: string | null;
  senderProfileId: string;
}) {
  if (input.assignedTo) {
    const { data: assignedRows } = await input.supabase
      .from("profile_roles")
      .select(
        "profile_id, profiles!inner(id, email, notification_preferences), roles!inner(permissions)",
      )
      .eq("community_id", input.communityId)
      .eq("profile_id", input.assignedTo)
      .eq("status", "active")
      .eq("profiles.status", "active")
      .is("profiles.deleted_at", null)
      .contains("roles.permissions", ["admin.messages.manage"])
      .limit(1)
      .returns<ManagerRoleRow[]>();

    const assignedRecipient = (assignedRows ?? [])
      .map((row) => managerRowToRecipient(row, input.senderProfileId))
      .find((recipient): recipient is Recipient => Boolean(recipient));

    if (assignedRecipient) {
      return [assignedRecipient];
    }
  }

  const { data: rows } = await input.supabase
    .from("profile_roles")
    .select("profile_id, profiles!inner(id, email, notification_preferences), roles!inner(permissions)")
    .eq("community_id", input.communityId)
    .eq("status", "active")
    .eq("profiles.status", "active")
    .is("profiles.deleted_at", null)
    .contains("roles.permissions", ["admin.messages.manage"])
    .order("assigned_at", { ascending: true })
    .limit(25)
    .returns<ManagerRoleRow[]>();

  return dedupeRecipients(
    (rows ?? [])
      .map((row) => managerRowToRecipient(row, input.senderProfileId))
      .filter((recipient): recipient is Recipient => Boolean(recipient)),
  );
}

async function residentRecipient(input: {
  supabase: TrustedClient;
  thread: ThreadRow;
  senderProfileId: string;
}) {
  if (input.thread.created_by === input.senderProfileId) {
    return [];
  }

  const { data: membership } = await input.supabase
    .from("property_memberships")
    .select("id")
    .eq("community_id", input.thread.community_id)
    .eq("property_id", input.thread.property_id)
    .eq("profile_id", input.thread.created_by)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();

  if (!membership) {
    return [];
  }

  const { data: profile } = await input.supabase
    .from("profiles")
    .select("id, email, notification_preferences")
    .eq("id", input.thread.created_by)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle<ProfileRow>();

  const recipient = recipientFromProfile(profile);

  return recipient ? [recipient] : [];
}

async function resolveRecipients(input: {
  supabase: TrustedClient;
  context: NotificationContext;
  type: NotificationType;
}) {
  if (input.type === "resident_thread_created" || input.type === "resident_reply") {
    return managerRecipients({
      assignedTo: input.context.thread.assigned_to,
      communityId: input.context.thread.community_id,
      senderProfileId: input.context.message.sender_id,
      supabase: input.supabase,
    });
  }

  if (input.type === "board_admin_reply") {
    return residentRecipient({
      senderProfileId: input.context.message.sender_id,
      supabase: input.supabase,
      thread: input.context.thread,
    });
  }

  return [];
}

async function existingEmailLog(supabase: TrustedClient, idempotencyKey: string) {
  const { data } = await supabase
    .from("email_logs")
    .select("id, status, provider_message_id, attempt_count, updated_at")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle<EmailLogRow>();

  return data ?? null;
}

function isActiveQueuedEmailLog(emailLog: EmailLogRow | null) {
  if (emailLog?.status !== "queued") {
    return false;
  }

  const updatedAtMs = Date.parse(emailLog.updated_at);

  if (!Number.isFinite(updatedAtMs)) {
    return false;
  }

  return Date.now() - updatedAtMs < QUEUED_EMAIL_RETRY_AFTER_MS;
}

function isNonRetryableEmailLog(emailLog: EmailLogRow | null) {
  return Boolean(
    emailLog &&
      (["sent", "delivered", "bounced", "suppressed"].includes(emailLog.status) ||
        isActiveQueuedEmailLog(emailLog)),
  );
}

async function claimEmailLog(input: {
  existingLog: EmailLogRow | null;
  idempotencyKey: string;
  context: NotificationContext;
  recipient: Recipient;
  supabase: TrustedClient;
}) {
  const existing = input.existingLog;

  if (existing && isNonRetryableEmailLog(existing)) {
    return { kind: "already-sent" as const, emailLogId: existing.id };
  }

  const values = {
    community_id: input.context.message.community_id,
    error: null,
    provider: "resend",
    provider_message_id: null,
    recipient_email: input.recipient.email ?? MISSING_RECIPIENT_EMAIL,
    recipient_profile_id: input.recipient.profileId,
    related_message_id: input.context.message.id,
    related_message_thread_id: input.context.thread.id,
    related_property_id: input.context.thread.property_id,
    sent_at: null,
    status: "queued" as const,
    subject: MESSAGE_NOTIFICATION_SUBJECT,
    type: "message_notification",
  };

  if (existing) {
    const { data: updated } = await input.supabase
      .from("email_logs")
      .update({
        ...values,
        attempt_count: existing.attempt_count + 1,
      })
      .eq("id", existing.id)
      .select("id, status, provider_message_id, attempt_count, updated_at")
      .maybeSingle<EmailLogRow>();

    return updated
      ? { kind: "claimed" as const, emailLogId: updated.id }
      : { kind: "failed" as const };
  }

  const { data: inserted } = await input.supabase
    .from("email_logs")
    .insert({
      ...values,
      attempt_count: 1,
      idempotency_key: input.idempotencyKey,
    })
    .select("id, status, provider_message_id, attempt_count, updated_at")
    .maybeSingle<EmailLogRow>();

  if (inserted) {
    return { kind: "claimed" as const, emailLogId: inserted.id };
  }

  const conflicted = await existingEmailLog(input.supabase, input.idempotencyKey);

  if (conflicted && isNonRetryableEmailLog(conflicted)) {
    return { kind: "already-sent" as const, emailLogId: conflicted.id };
  }

  return { kind: "failed" as const };
}

async function writeSuppressedEmailLog(input: {
  existingLog: EmailLogRow | null;
  idempotencyKey: string;
  context: NotificationContext;
  recipient: Recipient;
  reason: string;
  supabase: TrustedClient;
}) {
  if (input.existingLog && isNonRetryableEmailLog(input.existingLog)) {
    return { kind: "already-sent" as const };
  }

  const values = {
    community_id: input.context.message.community_id,
    error: input.reason,
    provider: "resend",
    provider_message_id: null,
    recipient_email: input.recipient.email ?? MISSING_RECIPIENT_EMAIL,
    recipient_profile_id: input.recipient.profileId,
    related_message_id: input.context.message.id,
    related_message_thread_id: input.context.thread.id,
    related_property_id: input.context.thread.property_id,
    sent_at: null,
    status: "suppressed" as const,
    subject: MESSAGE_NOTIFICATION_SUBJECT,
    type: "message_notification",
  };

  if (input.existingLog) {
    const { data: updated } = await input.supabase
      .from("email_logs")
      .update({
        ...values,
        attempt_count: input.existingLog.attempt_count + 1,
      })
      .eq("id", input.existingLog.id)
      .select("id")
      .maybeSingle<{ id: string }>();

    return updated ? { kind: "suppressed" as const } : { kind: "failed" as const };
  }

  const { error } = await input.supabase.from("email_logs").insert({
    ...values,
    attempt_count: 1,
    idempotency_key: input.idempotencyKey,
  });

  return error ? { kind: "failed" as const } : { kind: "suppressed" as const };
}

async function updateEmailLogAfterSend(input: {
  emailLogId: string;
  error?: string | null;
  providerMessageId?: string;
  status: Extract<EmailLogStatus, "sent" | "failed">;
  supabase: TrustedClient;
}) {
  await input.supabase
    .from("email_logs")
    .update({
      error: sanitizeNotificationError(input.error),
      provider_message_id: input.providerMessageId ?? null,
      sent_at: input.status === "sent" ? new Date().toISOString() : null,
      status: input.status,
    })
    .eq("id", input.emailLogId);
}

async function notifyRecipient(input: {
  context: NotificationContext;
  recipient: Recipient;
  supabase: TrustedClient;
}) {
  const { context, recipient, supabase } = input;
  const idempotencyKey = idempotencyKeyForMessage(context.message, recipient);
  const existingLog = await existingEmailLog(supabase, idempotencyKey);

  if (existingLog && isNonRetryableEmailLog(existingLog)) {
    return "already-sent" as const;
  }

  if (!allowsMessageEmail(recipient.notificationPreferences)) {
    const suppressed = await writeSuppressedEmailLog({
      context,
      existingLog,
      idempotencyKey,
      reason: "recipient-opted-out",
      recipient,
      supabase,
    });

    return suppressed.kind;
  }

  if (!isUsableEmail(recipient.email)) {
    const suppressed = await writeSuppressedEmailLog({
      context,
      existingLog,
      idempotencyKey,
      reason: "missing-recipient",
      recipient,
      supabase,
    });

    return suppressed.kind;
  }

  const claimedLog = await claimEmailLog({
    context,
    existingLog,
    idempotencyKey,
    recipient,
    supabase,
  });

  if (claimedLog.kind === "already-sent") {
    return "already-sent" as const;
  }

  if (claimedLog.kind !== "claimed") {
    return "failed" as const;
  }

  const sendResult = await sendEmail({
    html: notificationHtml(),
    idempotencyKey,
    subject: MESSAGE_NOTIFICATION_SUBJECT,
    text: notificationText(),
    to: recipient.email,
  });

  if (sendResult.kind === "sent") {
    await updateEmailLogAfterSend({
      emailLogId: claimedLog.emailLogId,
      providerMessageId: sendResult.providerMessageId,
      status: "sent",
      supabase,
    });

    return "sent" as const;
  }

  await updateEmailLogAfterSend({
    emailLogId: claimedLog.emailLogId,
    error: sendResult.error,
    status: "failed",
    supabase,
  });

  return "failed" as const;
}

export async function sendMessageNotificationForMessage(
  input: MessageNotificationInput,
): Promise<MessageNotificationResult> {
  const supabase = getTrustedClientOrNull();

  if (!supabase) {
    return { kind: "failed", messageId: input.messageId, retryable: true };
  }

  try {
    const context = await getNotificationContext(supabase, input.messageId);

    if (!context) {
      return { kind: "not-eligible", messageId: input.messageId };
    }

    if (!isEligibleNotificationContext(context, input.type)) {
      return { kind: "not-eligible", messageId: context.message.id };
    }

    if (!(await notificationsEnabled(supabase, context.thread.community_id))) {
      return { kind: "suppressed", messageId: context.message.id, recipientCount: 0 };
    }

    const recipients = await resolveRecipients({
      context,
      supabase,
      type: input.type,
    });

    if (recipients.length === 0) {
      return { kind: "suppressed", messageId: context.message.id, recipientCount: 0 };
    }

    const outcomes = [];

    for (const recipient of recipients) {
      outcomes.push(await notifyRecipient({ context, recipient, supabase }));
    }

    if (outcomes.some((outcome) => outcome === "sent")) {
      return {
        kind: "sent",
        messageId: context.message.id,
        recipientCount: outcomes.filter((outcome) => outcome === "sent").length,
      };
    }

    if (outcomes.every((outcome) => outcome === "already-sent")) {
      return {
        kind: "already-sent",
        messageId: context.message.id,
        recipientCount: outcomes.length,
      };
    }

    if (outcomes.some((outcome) => outcome === "failed")) {
      return { kind: "failed", messageId: context.message.id, retryable: true };
    }

    return {
      kind: "suppressed",
      messageId: context.message.id,
      recipientCount: outcomes.length,
    };
  } catch {
    return { kind: "failed", messageId: input.messageId, retryable: true };
  }
}
