---
name: ui-verification
description: Verify a UI change in a real browser at desktop and phone widths and attach screenshots as evidence, in apps/web of AI_TRIP_PLANNER. Use after changing anything a person can see (components, styles, layout, copy or client state), before claiming the change works.
---

# Verify a UI change in the browser

Unit tests do not show layout, focus or overflow. Every visible change is checked in a running app,
and the pull request carries the evidence. For complex user-visible features, prefer E2E as the sole
behavioral test and leave a repeatable artifact. This is guidance: check what the change can affect.

For locator, waiting, isolation and debugging techniques, consult
[playwright-best-practices](../playwright-best-practices/SKILL.md). The project's testing approach,
runner commands and acceptance evidence remain authoritative; its Playwright Test examples do not
configure a new runner in this repository.

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
`pnpm --filter @trip/web e2e phone-shell --prod`. Browser viewport simulation does not verify
installed-app safe areas or the real on-screen keyboard. Physical-device checks are not planned since
the [Android wrapper removal](../../notes/implemented/feature/2026-10-14-drop-android-wrapper.md)
closed #182, so report those behaviours as not verified unless you checked a real device.
For drawer changes, follow [better-layout](../better-layout/SKILL.md): measure default and extreme
split positions and the narrow content container, then cross 1000/1001 px as well as 520/521 px.

## 4. Identify map coverage

A missing Google key does not prevent keyless OSM coverage. Keep browser rendering separate from
server search, details and routing: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` selects the Google SDK path,
while `MAPS_API_KEY` configures server Google APIs. The browser can use MapLibre/OpenFreeMap;
server selection is `WEB_MAPS_PROVIDER` (`google-with-fallback`, `google`, or `osm`), independently
of planning `MAPS_PROVIDER`. Record the renderer and the source actually returned by each operation.

- **Fixture fallback:** use the existing recipe in
  [development](../../../docs/development.md#verification):
  `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true MOCK_GOOGLE_MAPS=unavailable pnpm --filter @trip/web e2e map-fallback`.
  Blank model, Maps and Clerk credentials for fixture runs. This exercises OSM places, saved
  coordinates, locale changes, photos and leg-mode wiring without external service calls; MapLibre
  uses an empty style. Evidence lives in `output/playwright/map-fallback/<label>/` (default `after`).
- **Google fixtures:** `map-provider-healthy.e2e.mjs` verifies healthy mock Google API provenance.
  That is not live Google SDK, panning or real route evidence. Real Google checks need the
  applicable browser/server keys and live mode; record any missing coverage explicitly.
- **Local HTTP stubs:** `map-provider-http.e2e.mjs` checks real handlers against local Photon,
  Nominatim and Transitous upstreams. Follow development's `MAP_STUB_PORT`, base URL and
  `WEB_MAPS_PROVIDER=osm` setup; do not label these stub results live-provider evidence.
- **Opt-in live free maps:** development's `map-fallback-live.e2e.mjs` recipe uses
  `RUN_LIVE_MAP_CHECK=1 WEB_MAPS_PROVIDER=osm CHANNEL=chrome USE_MOCK_TOOLS=true` with the existing
  runner. Chat alone is fixture-backed; place lookup, tiles and walking routes are live. This can
  establish keyless OSM panning/routing for that journey, not Google coverage, worldwide transit
  availability or physical-device behavior. No live run is needed for prose-only skill edits.

Check Google category-icon fallback separately from OSM's omitted photo slot when no licensed image
exists or loading fails. For a Commons image, verify author, license and license link. Test EN→ZH→EN
and data-mode changes for stale names/details, plus mixed-provider saved stops with coordinates.
See [add-provider](../add-provider/SKILL.md) for provider boundaries and failure semantics.

## 5. Record evidence

Save screenshots under `output/playwright/<name>/`, which is Git-ignored (an E2E script writes there
itself), and attach them to the PR's
Evidence section; describe what each one proves. Record the revision, command, viewports, measured container widths and results in the session log.
For maps, record the actual renderer/provider, non-sensitive configuration (key presence only),
request data mode, language, fixture/local-stub/live status, assertions and skips, and artifact paths.
Separate browser viewport simulation, physical-device checks and live-service evidence. A zero exit
code with skipped checks is not evidence those assertions ran; preserve failures as well as later passes.
Never commit screenshots into the repository. Attach them to the pull request before running
`pnpm clean:output` (AGENTS.md delivery step 5), which deletes `output/` with every local screenshot.
