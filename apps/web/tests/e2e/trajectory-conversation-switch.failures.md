# Trajectory selection across chats: failure inventory (TP-118)

`trajectory-conversation-switch.e2e.mjs` seeds two saved chats of three traveller messages each, opens the Trajectory tab on the first chat in the simple list, opens its second turn, then opens the other chat from the Chats panel. It must fail when:

- The second chat's simple list opens with its second turn already expanded because the first chat's selection carried over.
- The first chat's simple list does not show its second turn expanded before the switch.
- Switching back to the first chat finds the Trajectory tab closed or the list empty.
- Page errors appear in the browser console, or the screenshot and `summary.json` are not written.

Run `pnpm --filter @trip/web e2e trajectory-conversation-switch`. Output lands in `apps/web/output/playwright/trajectory-conversation-switch/<LABEL>/`.
