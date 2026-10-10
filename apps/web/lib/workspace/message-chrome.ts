export const WELCOME_MESSAGE =
  "Edit your trip preferences or tell me what to change. I'll build the plan here, and you can ask for changes in this chat at any time.";

export function formatMessageClock(
  time: number,
  now: number = Date.now(),
  locale = "en-AU",
): string {
  const at = new Date(time);
  const reference = new Date(now);
  const clock = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
  const sameDay =
    at.getFullYear() === reference.getFullYear() &&
    at.getMonth() === reference.getMonth() &&
    at.getDate() === reference.getDate();
  if (sameDay) return clock;
  const date = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    ...(at.getFullYear() !== reference.getFullYear() ? { year: "numeric" } : {}),
  }).format(at);
  return `${date} ${clock}`;
}
