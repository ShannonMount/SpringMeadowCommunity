import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationPath = "supabase/migrations/202605110024_compliance_calendar_foundation.sql";

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("story 6.1 compliance calendar foundation", () => {
  it("adds compliance status types, tables, indexes, and permission wiring", () => {
    assert.ok(existsSync(join(root, migrationPath)), `Expected ${migrationPath} to exist`);

    const migration = read(migrationPath);

    assert.match(migration, /create type compliance_status as enum/i);
    assert.match(migration, /'upcoming'/i);
    assert.match(migration, /'in_progress'/i);
    assert.match(migration, /'ready_for_review'/i);
    assert.match(migration, /'completed'/i);
    assert.match(migration, /'blocked'/i);
    assert.match(migration, /'deferred'/i);
    assert.match(migration, /'overdue'/i);
    assert.match(migration, /'legal_review_required'/i);

    assert.match(migration, /create table if not exists public\.compliance_calendar_events/i);
    assert.match(migration, /community_id uuid not null references public\.communities\(id\) on delete cascade/i);
    assert.match(migration, /type text not null check \(type in \('annual_meeting', 'board_meeting', 'financial_statement', 'records_request', 'assessment_due', 'delinquency_review', 'lien_review', 'fine_hearing', 'audit_review', 'custom'\)\)/i);
    assert.match(migration, /title text not null/i);
    assert.match(migration, /related_property_id uuid references public\.properties\(id\)/i);
    assert.match(migration, /related_records_request_id uuid/i);
    assert.match(migration, /related_assessment_id uuid references public\.assessments\(id\)/i);
    assert.match(migration, /due_at timestamptz not null/i);
    assert.match(migration, /status compliance_status not null default 'upcoming'/i);
    assert.match(migration, /priority text not null default 'normal' check \(priority in \('low', 'normal', 'high', 'critical'\)\)/i);
    assert.match(migration, /legal_sensitive boolean not null default false/i);
    assert.match(migration, /assigned_profile_ids uuid\[\] not null default '\{\}'/i);
    assert.match(migration, /completed_by uuid references public\.profiles\(id\)/i);

    assert.match(migration, /create index if not exists compliance_due_idx/i);
    assert.match(migration, /create index if not exists compliance_type_due_idx/i);
    assert.match(migration, /create index if not exists compliance_legal_idx/i);
    assert.match(migration, /create index if not exists compliance_assigned_gin_idx/i);

    assert.match(migration, /create table if not exists public\.compliance_tasks/i);
    assert.match(migration, /compliance_event_id uuid not null references public\.compliance_calendar_events\(id\) on delete cascade/i);
    assert.match(migration, /type text not null check \(type in \('notice', 'document_upload', 'review', 'mailing', 'hearing', 'approval', 'deadline', 'custom'\)\)/i);
    assert.match(migration, /status text not null default 'todo' check \(status in \('todo', 'in_progress', 'done', 'blocked', 'deferred'\)\)/i);
    assert.match(migration, /assigned_to uuid references public\.profiles\(id\)/i);
    assert.match(migration, /evidence jsonb not null default '\[\]'::jsonb/i);
    assert.match(migration, /create index if not exists compliance_tasks_event_idx/i);
    assert.match(migration, /create index if not exists compliance_tasks_assigned_idx/i);
    assert.match(migration, /create index if not exists compliance_tasks_status_due_idx/i);

    assert.match(migration, /admin\.compliance\.manage/i);
    assert.match(migration, /legal\.workflow\.review/i);
    assert.match(migration, /where key in \('admin', 'board_member', 'legal_reviewer'\)/i);
  });
});
