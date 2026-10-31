# E2E scripts that fail on main

English | [中文](e2e-known-failures.zh.md)

The raw browser scripts listed here do not run in CI; the separate CLI acceptance job covers its
registered fixture journeys. A raw script can fail on `main` before anyone notices. Read this list
before deciding whether a failing script is your regression; update it when you find a script that fails on
`main` or fix one. Each entry says when it was last checked and what fails.

TP-165 (2026-10-30) deleted 136 raw scripts that failed on `main`, guarded one old fix each, or
repeated a kept journey, together with their failure notes and unused fixtures. Their old entries are
gone from this page; restore a script from Git history only with a reason it is needed again.

`trajectory-tab` fails on `main` `ec70e0d` (2026-10-30, TP-167) with
`pnpm --filter @trip/web e2e trajectory-tab`: after 59 passing checks at `en-1440`, the reload step
reopens "Tokyo from Sydney" from Chats and times out in `page.waitForFunction` waiting for three
`.msg-item--agent` messages.

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

- `agent-lab-replay` on PR #308 head `501af35` (2026-10-11) could miss the file chooser after keyboard
  Enter: the key event completed before Chromium acknowledged file-chooser interception. The journey
  keeps keyboard activation through the Replay button locator and stresses that boundary at 16× CPU
  throttling, restoring normal speed afterwards. Reproduce with
  `pnpm --filter @trip/web e2e run agent-lab-replay --dev`; the original global keyboard call fails
  this check even with the 30-second chooser timeout. This is a test-driver race, not a replay API failure.

- `liquid-glass` waited on a language button and a When chip that the progressive-empty workspace
  no longer shows (2026-10-27, #731). It now plans a trip first, runs at 1440x1000 and 390x844 in
  light and dark, and passes with
  `DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e liquid-glass --prod`.

- `trajectory-demo` already failed on `main` (2026-10-27, #734): the popover is named Specialist team,
  not Agent Team, and the button's accessible name carries ", N working" while planning. It now uses
  those premises and passes with
  `DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e trajectory-demo --prod`.

- `trajectory-tab` already failed "a reply that arrived on the Trajectory tab is in view when
  Conversation returns" on `main` `629cf2a` (2026-10-27, #740): the tab buttons moved into the
  workspace top bar, which sets the chat view directly, so the chat panel never recorded the stream's
  scroll position and the new reply stayed below the fold (gap 365 px at 1440). The panel now tracks
  the stream's scroll position and the messages it last showed itself, whoever changes the view.

- `trip-display-currency` and `settings` already failed on unmodified `main` (2026-10-28) because
  they drove controls the calmer workspace (#740), the progressive-empty workspace and the Trip home
  (#765) moved or removed. They now switch the interface language in Settings (`setPhoneLanguage`,
  `setDesktopLanguage`), go through `openTripWorkspace`, state the budget in the first message and read
  a blank trip's currency from the stored catalog. Run each with
  `DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e <script> --prod`.

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
