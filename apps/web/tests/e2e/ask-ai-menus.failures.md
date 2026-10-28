# Ask AI in the stop and day menus: failure inventory

Written before the code (#756, spec #755). Each line is a way the feature could fail. The agreed seam is the real Trip workspace in a browser at 1440x1500 with a mouse, at 390x844 with touch and at 1440x1500 in Chinese, a saved fixture Trip with a stop that has no name, a day with no stops and a mock chat route. It covers what the traveller sees and what the chat receives.

## Bars removed

- An "Ask AI about this day" or "Ask AI about <stop>" bar still renders on any day or stop, on desktop or phone.
- The bar is hidden by CSS but still in the accessibility tree.
- A selected stop still shows an Ask AI control inside its place card or editor.

## Stop menu

- The Stop menu has no Ask AI item.
- The item is reachable only with a mouse, or has no accessible name.
- Choosing it sends nothing, sends a different message from the old bar (`Suggest a change for <stop> on Day <n>, taking the rest of my current plan into account.`), or names the wrong day or stop.
- A stop with no name sends a message with an empty or `undefined` name instead of falling back to the location or detail.
- The item stays enabled while the assistant is running, while another edit is being checked or on a locked trip, and sends a second request.
- The item sends the message but leaves the Trip panel open over the chat, or the conversation view is not shown.

## Day menu

- The Day menu has no Ask AI item.
- Choosing it sends nothing, or a message different from the old bar (`Suggest improvements for Day <n>, taking the rest of my current plan into account.`), or names another day than the selected one.
- A day with no stops hides the item or sends an empty message; it should still ask.
- The item stays enabled while the assistant is running or another edit is being checked.
- Replacing an edited plan no longer asks for the usual confirmation, or cancelling it still sends.

## Phone

- On a phone the menu item is clipped by the viewport or the bar still takes a full row.
- After choosing on a phone the Chat tab is not shown.

## Labels and dead strings

- The new label has no Chinese translation, or the Chinese accessible name differs from the visible label.
- "Ask AI about this day" and "Ask AI about {v0}" stay in the message catalog with their translations after nothing uses them.
- A document under `docs/` still describes the bars.
- Another E2E script still clicks the removed bar.

Run `PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pw-shim pnpm --filter @trip/web e2e ask-ai-menus --prod`. The script writes `result.json` and screenshots to `apps/web/output/playwright/ask-ai-menus/<EVIDENCE_LABEL>/` (default `after`).
