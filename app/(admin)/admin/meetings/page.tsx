import { createAnnualMeetingAction, markAnnualNoticeSentAction } from "@/server/actions/annual-meetings";
import { listAnnualMeetings } from "@/server/services/admin/annual-meetings";

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(new Date(value));
}

function notice(value: string | undefined) {
  if (value === "created") return "Annual meeting created.";
  if (value === "notice-sent") return "Notice marked sent.";
  if (value === "notice-out-of-window") return "Notice is outside the window; provide an override reason.";
  if (value === "denied") return "You do not have permission to manage meetings.";
  return value === "invalid" ? "Check the meeting details and try again." : null;
}

export default async function AdminMeetingsPage({ searchParams }: { searchParams?: Promise<{ meeting?: string }> }) {
  const params = (await searchParams) ?? {};
  const result = await listAnnualMeetings();

  if (result.kind !== "meetings") {
    const message = result.kind === "unauthenticated"
      ? "Please sign in to manage annual meetings."
      : "message" in result
        ? result.message
        : "Meeting workflow is temporarily unavailable.";
    return <section className="space-y-4 p-4"><h1 className="text-3xl font-semibold text-[var(--foreground)]">Annual meetings</h1><p className="text-sm text-[#4f5f5a]">{message}</p></section>;
  }

  return (
    <section className="space-y-6 p-4">
      <div><p className="text-sm font-semibold uppercase text-[var(--accent)]">Compliance operations</p><h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">Annual meetings</h1>{notice(params.meeting) ? <p className="mt-2" aria-live="polite">{notice(params.meeting)}</p> : null}</div>
      <form action={createAnnualMeetingAction} className="grid gap-3 rounded-sm border border-[var(--border)] bg-white p-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-xl font-semibold">Schedule annual meeting</h2>
        <label>Meeting date and time<input required name="meetingAt" type="datetime-local" className="mt-1 block w-full rounded-sm border p-2" /></label>
        <label>Status<select name="status" className="mt-1 block w-full rounded-sm border p-2"><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="notice_pending">Notice pending</option></select></label>
        <label className="md:col-span-2">Location<input required name="location" className="mt-1 block w-full rounded-sm border p-2" /></label>
        <label className="md:col-span-2">Agenda<textarea name="agenda" rows={4} className="mt-1 block w-full rounded-sm border p-2" /></label>
        <button className="rounded-sm bg-[var(--foreground)] px-3 py-2 text-sm font-semibold text-white md:col-span-2">Create meeting</button>
      </form>
      <div className="space-y-3">{result.meetings.length === 0 ? <p className="text-sm text-[#4f5f5a]">No annual meetings scheduled.</p> : result.meetings.map((meeting) => <article key={meeting.id} className="rounded-sm border border-[var(--border)] bg-white p-4"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">{formatDate(meeting.meetingAt)}</h2><span>{meeting.status}</span></div><p className="mt-1">{meeting.location}</p><p className="mt-2 text-sm text-[#4f5f5a]">Notice window: {formatDate(meeting.noticeEarliestAt)} through {formatDate(meeting.noticeLatestAt)}</p><p className="mt-2 text-sm">{meeting.agenda || "No agenda entered."}</p>{meeting.status !== "notice_sent" ? <form action={markAnnualNoticeSentAction} className="mt-4 grid gap-2 md:grid-cols-3"><input type="hidden" name="meetingId" value={meeting.id} /><label>Notice sent at<input required name="noticeAt" type="datetime-local" className="mt-1 block w-full rounded-sm border p-2" /></label><label>Override reason, if outside window<input name="overrideReason" className="mt-1 block w-full rounded-sm border p-2" /></label><button className="self-end rounded-sm border px-3 py-2 text-sm font-semibold">Mark notice sent</button></form> : <p className="mt-3 text-sm text-[#4f5f5a]">Notice sent {formatDate(meeting.noticeSentAt ?? "")}.</p>}</article>)}</div>
    </section>
  );
}
