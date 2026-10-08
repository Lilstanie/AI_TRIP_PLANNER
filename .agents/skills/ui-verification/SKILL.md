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
Use mock data unless the change concerns live providers. The data-mode toggle switches per request:
use the top bar, or Mine on a phone, to check both without redeploying.

Accounts are optional. With `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` set, anonymous page navigation is
redirected to `/sign-in` before the workspace renders, and signing in goes through Clerk's hosted
pages, which you cannot automate; verify that path by hand and say so in the session log. To reach the
workspace in a script, run the dev server without the Clerk keys, which is the single-user local mode.
`/agent-lab` and `/sign-in` stay public in both modes. The API routes are never redirected.

## 2. Exercise the change

- Reach the changed UI the way a user would, including one example trip from the blank chat.
- Check the states the change touches: empty, loading, error, degraded source badges, long text.
- Switch the interface to 中文 and look again: use the top-bar language button, Settings → Language
  & region, or Mine on a phone. Check wrapping and untranslated English labels.
  When the change shows money, also pick a non-AUD display currency in Settings (JPY has no decimals).
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
that covers your change with `pnpm --filter @trip/web e2e <name>` or add one, following
[Testing approach](../../../docs/development.md#testing-approach). Motion changes also need the
reduced-motion state, as in `thinking-orb.e2e.mjs`.

At phone width (520 px and below) the workspace is the phone shell; also check the transitions the
change touches:

- Cross the 520/521 px boundary with a workspace tab, Your trips or an overlay open. Navigation and
  the selected content remain reachable.
- Open controls through Chat, Map, Trip and Mine. Browser Back closes the active sheet or editor
  before leaving; closing returns focus to its trigger.
- Focus the composer, custom question input, a trip-fact editor field and a stop editor field while
  the keyboard contracts the viewport. Send or Save and the focused input remain visible; the tab
  bar hides while typing and returns afterwards.
- Change the map day and select a stop, including a place visited on more than one day. Its marker
  and details correspond to the selected day.

`phone-shell.e2e.mjs` combines `phone-mine.e2e.mjs`, `phone-map.e2e.mjs` and `phone-state.e2e.mjs`.
Run the walk for a focused change, or the combined script for a shell change, with
`pnpm --filter @trip/web e2e phone-shell --prod`. Browser viewport simulation does not verify installed-app safe areas or the real
on-screen keyboard: retain iPhone and Android device evidence separately, or record the outstanding
checks in [#182](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/182). Without a Maps key, report
real map panning and route rendering as unverified.

## 4. Record evidence

Save screenshots under `output/playwright/<name>/`, which is Git-ignored (an E2E script writes there
itself), and attach them to the PR's
Testing section; describe what each one proves. Record the viewports and results in the session log.
Never commit screenshots into the repository.
