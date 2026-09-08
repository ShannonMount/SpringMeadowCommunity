export function reminderDueWindow(now: Date, daysBeforeDue: number) {
  const dueStart = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysBeforeDue,
  ));
  const dueEnd = new Date(dueStart);
  dueEnd.setUTCDate(dueEnd.getUTCDate() + 1);

  return { dueStart, dueEnd };
}