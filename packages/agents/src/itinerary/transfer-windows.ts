import type { AgentProposal } from "@trip/shared";
import { parseCityHop } from "../transport/legs";
import { minutes } from "./landing";

export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface TransferSegment {
  from: string;
  to: string;
  startTime?: string;
  endTime?: string;
}

export interface TransferWindow extends TransferSegment {
  day: number;
}

export function transferWindowsByDay(
  destination: string,
  transport?: AgentProposal,
): Map<number, TransferWindow[]> {
  const windows = new Map<number, TransferWindow[]>();
  for (const item of transport?.items ?? []) {
    if (!item.day) continue;
    const hop = parseCityHop(destination, item.location);
    if (!hop) continue;
    const { from, to } = hop;
    const startTime =
      item.startTime && item.endTime && TIME.test(item.startTime) && TIME.test(item.endTime)
        ? item.startTime
        : undefined;
    const endTime = startTime ? item.endTime : undefined;
    const dayWindows = windows.get(item.day) ?? [];
    const sameHop = dayWindows.find((window) => window.from === from && window.to === to);
    if (sameHop) {
      if (startTime && endTime && sameHop.startTime && sameHop.endTime) {
        if (minutes(startTime) < minutes(sameHop.startTime)) sameHop.startTime = startTime;
        if (minutes(endTime) > minutes(sameHop.endTime)) sameHop.endTime = endTime;
      } else {
        delete sameHop.startTime;
        delete sameHop.endTime;
      }
    } else {
      dayWindows.push({
        day: item.day,
        from,
        to,
        ...(startTime && endTime ? { startTime, endTime } : {}),
      });
    }
    windows.set(item.day, dayWindows);
  }
  for (const dayWindows of windows.values()) {
    if (dayWindows.every(({ startTime, endTime }) => startTime && endTime))
      dayWindows.sort((left, right) => minutes(left.startTime!) - minutes(right.startTime!));
  }
  return windows;
}

export function activityFitsTransferWindows(
  activity: { startTime: string; endTime: string },
  city: string,
  windows: readonly TransferWindow[],
): boolean {
  if (!windows.length) return true;
  const timedWindows = windows.filter(
    (window): window is TransferWindow & { startTime: string; endTime: string } =>
      Boolean(window.startTime && window.endTime),
  );
  if (timedWindows.length !== windows.length) return false;
  const start = minutes(activity.startTime);
  const end = minutes(activity.endTime);
  if (
    timedWindows.some(
      (window) => start < minutes(window.endTime) && end > minutes(window.startTime),
    )
  )
    return false;
  const previous = timedWindows.filter((window) => minutes(window.endTime) <= start).at(-1);
  const next = timedWindows.find((window) => minutes(window.startTime) >= end);
  if (previous && next) return previous.to === city && next.from === city;
  if (previous) return previous.to === city;
  if (next) return next.from === city;
  return false;
}
