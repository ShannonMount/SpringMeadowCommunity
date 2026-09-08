#!/usr/bin/env bash
set -u

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
KEY="concurrent-reminder-$$"
COMMUNITY_ID="$(psql "$DB_URL" --quiet --tuples-only --no-align --command "select id from public.communities where slug = 'spring-meadow-community'")"
RULE_ID="$(psql "$DB_URL" --quiet --tuples-only --no-align --command "insert into public.compliance_reminder_rules (community_id, name, reminder_type, days_before_due) values ('$COMMUNITY_ID', 'Concurrency $KEY', 'compliance_event', 0) returning id")"
EVENT_ID="$(psql "$DB_URL" --quiet --tuples-only --no-align --command "insert into public.compliance_calendar_events (community_id, type, title, due_at) values ('$COMMUNITY_ID', 'custom', 'Concurrency $KEY', now()) returning id")"

cleanup() {
  psql "$DB_URL" --command "delete from public.compliance_calendar_events where id = '$EVENT_ID'; delete from public.compliance_reminder_rules where id = '$RULE_ID';" >/dev/null
}
trap cleanup EXIT

set +e
psql "$DB_URL" --set ON_ERROR_STOP=1 --command "begin; insert into public.compliance_reminder_deliveries (community_id, reminder_rule_id, compliance_event_id, recipient_email, due_occurrence, idempotency_key, status) values ('$COMMUNITY_ID', '$RULE_ID', '$EVENT_ID', 'integration@example.invalid', now(), '$KEY', 'queued'); select pg_sleep(2); commit;" >/tmp/compliance-reminder-first-$$.log 2>&1 &
FIRST_PID=$!
psql "$DB_URL" --set ON_ERROR_STOP=1 --command "insert into public.compliance_reminder_deliveries (community_id, reminder_rule_id, compliance_event_id, recipient_email, due_occurrence, idempotency_key, status) values ('$COMMUNITY_ID', '$RULE_ID', '$EVENT_ID', 'integration@example.invalid', now(), '$KEY', 'queued');" >/tmp/compliance-reminder-second-$$.log 2>&1
SECOND_STATUS=$?
wait "$FIRST_PID"
FIRST_STATUS=$?
set -e

if [[ "$FIRST_STATUS" -eq 0 && "$SECOND_STATUS" -eq 0 ]] || [[ "$FIRST_STATUS" -ne 0 && "$SECOND_STATUS" -ne 0 ]]; then
  cat /tmp/compliance-reminder-first-$$.log /tmp/compliance-reminder-second-$$.log
  exit 1
fi

rm -f /tmp/compliance-reminder-first-$$.log /tmp/compliance-reminder-second-$$.log
printf 'Concurrent delivery claim: first=%s second=%s\n' "$FIRST_STATUS" "$SECOND_STATUS"
