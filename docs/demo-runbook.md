# Demo runbook

English | [中文](demo-runbook.zh.md)

How to build and run the app on a laptop that has nothing prepared, and what to do when the network
or a provider fails during the Week 13 demonstration. Full environment-variable descriptions live in
[Development](development.md); this page lists only what a demo needs.

## Toolchain

| Tool | Version                                                     |
| ---- | ----------------------------------------------------------- |
| Node | 24.14.1 (`package.json` requires `>=22`)                    |
| pnpm | 9.15.0 (pinned by `packageManager`; use the pinned version) |
| Git  | 2.39.5                                                      |

## Build from a clean copy

```bash
pnpm install
pnpm build
pnpm --filter @trip/web start -p 3000
```

The original rehearsal on macOS 14.6.1 with the toolchain above built with no environment variables
in about 30 seconds and started in under a second, without build warnings. Rehearse on each demo
laptop; timings and warnings can differ.

`pnpm install` finishes in seconds only when the pnpm store already holds the packages. The rehearsal measured
829 MB of installed dependencies and 481 MB of `.next` output, about 1.3 GB together. These are disk
sizes; a cold-store download size and install time were not measured. **Install before the venue, not at it.**

## Environment variables

Names only. Never paste a key into this page, a commit, a fixture or a chat message.

| Variable                                                | Without it                                                                                                                                           |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEEPSEEK_API_KEY`                                      | Itinerary, dining and destination guide fall back to deterministic local plans and show the `fallback` provenance badge. The plan still completes.   |
| `SERPAPI_KEY`                                           | No live flight or hotel prices; `hotelsAndFlights` reports false.                                                                                    |
| `MAPS_API_KEY`                                          | With the default web map provider, places and routes fall back to free services; time zones resolve offline from coordinates.                        |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`                       | The workspace map uses its free fallback. If configured, restrict the browser key to the demo origins.                                               |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | No sign-in. On Vercel, missing auth configuration restricts data providers to mock; model calls depend separately on the model key.                  |
| `DATABASE_URL`                                          | The account routes answer 503; account sync is unavailable. Browser-local chats and trips remain stored. Sign-in still requires Clerk configuration. |
| `USE_MOCK_TOOLS`                                        | Defaults to mock. Set it to exactly `false` for live providers.                                                                                      |

`DEEPSEEK_API_KEY` changes whether the demonstration uses a model or deterministic local plans. Mock
data replaces the providers; it does not replace the model.

## Falling back to mock data

Mock data providers use local fixtures. For a deterministic planning rehearsal without model
network calls, also unset `DEEPSEEK_API_KEY` and any alternate model credentials. Browser map tiles
and configured sign-in can still require network access; mock mode is not a fully offline app.

- **Whole deployment:** leave `USE_MOCK_TOOLS` unset, or set it to anything other than `false`.
- **One run:** the top-bar data-mode toggle sends `x-trip-data-mode: mock` for that request. The
  toggle is disabled, and live is refused, for a visitor who may not spend the allowance.
- **Check what the server will actually do:** `curl http://localhost:3000/api/data-mode` reports
  `configured`, `liveAvailable` and which providers are configured.

A full five-agent plan completes in mock mode with no keys configured. Three sections carry the
`fallback` badge when no model key is present, as the table above describes.

`maps: true` reports configuration: a Google key is present or the web map provider allows the free
fallback. It does not test connectivity or prove that `MAPS_API_KEY` is valid.

## Assistants walkthrough

The Stage 2 assistants demo runs in mock mode with no keys, in English or Chinese, on desktop or phone.
Type `@` in the message box and pick an assistant from the menu (arrows, then Tab or Enter), or type its name.
The Specialist team button in the top bar, or the avatar button beside the trip title on a phone, opens the team panel.

1. Plan Tokyo from Sydney, 2027-02-01 to 2027-02-04, 2 adults, budget AUD 6000. While it runs, the avatars on the Specialist team button show who is working; the panel stays closed until you open it. Open it to see the Coordinator and the five specialists with their status. When the reply is done, press its summary line to open that run's panel.
2. Type `@` and pick Stay from the menu, then `find a cheaper stay`. Only the accommodation specialist works and only its section changes.
3. Lower the budget until the plan overruns, then repeat step 2. The panel shows the conflict, the specialist sent back for a revision, the revision score and the stop line.
4. Type `@Stay`, then press Backspace once to select the whole mention and again to delete it.
5. `@Stay @Getting around find cheaper options`. Exactly those two specialists work in one round.
6. `@Stay recommend a restaurant`. Stay declines and names Food & dining, the Coordinator dispatches, and Food & dining answers.
7. Press the summary line of the first reply, then Stay in its panel. The chat scrolls to that reply and expands Stay's thinking rows.
8. Settings → Personalization → Assistant names: rename Stay, then mention it by the new name. The menu, the panel and the replies show it.
9. Clear the browser data and send `@Stay when are hotels cheapest?`. The specialist answers, no plan is created, and the Coordinator asks for the trip details.

`CHANNEL=chromium DATA_MODE=mock USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e assistants-demo` repeats all nine steps at 1440 px and 390 px in both languages. It saves numbered screenshots (`<language>-<width>-NN-<step>.png`) and `output/playwright/assistants-demo/result.json` as the demo record.

## If something fails on the day

| Symptom                            | Action                                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| No network at the venue            | Use the prebuilt, rehearsed mock data and deterministic local fallback setup. Map tiles and configured sign-in may fail offline. |
| A provider errors or is over quota | The section degrades and says so in its provenance badge; carry on.                                                              |
| `REQUEST_DENIED` from Google       | The key is wrong, deleted, or its APIs are not enabled. Switch that laptop to mock.                                              |
| Port 3000 is taken                 | `pnpm --filter @trip/web start -p 3100`.                                                                                         |
| The build was never run here       | Stop. Installing at the venue takes minutes, not seconds.                                                                        |
