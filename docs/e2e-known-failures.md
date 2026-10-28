# E2E scripts that fail on main

English | [中文](e2e-known-failures.zh.md)

The raw browser scripts listed here do not run in CI; the separate CLI acceptance job covers its
registered fixture journeys. A raw script can fail on `main` before anyone notices. Read this list
before deciding whether a failing script is your regression; update it when you find a script that fails on
`main` or fix one. Each entry says when it was last checked and what fails.

| Script         | Checked on `main` | What fails                                                                                                                              | Issue    |
| -------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `thinking-orb` | 2026-10-09        | "running subagents show orbs (0)" at 1440 light: no `.thinking-row__leading canvas.thinking-orb` appears, then the next wait times out. | none yet |

The following failures also reproduce on unchanged baseline `42fded7` (2026-10-10), using a production
server with `DATA_MODE=mock`, `USE_MOCK_TOOLS=true`, and blank `MOCK_GOOGLE_MAPS`, model and Clerk variables:

| Script     | What fails                                                                                                                                                                                                                    | Issue    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `timeline` | The fare-decimals console check reports four 404 responses for fixture place details. The fixture uses stand-in place IDs without stubbing their details; all JPY/AUD/KRW fare and route checks pass (99/100 checks overall). | none yet |

The following scripts also fail on unmodified `main` `c8ebd9b` (2026-10-27), run in a clean worktree as
`pnpm --filter @trip/web e2e <script> --prod` with no extra environment. They fail the same way on the
Mindtrip itinerary branches, so the itinerary tickets did not cause them. Most were written for the Trip
drawer that the calmer workspace (#740) replaced.

| Script               | What fails                                                                                                 | Issue    |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| `timeline`           | After the first check the screenshot waits forever for `.workspace-drawer--trip`, which no longer renders. | none yet |
| `auto-save-places`   | After 35 checks "the priced stop raises the estimate" fails: the estimate stays empty.                     | none yet |
| `drawer-walkthrough` | Waits for `.workspace-drawer--trip .trip-editor` after planning, then times out.                           | none yet |
| `itinerary`          | "Day 1 timeline is shown" fails and no stop rows are found under `.workspace-drawer--trip`.                | none yet |
| `settle-path`        | "the trip has an estimated total" reads 0, so every total check after it fails.                            | none yet |
| `check-entry-point`  | After 28 checks it waits for the textbox "Message AI Trip Planner", then times out.                        | none yet |
| `notice-keys`        | Waits for `.workspace-drawer--trip .trip-editor` after planning, then times out.                           | none yet |
| `narrow-time-editor` | Waits for the button "Close your trip" at 1001 px, then times out.                                         | none yet |

The following scripts failed on the unmodified base of the quiet itinerary panel work (2026-10-28), found by the ticket implementers who ran them in a clean worktree as `pnpm --filter @trip/web e2e <script> --prod`. The quiet panel tickets did not cause them; the cause of each is not yet investigated.

| Script                       | Checked    |
| ---------------------------- | ---------- |
| `activities-not-costed`      | 2026-10-28 |
| `trip-ui-triage`             | 2026-10-28 |
| `budget-source-replacement`  | 2026-10-28 |
| `trip-display-currency`      | 2026-10-28 |
| `display-currency`           | 2026-10-28 |
| `reply-cost-line`            | 2026-10-28 |
| `workspace-control-overflow` | 2026-10-28 |
| `workspace-chinese`          | 2026-10-28 |
| `stop-progress`              | 2026-10-28 |
| `open-in-maps`               | 2026-10-28 |
| `settings`                   | 2026-10-28 |
| `workspace-performance`      | 2026-10-28 |
| `trajectory-timeline`        | 2026-10-28 |
| `cross-day-drag`             | 2026-10-28 |
| `itinerary-walkthrough`      | 2026-10-28 |

`phone-state` reloads now restore Map: the script reloads once before the restore loop, because a stale-edit section pauses layout persistence until a reload. That pause is a product gap, recorded in `apps/web/tests/e2e/phone-state.failures.md`.

## Covered regressions

- `triage-accessibility` on `main` `8e168ba` (2026-10-22) waited on
  `getByText("No matching chats.", { exact: true })`, which matched both the sr-only chat-search
  status and the visible `.history-empty` line, so strict mode threw at 1280 before the Who, budget
  and map checks ran. The wait now scopes the visible line by its class; all checks pass with
  `DATA_MODE=mock pnpm --filter @trip/web e2e triage-accessibility`.

- `phone-map` on baseline `2e0f506b` (2026-10-19, #367) wrongly queried the renderer-error
  fallback list when the default no-key map had successfully loaded OSM. It failed three repeated-place
  checks at 390px and timed out on desktop before reaching 360px. The journey now waits for the map's
  named place control and the resulting selected stop/details, preserving both providers' coverage.
  Run `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e phone-map`
  with model, Maps and Clerk keys blank; repeat with `WEB_MAPS_PROVIDER=google` to exercise the
  no-key error list. Each mode explicitly asserts its renderer: ready OSM canvas by default, error list
  for Google-only. Each run covers 390×844, 360×800 and desktop transitions; retain separate
  attempts with `LABEL=<attempt>` under `output/playwright/phone-map/<attempt>/`.

- `trip-initial-scroll` covers #375: on baseline `2e0f506`, a fresh desktop Trip view opened at scrollTop 163 and clipped the budget. The day strip now scrolls only horizontally. The browser check includes initial open, reopen, saved-chat reload, deliberate scroll restoration and keyboard day navigation at desktop and phone widths.

- `agent-lab-replay` on PR #308 head `501af35` (2026-10-11) could miss the file chooser after keyboard
  Enter: the key event completed before Chromium acknowledged file-chooser interception. The journey
  keeps keyboard activation through the Replay button locator and stresses that boundary at 16× CPU
  throttling, restoring normal speed afterwards. Reproduce with
  `pnpm --filter @trip/web e2e run agent-lab-replay --dev`; the original global keyboard call fails
  this check even with the 30-second chooser timeout. This is a test-driver race, not a replay API failure.

- `liquid-glass` and `glass-calibration` waited on a language button and a When chip that the
  progressive-empty workspace no longer shows (2026-10-27, #731). Both scripts now plan a trip
  first, run at 1440x1000 and 390x844 in light and dark, and pass with
  `DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e liquid-glass --prod`
  and the same command for `glass-calibration`.

- `team-panel-desktop`, `team-thinking` and `trajectory-demo` already failed on `main` (2026-10-27, #734),
  independent of the glass and open-items tickets. The progressive-empty workspace moved the team
  control into the leading top bar group, so "the button sits left of Trip" had no Trip to find; the
  popover is named Specialist team, not Agent Team; the button's accessible name carries ", N working"
  while planning, so an exact-name locator timed out; clicks at the stream's top-left landed on the
  pinned panel; the trajectory tab selection and filter chip render a tick after the press; and on the
  phone the roster sits in a closed fold inside the sheet that stays in the DOM after it closes. The
  scripts now use those current premises and pass with
  `DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e <script> --prod`.

- `trajectory-tab` already failed "a reply that arrived on the Trajectory tab is in view when
  Conversation returns" on `main` `629cf2a` (2026-10-27, #740): the tab buttons moved into the
  workspace top bar, which sets the chat view directly, so the chat panel never recorded the stream's
  scroll position and the new reply stayed below the fold (gap 365 px at 1440). The panel now tracks
  the stream's scroll position and the messages it last showed itself, whoever changes the view.
  `phone-map-empty-hint` already encodes the #737 decision that the empty 1440 map area is hidden; it
  failed once in six runs because `locator.evaluate` read the panel's visibility from a node that
  hydration had replaced (empty string), so it now reads the live node. `sidebar-entries` belongs to
  the sidebar tickets and passes on the integration branch; neither needs an entry.

## Not failures

- `installable-app` waits forever under `next dev`, because the service worker registers only in a production
  build. Run it as its header says, `pnpm --filter @trip/web e2e installable-app --prod`; it passes all 22 checks with the full Chromium binary installed (2026-10-14).

## How to check

```bash
git worktree add ../main-check origin/main && cd ../main-check && pnpm install
DATA_MODE=mock pnpm --filter @trip/web e2e <script>
```

The runner stops a script that runs past `E2E_SCRIPT_TIMEOUT_MS` and reports it as `TIME`; see
[development.md](development.md#testing-approach).
