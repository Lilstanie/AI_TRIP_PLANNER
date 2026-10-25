# Development environment

English | [中文](development.zh.md)

## Prerequisites

- Node.js 22 or newer
- pnpm 9.15.0, pinned by `packageManager`; `corepack enable` selects it
- API keys are optional for local development: mock tools and deterministic fallbacks are enabled by
  default.

## Local setup

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev                     # http://localhost:3000
```

Keep real credentials in `.env.local` and never commit them. Use `pnpm` only so the workspace
lockfile stays consistent.

## Code organization

The web application is grouped by responsibility instead of keeping every component and helper in
one flat directory. Put new UI in the closest feature folder under `apps/web/components/`:
`workspace`, `chat`, `trip`, `map`, `preferences`, or `ui` for shared primitives. Put browser-safe
domain logic under the matching folder in `apps/web/lib/`; external clients belong in
`apps/web/lib/integrations/`. Put all web tests under `apps/web/tests/`, mirroring the `app`,
`components`, and `lib` feature groups; shared fixtures belong in `apps/web/tests/fixtures/` and
setup belongs in `apps/web/tests/setup.ts`. The package folders use the same rule: production code
stays under `src/`, while tests belong under each package's `tests/` directory.

When a feature crosses folders, keep the public contract in the domain module and import it from
there rather than creating a new root-level convenience file. Update this section and the API docs
when a directory boundary changes.

The web UI uses Tailwind CSS v4 with source-owned shadcn primitives. Tailwind is configured through
`apps/web/postcss.config.mjs` and imported from `apps/web/app/globals.css`; v4 does not use a
traditional `tailwind.config.js` in this project. `apps/web/components.json` configures the shadcn
CLI, while generated primitives live under `apps/web/components/ui/` and use `@/lib/utils` for
`cn()`. Keep the existing semantic tokens and migrate domain CSS incrementally under
`apps/web/app/styles/`; do not replace the custom focus-managed Dialog or Drawer without preserving
their keyboard and focus behavior.

### File size and style boundaries

Keep production source files and test files at or below 1000 lines of code. When a file exceeds that
threshold, split it by responsibility instead of adding more sections to the same file. CSS files
should use domain names such as `workspace-navigation.css`, `workspace-layout.css`,
`workspace-drawers.css`, and `workspace-responsive.css`; an aggregate file may remain small and
only contain ordered `@import` statements. Preserve import order when a split separates base rules,
overlays, and responsive overrides. Existing files that already exceed the threshold are migrated
incrementally when their domain is next changed; new or substantially modified files must not grow
past the threshold without documenting the exception.

Next.js API endpoints keep the framework-required `route.ts` filename. The directory path is the
route namespace, so `app/api/chat/route.ts` maps to `/api/chat` and does not conflict with
`app/api/places/search/route.ts`. Keep these files as thin Route Handler adapters and move reusable
business logic into `apps/web/lib/` or package `src/` modules. Do not rename `route.ts` merely to
make filenames unique.

Next.js only ever reads `.env*` files from the directory it runs in (`apps/web`), never from a
monorepo root — that lookup has no config option to redirect it, and it is re-applied by the dev
server's own file watcher, so pointing it elsewhere from `next.config.mjs` does not survive `next
dev`. `pnpm install` runs `scripts/link-env.mjs` as a `postinstall` step, which creates
`apps/web/.env.local` as a symlink to the root `.env.local` when the app file does not already exist.
The script deliberately does not overwrite an existing ordinary file; if that file is kept, all
runtime credentials must be configured there. On Windows this needs Developer Mode or an elevated shell;
if the symlink can't be created you can create it by hand:

```bash
ln -s ../../.env.local apps/web/.env.local
```

## Environment variables

Every variable is described in `.env.example`. The important ones:

| Setting                                                             | Purpose                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEEPSEEK_API_KEY`                                                  | Brief extraction from chat, all five specialists, the supervisor and chat replies. Without it a local rule parser handles extraction and agents use deterministic fallbacks.                                                                                                                                                    |
| `USE_MOCK_TOOLS=true` (default)                                     | In-process map and booking fixtures; no external calls.                                                                                                                                                                                                                                                                         |
| `USE_MOCK_TOOLS=false`                                              | Real map adapters chosen by `MAPS_PROVIDER` (`google` or `osm`). If unset, Google is used when `MAPS_API_KEY` is set, otherwise OpenStreetMap; `.env.example` sets `osm`. Booking uses SerpApi when `SERPAPI_KEY` is configured, with a Google Places hotel estimate fallback only when Google Maps and its key are configured. |
| `OSM_USER_AGENT`                                                    | Required contact string for Nominatim. Replace the `contact@example.com` placeholder before real traffic or you may be rate limited.                                                                                                                                                                                            |
| `MAPS_API_KEY`                                                      | Server-side Google Places, Routes and Time Zone for the workspace map and edit previews.                                                                                                                                                                                                                                        |
| `WEB_MAPS_PROVIDER`                                                 | The workspace's map provider: `google-with-fallback` (default; Google first, OpenStreetMap when Google cannot answer), `google` (never falls back) or `osm`. Separate from the agents' `MAPS_PROVIDER`. See [web map providers](architecture.md#web-map-providers).                                                             |
| `GOOGLE_MAPS_COOLDOWN_SECONDS`                                      | How long the workspace skips Google after an access-denied or quota failure (default 300).                                                                                                                                                                                                                                      |
| `OSRM_FOOT_BASE_URL`                                                | OSRM base URL for walking legs on the free fallback (default `https://routing.openstreetmap.de/routed-foot`, the FOSSGIS foot instance). Cars only at the demo server, so walking needs a foot profile.                                                                                                                         |
| `OSRM_BIKE_BASE_URL`                                                | OSRM base URL for cycling (default `https://routing.openstreetmap.de/routed-bike`); never uses the car instance.                                                                                                                                                                                                                |
| `OSRM_BASE_URL`                                                     | OSRM base URL for driving legs on the free fallback (default `https://router.project-osrm.org`, the public demo, which routes cars only). Also read by the agents' `MAPS_PROVIDER=osm`.                                                                                                                                         |
| `MOCK_GOOGLE_MAPS=unavailable`                                      | Test switch: in mock data mode the workspace treats Google as unavailable without calling it, so E2E can drive the fallback path. Ignored in live mode.                                                                                                                                                                         |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | Browser Google Maps JavaScript map. Without them the workspace shows a map fallback and the itinerary stays usable.                                                                                                                                                                                                             |
| `SERPAPI_KEY`                                                       | Shared SerpApi key for Google Hotels, Google Flights and inter-city Google Maps transit searches. It is used only when `USE_MOCK_TOOLS=false`; it does not replace Google Maps, Places, Routes or Weather APIs.                                                                                                                 |
| `WEATHER_API_KEY`                                                   | Google Weather forecasts for days 0–9; falls back to `MAPS_API_KEY`. Open-Meteo covers days 10–14 without a key.                                                                                                                                                                                                                |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN`                              | Durable Redis REST store for short-term chat turns, plans and SerpApi usage/cache. Without them, those values use process memory. Account-scoped dietary, pace, interests, accessibility, accommodation and departure-city memories use Postgres through `DATABASE_URL`.                                                        |

Accounts are optional and configured only in `.env.local` (these names are not in `.env.example`):

| Setting                                                 | Purpose                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk sign-in. Without the publishable key the workspace is single-user and local, and the account routes answer 503; a deployment without it (any environment where `VERCEL_ENV` is set) also serves mock data only, so an unauthenticated site cannot spend the provider allowance. `clerk init` also writes the sign-in route variables. |
| `DATABASE_URL`                                          | Neon Postgres (pooled connection string) for settings, trips and chats of signed-in users. Use a development branch locally; production gets it from the owner's integration.                                                                                                                                                               |

Create the tables with `pnpm --filter @trip/web db:migrate` (it loads `.env.local`); after changing
`apps/web/lib/db/schema.ts`, generate a migration with `pnpm --filter @trip/web db:generate` and
commit it under `apps/web/drizzle/`. On Vercel, the Clerk and Neon Marketplace integrations inject
the same names.

Agent Lab live runs are off unless the deployment enables them (these names are not in `.env.example`):

| Setting                            | Purpose                                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENT_LAB_LIVE_ENABLED`           | Exactly `true` lets `/agent-lab` offer live runs, which use the model and provider keys above. Anything else leaves live off; fixture data is never affected. |
| `AGENT_LAB_LIVE_MAX_CONCURRENT`    | Live runs in flight at once. Default `1`; `0` allows none; capped at `20`.                                                                                    |
| `AGENT_LAB_LIVE_MAX_RUNS_PER_HOUR` | Live runs that may start in a rolling hour. Default `6`; `0` allows none; capped at `1000`.                                                                   |

An unusable value falls back to the default, never to no limit. The counts are kept in one server process, so a
deployment that runs several instances applies the limits to each; size them for that.

Google key restrictions and map behaviour are described in [workspace UI](workspace-ui.md#google-maps-configuration).
Model routing and fallbacks are described in [architecture](architecture.md#agents-and-models).

## External data provider plan

Use the project [api-scout skill](../.agents/skills/api-scout/SKILL.md) to discover candidates in the
[public-apis catalog](https://github.com/public-apis/public-apis). Treat that repository as a changing
index only: verify access, pricing, quotas, data rights, freshness and geographic coverage in each
provider's official documentation before adding it to this table or implementing an adapter.

SerpApi is the provider for the project's current hotel and flight search layer. One
`SERPAPI_KEY` can be used for both SerpApi engines, but this does not make SerpApi a universal
travel backend:

| Capability                                            | Provider                                                                                                                                                       | Status and boundary                                                                                                                                                                                                          |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hotel search and indicative prices                    | [SerpApi Google Hotels](https://serpapi.com/google-hotels-api)                                                                                                 | Live search results when configured; remembered stay types affect search terms and cache keys, but returned property types are not independently verified. Results are planning data, not a reservation or guaranteed quote. |
| Flight search and indicative fares                    | [SerpApi Google Flights](https://serpapi.com/google-flights-api)                                                                                               | Search results and fares; it does not book tickets or provide the full operational status feed.                                                                                                                              |
| Interactive map                                       | [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/overview)                                                             | Browser-side map rendering with `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.                                                                                                                                                           |
| Place search and details                              | [Google Places API](https://developers.google.com/maps/documentation/places/web-service/op-overview)                                                           | Server-side place grounding with `MAPS_API_KEY`; place photos through `/api/places/photo`, billed per image and live mode only.                                                                                              |
| Routes and travel time                                | [Google Routes API](https://developers.google.com/maps/documentation/routes)                                                                                   | Route and distance checks for itinerary editing.                                                                                                                                                                             |
| Walking and driving fallback                          | [OSRM](https://project-osrm.org/) on FOSSGIS (`routing.openstreetmap.de`) and the demo server (`router.project-osrm.org`)                                      | Used when Google Routes cannot answer; see [web map providers](architecture.md#web-map-providers).                                                                                                                           |
| Inter-city rail where Routes has no transit (Japan)   | [SerpApi Google Maps Directions](https://serpapi.com/google-maps-directions-api)                                                                               | Transport's inter-city hops only; duration, services and a per-person fare converted to AUD for the group; falls back to driving.                                                                                            |
| Time zones                                            | [Google Time Zone API](https://developers.google.com/maps/documentation/timezone/overview), with an offline lookup (`@photostructure/tz-lookup`) when it fails | Destination-local time calculations.                                                                                                                                                                                         |
| Weather forecasts                                     | Google Weather API (days 0–9), Open-Meteo (days 10–14), Open-Meteo historical archive after day 14                                                             | Implemented in the tool gateway with explicit forecast/climate provenance; generic SerpApi web results are not treated as weather data.                                                                                      |
| Flight delays, gates and operational status           | Aviationstack or another aviation-status provider                                                                                                              | Optional future capability; not needed for hotel/flight price search.                                                                                                                                                        |
| Chat, preferences, trip plans and SerpApi usage/cache | Upstash-compatible Redis REST store                                                                                                                            | Configure `KV_REST_API_URL` + `KV_REST_API_TOKEN` in deployment; local/offline runs use an in-process fallback.                                                                                                              |

Travelpayouts and Aviationstack are therefore not required for the current MVP. Add them only if the
product needs affiliate inventory/booking flows or operational flight-status data. SerpApi also does
not replace durable application storage.

The key must be set in the environment read by Next.js, normally `apps/web/.env.local` (or the
repository root `.env.local` when the workspace symlink is present). A key copied only into
`Downloads/dp.txt` is an inventory note and is not loaded by the application. For real provider
traffic, use:

```env
USE_MOCK_TOOLS=false
SERPAPI_KEY=your-serpapi-key
```

Keep real credentials out of Git and out of committed documentation.

For deployed durability, configure the Vercel project with `KV_REST_API_URL` and
`KV_REST_API_TOKEN` (the equivalent `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` names are also accepted). The shared Redis REST store backs chat turns,
preferences, generated trip plans, and SerpApi usage/cache state. Without those
variables, local tests and offline development use an in-process fallback and should not be treated
as a production deployment check. Redis commands are POST JSON arrays in the request body, including large plans; requests have a five-second deadline. Short-term chat history retains the latest 20 turns. A completed chat plan is streamed before its optional durable copy is saved; the stream waits at most five seconds for that save, and logs a persistence failure separately from planning failure.

## Mock server

`pnpm mock-server` starts an optional stub HTTP server on port 4000. The app never calls it: mock
tools run in process. It is kept for adapter
experiments and is started by Docker Compose.

## Docker

```bash
docker compose up
```

The compose file starts the web app on port 3000 (reading `.env.local`) and the stub mock server on
port 4000. Redis is optional and commented out.

## Installable app

The site is a Progressive Web App, so the same deployment installs on every device; see the
[Agent Note](../.agents/notes/implemented/feature/2026-10-05-installable-app.md) for why.

- **Computer**: Chrome or Edge shows an Install button in the address bar.
- **iPhone**: Safari's Share menu, then Add to Home Screen.
- **Android**: Chrome's menu, then Install app.

The web side is `apps/web/app/manifest.ts`, the icons in `apps/web/public/icons/` and
`apps/web/public/sw.js` (navigations fall back to `public/offline.html`; nothing dynamic is cached).
The service worker registers only in production builds. Check installability against a production server:

```bash
pnpm --filter @trip/web e2e installable-app --prod
```

It writes screenshots and `summary.json` to `output/playwright/installable-app/`. Chrome's
installability check runs in full Chromium (`CHANNEL=chrome` uses Chrome instead) with a throwaway
persistent profile, and also confirms it reports a page whose manifest link is removed.

## Licence and third-party code

The repository is MIT licensed (see [LICENSE](../LICENSE)), and every `package.json` declares
`"license": "MIT"`. When you vendor or port code from another project, keep its header notice and record it in
[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) in the same pull request: name, upstream URL, licence,
copyright line and the files that contain it.

## Agent workflows

Project skills live directly under `.agents/skills/<name>/SKILL.md`. The categories below are
navigation groups; each skill retains its own discoverable entrypoint and loads references on demand.

`vercel-react-best-practices` provides React and Next.js performance references;
`playwright-best-practices` provides browser test implementation and debugging references. Both are
installed locally in this project and load relevant reference files on demand. Project instructions
own test strategy, runner commands and acceptance evidence; upstream examples are technical guidance
within those rules. The current E2E runner remains the execution entry point. Installing these skills
does not add npm dependencies or configure `@playwright/test`. Source revisions, local adaptations and
update rules are recorded in the [integration decision](../.agents/notes/implemented/process/2026-10-11-framework-reference-skills.md).

Use `review-trip-planner` for repository-specific risks. The global `code-review-standards-spec` skill coordinates Standards and Spec review. OCR plugin skills keep their own `open-code-review` and `open-code-review-delegate` names.

[review-trip-planner](../.agents/skills/review-trip-planner/SKILL.md) owns the review handoff packet
and the added-comment gate. Its references describe the CLI, explicit file scope,
justified exceptions and standalone acceptance evidence. The independent
[Comment policy workflow](../.github/workflows/comment-policy.yml) invokes the same checker on PRs
and main pushes. PR scope covers merge-base to head; push scope covers the previous tip to head.
Only changed JS/TS paths are selected, preserving unchanged comments across detected renames.
No supported paths explicitly skip; missing history, invalid configuration and checker errors fail.
The versioned exact exception list is reviewed with the code; matching text does not approve its
rationale. Reports and regression summaries are retained for seven days. The job installs dependencies
without lifecycle scripts and needs no browser. Required-check settings are configured separately.
Its acceptance covers JSX text boundaries and files recreated after staged deletion.

| Area                                | Skills                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React and browser test references   | [vercel-react-best-practices](../.agents/skills/vercel-react-best-practices/SKILL.md), [playwright-best-practices](../.agents/skills/playwright-best-practices/SKILL.md)                                                                                                                                                                                                               |
| Interface design and effects        | [better-layout](../.agents/skills/better-layout/SKILL.md), [better-ui](../.agents/skills/better-ui/SKILL.md), [better-accessibility](../.agents/skills/better-accessibility/SKILL.md), [better-writing](../.agents/skills/better-writing/SKILL.md), [libraries-dev](../.agents/skills/libraries-dev/SKILL.md)                                                                          |
| Feature and provider implementation | [end-to-end-feature-wiring](../.agents/skills/end-to-end-feature-wiring/SKILL.md), [api-scout](../.agents/skills/api-scout/SKILL.md), [add-provider](../.agents/skills/add-provider/SKILL.md), [agent-experience](../.agents/skills/agent-experience/SKILL.md)                                                                                                                         |
| Review and verification             | [review-trip-planner](../.agents/skills/review-trip-planner/SKILL.md), [find-simplifications](../.agents/skills/find-simplifications/SKILL.md), [break](../.agents/skills/break/SKILL.md), [ui-verification](../.agents/skills/ui-verification/SKILL.md), [pre-push-checks](../.agents/skills/pre-push-checks/SKILL.md), [e2e-maintenance](../.agents/skills/e2e-maintenance/SKILL.md) |
| Documentation and decisions         | [prose-standard](../.agents/skills/prose-standard/SKILL.md), [translate-docs](../.agents/skills/translate-docs/SKILL.md), [agent-notes](../.agents/skills/agent-notes/SKILL.md), [session-log](../.agents/skills/session-log/SKILL.md), [skill-maintenance](../.agents/skills/skill-maintenance/SKILL.md)                                                                              |

Use [e2e-maintenance](../.agents/skills/e2e-maintenance/SKILL.md) when diagnosing or repairing the test itself. It compares equivalent baseline/current runs, checks assertions and process results, and retains successful and deliberate-failure controls through the existing runner. Application UI acceptance stays with [ui-verification](../.agents/skills/ui-verification/SKILL.md); outgoing check selection stays with [pre-push-checks](../.agents/skills/pre-push-checks/SKILL.md).

`pnpm verify:docs` also checks every skill with `scripts/skill-rules.mjs`, in two tiers. These rules fail the
check: a lower-case kebab-case `name` that matches the folder (at most 64 characters); a `description` of
at most 1,024 characters that says what the skill does and when to use it ("Use when …"); a `compatibility`
field of at most 500 characters; supporting files only under `references/`, `scripts/` and `assets/` (plus a
licence file); and references that do not link to other references or into another skill's references. They
come from the [Agent Skills specification](https://agentskills.io/specification) and this project's layout.
These are advisories, printed without failing the check: a `SKILL.md` over 500 lines (the specification
recommends staying under it), name, description and `when_to_use` over 1,536 characters together (the
trigger budget Claude Code shows per skill), and frontmatter fields the script does not know.
`pnpm test:scripts` runs the rule tests, and CI runs it after `pnpm test`.

The Libraries.dev skill supports `libraries reveal`, `libraries review` and `libraries apply`.
It selects concrete effects within the [workspace design contract](design/ui-guidelines.md), while
`better-ui` owns general visual polish and `ui-verification` owns browser acceptance.
Installing the skill adds instructions and references; npm packages are added only for an authorized
effect implementation. The [integration decision](../.agents/notes/implemented/process/2026-09-26-libraries-dev-project-skill.md)
records its source and grouping rationale.

Use [find-simplifications](../.agents/skills/find-simplifications/SKILL.md) for evidence-backed
removal proposals and authorized cleanups. Use
[prose-standard](../.agents/skills/prose-standard/SKILL.md) to edit technical documentation and
comments without losing behavior or failure guarantees;
[better-writing](../.agents/skills/better-writing/SKILL.md) owns interface voice and terminology.
These workflows follow the project's existing protection and validation rules. Their adaptation is
recorded in the [Agent Note](../.agents/notes/implemented/process/2026-09-26-simplification-prose-skills.md).

[agent-experience](../.agents/skills/agent-experience/SKILL.md) guides model-facing tool definitions
and context delivery. [translate-docs](../.agents/skills/translate-docs/SKILL.md) maintains the
[English/Chinese documentation pairs](i18n.md); changing either language includes updating its
counterpart in the same task.

### Fix root causes

When a bug is fixed, reproduce it, name its cause with evidence, and fix that cause. Do not hide the
symptom with a retry, a longer timeout, an extra guard or a special case. If a workaround is the only
option for now, say so in the pull request and the session log, with the cause it leaves in place.

## Verification

For documentation changes, also run the local pairing check after reviewing and recording the
changed pairs. This is separate from `pnpm verify:docs`; CI runs it for pull requests:

```bash
node .agents/skills/translate-docs/scripts/check-pairs.mjs
```

### Testing approach

For complex features, prefer an end-to-end (E2E) test as the sole behavioral test: exercise the
complete user path and leave a repeatable, reviewable artifact such as a report, trace or screenshots.
Record the command and the steps or fixtures needed to reproduce it. Never write unit tests after
writing implementation code. If a system must be tested in isolation, first enumerate all the ways it
could fail, then write the code and derive the isolated checks from that list.

This describes the preferred approach for new work. CI runs the Vitest suites through `pnpm test` and
the repository script tests (`scripts/*.test.mjs`) through `pnpm test:scripts`. CLI acceptance uses
[change selection and isolated CI workers](#cli-acceptance-in-ci), including its fixture browser
journeys, with logs, summaries and browser evidence retained for seven days even on failure. The remaining raw browser scripts
are local checks, so run the relevant one before pushing; known failures on `main` are listed in
[e2e-known-failures.md](e2e-known-failures.md). CI does run `pnpm verify:e2e-selectors`, which
fails when an E2E script selects a CSS class (`.section__row`) that no component, page or library file under
`apps/web` renders any more; a rule left in a stylesheet does not count. It needs no server and takes well
under a second. A line that checks a removed class stays gone ends with `// e2e-selectors: absent`; a class
only a third-party library sets goes in `ALLOWED` in `scripts/verify-e2e-selectors.mjs`, with its reason.

The E2E scripts live in `apps/web/tests/e2e/`. For a fixture-only invocation with an owned server and separate evidence, use the [local E2E CLI](local-test-cli.md). Otherwise, run scripts through the runner, which starts a server on
a free port, runs each named script against it from the repository root and stops only the server it
started:

```bash
pnpm --filter @trip/web e2e timeline display-currency     # names without .e2e.mjs; 'phone-*' works
pnpm --filter @trip/web e2e phone-shell --prod            # next build + next start, for scripts that ask for it
BASE_URL=http://localhost:3000 pnpm --filter @trip/web e2e settings   # against a server already running
```

The environment reaches both the server and the scripts, so set `DATA_MODE` and provider variables as
each script's header says. Each invocation allocates a unique `apps/web/.next-e2e-<random>` directory
and an owned temporary TypeScript config, so concurrent runs and `pnpm dev` never share build output
or edit the shared TypeScript config. The runner deletes its directory and its `.next-e2e-<random>.lock` owner file when it exits,
whether the run passed, failed or was interrupted. A run killed outright leaves them behind; the next
run removes any directory whose owner process has exited, or that has no owner and is over a day old. An inherited `NEXT_TSCONFIG_PATH` remains an explicit override. The runner exits non-zero when any
script fails and writes a summary to `output/e2e/runner/<time>.json`. Each script has
`E2E_SCRIPT_TIMEOUT_MS` (default 600000, ten minutes) to finish; a script still running then is stopped with
the browsers it launched, shown as `TIME` in the summary (`"timedOut": true` in the JSON), and the next script
runs. A timeout also makes the run exit non-zero. Playwright is an `apps/web`
dev dependency; on a new machine run `pnpm --filter @trip/web exec playwright install chromium` once.
Scripts that need two servers (`agent-lab-live-gate`) still run by hand as their header describes.
`pnpm dev` and `pnpm start` use port 3000 unless `PORT` is set.

<a id="agent-lab-benchmark"></a>

### Agent Lab benchmark

Run `pnpm --filter @trip/web e2e agent-lab-benchmark` to fetch the versioned registry, run every
scenario-strategy pair once in fixture mode, execute all registered fault profiles, write a report
from those exact artifacts, and replay a retained artifact in `/agent-lab`. The retained
`output/playwright/agent-lab-benchmark/` directory contains the JSON and Markdown fixture report,
per-run NDJSON and artifacts, summary, and replay screenshot. The script's header records its failure
inventory. Fixture reports do not assess plan quality.

Live comparison is opt-in: set `AGENT_LAB_BENCHMARK_LIVE=true` only when the local deployment has
live runs enabled. It covers the three registered live scenarios and supported strategies, with up to
three repeats per pair; every call passes through the deployment's existing gate, and the script stops
after a refusal. It writes a separate live report with actual attempts, refusals, skipped strategies,
latency median and spread. Do not combine it with fixture figures. For controlled deployment smoke,
record the commit, providers actually called, outcome and call cap in the
[release record template](agent-lab-release-record-template.md); never put credentials in the record.

A script that cannot run without a key says so in its header, before its code:
`// requires-env: DEEPSEEK_API_KEY` (several keys are separated by commas). When a named variable is unset
or empty the runner does not run the script. It reports `skipped: needs DEEPSEEK_API_KEY`, records the skip
in the summary, and still exits 0 if nothing else failed; a script that ran and failed still exits non-zero.
If every named script is skipped, no server is started. `plan-quality` and `conversation-scope` declare
`DEEPSEEK_API_KEY`, because they check what the model produces and fail on the rule-based fallback.
A malformed `requires-env` line stops the runner with an error instead of running the script.

- **API scripts** (`plan-quality`, `conversation-scope`) post to `/api/chat` with `DATA_MODE=live`
  (default) or `mock`. `plan-quality` plans three fixed briefs and checks budget, unresolved conflicts,
  itinerary source, repeated and generic stops, and exits non-zero when any check fails or a plan
  errors; live model output varies, so compare several runs.
  Each run writes the NDJSON streams, plans and `summary.json` to `output/e2e/<name>/<run>/`.
- **Browser scripts** (every other script, including the eight `agent-lab-*` ones) drive Playwright at
  desktop and phone widths and write screenshots, and for Agent Lab the raw NDJSON and artifacts, to
  `output/playwright/<name>/`. `CHANNEL=chrome` and `PLAYWRIGHT=<path>` select the browser and the
  Playwright package.

`output/`, `apps/web/output/`, `tmp/` and `.scratch/` are Git-ignored scratch directories, and `output/` grows by gigabytes. Run `pnpm clean:output` once the evidence has been quoted in the pull request; `pnpm clean:output --dry-run` lists sizes first. It refuses to run if any tracked file lives under those directories. After a pull request is merged or closed, delete its remote branch (see [pre-push-checks](../.agents/skills/pre-push-checks/SKILL.md#5-after-the-merge)). Each script's header lists the failure inventory it was written from and
any server environment it needs. Fixture runs are isolated from the deployment's keys and data-mode default, so the
Agent Lab scripts pass whatever the environment holds; `agent-lab-live-gate` also uses two servers with live enabled
(see its header). `agent-lab-release` walks the whole public flow and writes the release evidence: raw NDJSON,
versioned artifacts, a comparison summary, a report and a screenshot matrix (light and dark, desktop and narrow,
reduced motion). Release smoke keeps `provider-empty-result` as the representative fault journey;
`agent-lab-failures` owns all five registered fault profiles, their outcomes, downloads and offline replay,
plus Run all sequencing and cancellation. Run both scripts when changing Failure Lab behavior.

`auto-save-places`, `plan-revision` and `check-entry-point` share only place fixtures, workspace boot,
day-to-plan conversion and polling in `apps/web/tests/e2e/trip-setup.mjs`. Every 44 px touch-target check uses its
`touchSized(pixels)`, which rounds sub-pixel layout sizes first; call it in Node, not inside `evaluate`. Each script owns its scenario
assertions, request interception, held responses and screenshots; concurrency and cancellation setup
stay beside the scenario they verify. [Coverage ownership](../.agents/notes/implemented/simplification/2026-10-10-repository-surface-reduction.md)
records the assertion consolidation boundaries.

`apps/web/tests/e2e/leg-mode-choice.e2e.mjs` checks that a travel mode the traveller chose for one
hop (`TripBrief.legModes`) is the mode the plan uses, or is reported as unavailable — never silently
swapped. Four scenarios need no model (the choice arrives on the brief) and one does (the traveller
says it in chat); without a model key that one reports `skip` rather than failing. Artifacts land in
`output/e2e/leg-mode-choice/<run>/`.

```bash
DATA_MODE=mock pnpm --filter @trip/web e2e leg-mode-choice
```

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:scripts
pnpm build
```

CI (`.github/workflows/ci.yml`) runs these five commands on Node 22 for pull requests and pushes
to `main`, after `pnpm verify:e2e-selectors` and `pnpm verify:e2e-artifacts`, which fails when an
`apps/web/tests/e2e` script writes no artifact.

`pnpm lint` covers `apps/web` (`next lint`, config in `apps/web/.eslintrc.json`) and every package under
`packages/` (ESLint with the shared flat config `eslint.config.mjs` at the repository root). Unlike
`apps/web`, the packages do not ban `.toFixed(2)`, because that rule points at the web Money module.

CI also runs `node scripts/format-check-changed.mjs <base>` (`pnpm format:check-changed`), which checks
Prettier formatting only on files that changed against the pull request base, or against the previous tip on
a push. The repository still holds files that were never formatted, so run Prettier on the files you
changed (`npx prettier --write <file>`), never on a directory or with `pnpm format`. `pnpm install` points Git
at `.githooks/` (`core.hooksPath`, through `scripts/install-git-hooks.mjs`), whose `pre-push` hook runs the same
check against `origin/main` and refuses a push with unformatted files. When the pushed branch changes
`apps/web/`, the hook also runs `pnpm --filter @trip/web typecheck`. `git push --no-verify` skips it once. The
installer does nothing in CI or outside a Git checkout, and leaves a hooks path set for another tool alone.

On pull requests, the `protected-files` job runs `node scripts/verify-protected-files.mjs`,
`node scripts/verify-docs.mjs`, the pair check and `node scripts/verify-branch-name.mjs <head-branch>`. The
branch check fails when the head branch does not start with `feature/`, `fix/`, `refactor/`, `docs/`,
`chore/` or `test/`, or contains an AI tool name; Dependabot branches are exempt.

Before marking a PR ready for delivery, run the read-only preflight below with `gh` authenticated.
It requires a clean checkout on the PR branch at the exact open PR head, a `main` base, and nonempty
Summary, Evidence and Merge Danger sections. All reported head checks must be `SUCCESS` except a
`CI / cli-acceptance-workers` skip accompanied by successful `CI / cli-acceptance-plan` and
`CI / cli-acceptance` checks from the same Actions run; the aggregate validates the documentation-only plan. The checker does
not judge Evidence wording, push, merge, close PRs or delete branches. Its fixture self-check is not
evidence of GitHub CI.

```bash
node scripts/pr-delivery-status.mjs <pull-request-number>
```

To prove that a fix turns an E2E script from failing to passing, name the script and the source
paths it tests. The command runs the script with those paths at their `origin/main` version, then
with the working tree, restores the working tree even when interrupted, and exits 0 only when the
first run fails and the second passes. Paste its last two lines into the PR's Evidence section.
`--base <ref>` compares with another revision; its failure inventory is
[scripts/redgreen.failures.md](../scripts/redgreen.failures.md).

```bash
node scripts/redgreen.mjs <e2e-name> [--prod] -- <source-path>...
```

Run focused packages with `pnpm --filter @trip/agents test`, `pnpm --filter @trip/orchestrator test`
or `pnpm --filter @trip/web test`. The web test script sets `NODE_OPTIONS` with POSIX shell syntax;
on Windows, run it from WSL or Git Bash.

If you run `pnpm build` while `pnpm dev` is running, start the dev server with
`NEXT_DIST_DIR=.next-dev` so the two do not share the `.next` output directory.

Free map endpoints are configurable with `PHOTON_BASE_URL` (default `https://photon.komoot.io`),
`NOMINATIM_BASE_URL` (default `https://nominatim.openstreetmap.org`) and `TRANSITOUS_BASE_URL`
(default `https://api.transitous.org`). Set `OSM_USER_AGENT` to a real project contact. Public service
limits and deployment boundaries are in [architecture](architecture.md#free-services-limits-and-terms).

Repeat fallback UI checks with `CHANNEL=chrome DATA_MODE=mock USE_MOCK_TOOLS=true MOCK_GOOGLE_MAPS=unavailable pnpm --filter @trip/web e2e map-fallback`. Clear all model, Maps and
Clerk key variables when testing locally. Screenshots and summary are in
`output/playwright/map-fallback/after`. `map-provider-http` tests real API handlers against local
upstreams: set `MAP_STUB_PORT` to a free port and all three base URLs above to
`http://127.0.0.1:$MAP_STUB_PORT`, with `WEB_MAPS_PROVIDER=osm`; it records throttle timestamps,
cache hits, language, bounds and transit parsing in `output/e2e/map-provider-http/summary.json`.

`RUN_LIVE_MAP_CHECK=1 WEB_MAPS_PROVIDER=osm CHANNEL=chrome USE_MOCK_TOOLS=true pnpm --filter @trip/web e2e map-fallback-live` opts into real free services. The chat reply alone uses fixtures; place lookup, tiles and the walking route are live. Results and desktop/phone screenshots are in `output/playwright/map-fallback-live/after`. This does not establish transit coverage in every destination.

`real-clerk-auth.e2e.mjs` needs an already running local server with Clerk test keys and a migrated
account database. Run `BASE_URL=http://localhost:3197 CHANNEL=chrome node apps/web/tests/e2e/real-clerk-auth.e2e.mjs`
with `CLERK_SECRET_KEY` and `DATABASE_URL` supplied through the environment. The ordinary E2E runner
starts a server without Clerk, so it cannot start this acceptance environment. The script provisions
two unique test users, uses genuine Clerk sessions, checks account isolation and removes only its own
users and database rows. It refuses live Clerk keys and remote application URLs. Sanitized assertions
and cleanup results are retained under `apps/web/output/playwright/real-clerk-auth/after/summary.json`;
no session tokens or storage states are retained. This does not verify expired valid JWTs, production
configuration without Clerk or the daily quota policy pending #440.

`LABEL=<unique-attempt> node apps/web/tests/e2e/neon-memory-driver.e2e.mjs` exercises account-memory
writes through the installed Neon WebSocket client and Drizzle session; existing reads and undo use
the installed HTTP adapter. Only the test transport is replaced with in-process PGlite PostgreSQL
wire/HTTP responses. It needs no credentials or external database and writes
`output/e2e/neon-memory-driver/<unique-attempt>/summary.json`. The probe covers commit, rollback,
legacy accommodation values, account-scoped undo and client cleanup, including connection failures.
Its sequential transport does not establish independent-session Neon concurrency; the existing
`accommodation-memory` fixture covers concurrent patches and undo races separately. Neither test
establishes remote Neon or real Clerk acceptance.

#### CLI acceptance in CI

The builtin-only `cli-acceptance-plan` job checks out full Git history and compares the merge base of
explicit PR base/head SHAs through the PR head. Selection includes every PR commit, additions,
deletions and both sides of renames. Event SHAs enter fixed commands through environment variables.
The JSON plan records changed paths, matched rules, the discovered inventory, selected scripts and
shard assignments; workers receive that exact plan as an artifact.

- Ordinary documentation can skip CLI acceptance only when every changed path qualifies and the
  inventory is reviewed. Skills and repository instructions are not a general documentation exemption.
  The reviewed infrastructure inventory includes `ci-integration.e2e.mjs`.
- Reviewed dependency rules select the union of their scripts. Shared infrastructure, unknown paths,
  unclassified acceptance scripts or missing expected scripts require full coverage. Missing history,
  invalid revisions and failed comparisons also fall back to full coverage with a reason.
- Empty or unsafe inventory is a planning failure. Every push to `main` selects the complete current
  inventory on that checked-out commit, including merged deliveries.

`cli-acceptance-workers` starts only for a successful non-skip plan. Its dynamic matrix contains one to
three nonempty shards, each on an independent runner with its own checkout, dependency tree and browser
setup. Scripts stay serial within a shard because fixtures temporarily replace dependency entrypoints.
Matrix failure does not cancel other shards. Each selected script is assigned exactly once; duration
estimates affect placement only and do not promise a total CI duration.

The stable `cli-acceptance` aggregate always runs. It validates the plan and requires either an explicit
skip with skipped workers and no worker receipts, or successful workers with exactly one successful
receipt per planned shard, bound to the transferred plan's digest. Planning failure, missing plans or
receipts, failed or cancelled workers and malformed plans cannot pass. A genuine documentation skip
avoids dependency and browser setup; the existing document and protected-file checks still run.
Plan, worker-result and evidence artifact names include run ID, attempt and planner/shard identity,
with seven-day retention. Before upload, `node apps/web/tests/cli-e2e/package-evidence.mjs` archives
only `output/e2e/` and `output/playwright/`, including partial failure evidence and hidden fixture files,
into `output/cli-evidence/evidence.tar.gz`. Internal filenames and bytes remain unchanged; the safe
outer filename avoids artifact-service filename restrictions. Nested symlinks are retained without
following their targets. Packaging accepts either evidence tree, fails visibly when neither exists,
and publishes the archive only after successful completion. Packaging or upload failure still fails
the worker and aggregate; an earlier or partial archive cannot substitute for the current attempt.
Extract downloaded evidence with `tar -xzf evidence.tar.gz`.

To reproduce selection, supply the PR's explicit base/head SHAs in the environment. Run a planned shard
from its plan, or use the unchanged no-argument command for the complete local suite:

```bash
node apps/web/tests/cli-e2e/select.mjs --event pull_request --base "$BASE_SHA" --head "$HEAD_SHA" --output output/e2e/cli-plan/plan.json
node apps/web/tests/cli-e2e/run.mjs --plan output/e2e/cli-plan/plan.json --shard 1
node apps/web/tests/cli-e2e/run.mjs
```

Use `--event push` to reproduce full main selection. A skip plan is handled by CI and is rejected by
the worker command. Shard summaries retain the plan, reproduction command, per-script logs and
passed, failed, interrupted or unrun outcomes. Focused subprocess acceptance uses
`node apps/web/tests/cli-e2e/ci-integration.e2e.mjs`; it retains copied fixtures and command/result
JSON under `output/e2e/ci-integration-*/`. This proves command behavior locally, not GitHub scheduling.

Related tickets use one integration branch and PR by default. For separate dependent PRs, verify their
combined integration state before merging; independently passing selections do not establish that
state. Full main results are post-merge regression evidence tied to the exact main SHA, never a promise
of full pre-merge gates or a result reused from an earlier SHA. The
[CI selection decision](../.agents/notes/implemented/process/2026-10-12-cli-acceptance-ci.md)
records the scheduling rationale and retained serial execution boundary.

#### Workspace performance acceptance

```bash
node apps/web/tests/e2e/run-performance.mjs
```

This local command reuses the CLI fixture environment and the raw runner's owned production build,
server and temporary TypeScript config. It blanks known integration credentials, forces mock tools,
disables Agent Lab live runs and supplies the synthetic browser Maps key `map-animation-fixture`.
Run it separately from CLI acceptance, which temporarily changes dependency entrypoints.

The workspace journey measures 10- and 200-message histories on desktop and 200 messages on phone;
it checks one catalog write per settled input save, reload, quota retry, switch-time flush, rename,
layout persistence, planned snapshot mirrors and stale-tab storage guards. Its second-tab case writes
the revision protocol directly and does not test the plan-edit API. The map journey controls visibility
and animation frames with a Google-compatible SDK stub, and checks actual MapLibre with an empty style.
It covers hidden panels, background documents, reduced motion, retained camera/selection and unmount.
It does not call Google or verify live map services.

Each command allocates a new label. Logs and the overall summary are under
`output/e2e/performance-acceptance/<label>/`; screenshots, workspace traces, CPU profiles and JSON are
under `output/playwright/{workspace-performance,map-animation-lifecycle}/<label>/`.
MessageItem counts are V8 function calls during the measured typing/save or synthetic stream window,
not React commits or DOM changes. Timings include debounce and profiling overhead; these fixtures do
not establish real-user Core Web Vitals or a speedup. To compare another revision, build it separately,
then run the workspace script with `BASE_URL=<owned-server> LABEL=before-<unique-label>`; a `before-`
label records the baseline write count without requiring the optimized count. Preserve failed attempts.

Account-memory integration with planning-readiness and typed budget revisions is checked with
`pnpm --filter @trip/web e2e long-term-memory accommodation-memory memory-settings planning-readiness`.
These journeys use disposable PGlite and deterministic provider fixtures; they do not establish
Clerk, external database or live-provider acceptance. Migration `0002` still needs separate
authorization before deployment to an external database.
