---
name: ui-verification
description: Use after changing anything a person can see in apps/web of AI_TRIP_PLANNER — components, styles, layout, copy or client state — to verify it in a real browser at desktop and phone widths and attach screenshots as evidence, before claiming the change works.
---

# Verify a UI change in the browser

Unit tests do not show layout, focus or overflow. Every visible change is checked in a running app,
and the pull request carries the evidence. For complex user-visible features, prefer E2E as the sole
behavioral test and leave a repeatable artifact. This is guidance: check what the change can affect.

## 1. Run the app

Start the `web` configuration from `.claude/launch.json` (`pnpm --filter @trip/web dev`, port 3000).
If a production build is running at the same time, start dev with `NEXT_DIST_DIR=.next-dev`.
Use mock data unless the change concerns live providers; the top-bar toggle switches per request, so
you can check both without redeploying.

## 2. Exercise the change

- Reach the changed UI the way a user would, including one example trip from the blank chat.
- Check the states the change touches: empty, loading, error, degraded source badges, long text.
- Keyboard: Tab order, visible focus, Escape closes dialogs and returns focus to the trigger.
- Watch the browser console for errors and React warnings.
- What "right" looks like is owned by [better-accessibility](../better-accessibility/SKILL.md),
  [better-layout](../better-layout/SKILL.md), [better-ui](../better-ui/SKILL.md) and
  [better-writing](../better-writing/SKILL.md). To stress one component with worst-case data, run
  the manual [break](../break/SKILL.md) skill.

## 3. Check both widths

| Viewport | Size                                                             |
| -------- | ---------------------------------------------------------------- |
| Desktop  | 1440 × 1000                                                      |
| Phone    | 390 × 844 (and 375 wide for dense controls such as the calendar) |

At phone width confirm there is no horizontal page scroll: `document.documentElement.scrollWidth`
must equal the viewport width. Check dark and light theme when colours changed.

## 4. Record evidence

Save screenshots under `output/playwright/`, which is Git-ignored, and attach them to the PR's
Testing section; describe what each one proves. Record the viewports and results in the session log.
Never commit screenshots into the repository.
