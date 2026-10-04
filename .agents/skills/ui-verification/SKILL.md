---
name: ui-verification
description: Verify a UI change in a real browser at desktop and phone widths and attach screenshots as evidence, in apps/web of AI_TRIP_PLANNER. Use after changing anything a person can see (components, styles, layout, copy or client state), before claiming the change works.
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

Accounts are optional. With `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` set, anonymous page navigation is
redirected to `/sign-in` before the workspace renders, and signing in goes through Clerk's hosted
pages, which you cannot automate; verify that path by hand and say so in the session log. To reach the
workspace in a script, run the dev server without the Clerk keys, which is the single-user local mode.
`/agent-lab` and `/sign-in` stay public in both modes. The API routes are never redirected.

## 2. Exercise the change

- Reach the changed UI the way a user would, including one example trip from the blank chat.
- Check the states the change touches: empty, loading, error, degraded source badges, long text.
- Switch the interface to 中文 with the top-bar language button and look again: Chinese labels are
  shorter but wrap differently, and an untranslated string shows up as English. When the change
  shows money, also pick a non-AUD display currency in Settings (JPY has no decimals).
  `ui-language.e2e.mjs` and `display-currency.e2e.mjs` cover the existing paths.
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

For a complex path, a script under `apps/web/tests/e2e/` does steps 2 and 3 repeatably; run the one
that covers your change or add one, following
[Testing approach](../../../docs/development.md#testing-approach). Motion changes also need the
reduced-motion state, as in `thinking-orb.e2e.mjs`.

## 4. Record evidence

Save screenshots under `output/playwright/<name>/`, which is Git-ignored (an E2E script writes there
itself), and attach them to the PR's
Testing section; describe what each one proves. Record the viewports and results in the session log.
Never commit screenshots into the repository.
