import type { RevisionRequest } from "@trip/shared";
import type { ItineraryDraft } from "./index";

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const clock = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

/** Interpret only the exact keep-clear grammar currently emitted by A's workflow. */
export function avoidBlockedWindows(
  draft: ItineraryDraft,
  revision?: RevisionRequest,
): { draft: ItineraryDraft; conflicts: string[] } {
  const windows = (revision?.constraints ?? []).flatMap((constraint) => {
    const matches = [
      ...constraint.matchAll(
        /on day (\d+) keep clear of ((?:[01]\d|2[0-3]):[0-5]\d)-((?:[01]\d|2[0-3]):[0-5]\d)/g,
      ),
    ];
    return matches.map((m) => ({ day: Number(m[1]), start: minutes(m[2]!), end: minutes(m[3]!) }));
  });
  const copy = { ...draft, activities: draft.activities.map((a) => ({ ...a })) };
  const conflicts: string[] = [];
  const cursors = new Map<number, number>();
  for (const activity of copy.activities.sort(
    (a, b) => a.day - b.day || minutes(a.startTime) - minutes(b.startTime),
  )) {
    const duration = minutes(activity.endTime) - minutes(activity.startTime);
    let start = Math.max(minutes(activity.startTime), cursors.get(activity.day) ?? 0);
    const dayWindows = windows
      .filter((w) => w.day === activity.day && w.end > w.start)
      .sort((a, b) => a.start - b.start);
    for (const window of dayWindows) {
      if (start < window.end && start + duration > window.start) start = window.end + 15;
    }
    // Do not silently push a daytime visit into the night. Original hours are
    // not availability evidence; leave an explicit conflict for the coordinator.
    if (start + duration > 20 * 60 && start !== minutes(activity.startTime)) {
      conflicts.push(
        `time conflict on day ${activity.day}: requested clear window leaves no daytime slot`,
      );
      continue;
    }
    activity.startTime = clock(start);
    activity.endTime = clock(start + duration);
    cursors.set(activity.day, start + duration);
  }
  return { draft: copy, conflicts };
}
