/**
 * Compact local timestamp for a chat message, ported from DSH's
 * `formatMessageClock` (`ui-chat/src/client/chat/message-chrome.ts`). Same
 * calendar day as `now` → `HH:mm`; any other day → a short date plus the
 * time. Pure and locale-driven through `Intl.DateTimeFormat`, defaulting to
 * `en-AU` to match the rest of this app's formatting (see `money` in
 * `./workspace`).
 */
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
