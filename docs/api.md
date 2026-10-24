# API entry points

English | [中文](api.zh.md)

The Next.js route handlers live under `apps/web/app/api/`. `/api/data-mode` and `/api/places/photo` are
`GET` handlers; the remaining routes use the methods shown below. Request bodies are validated with Zod, and planning outputs are
validated against the shared contracts in `packages/shared/src/`.

| Path                                                        | Purpose                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------- |
| [`/api/chat`](#post-apichat)                                | Extract brief updates or plan a submitted brief, streaming progress |
| [`/api/agent-lab/runs`](#post-apiagent-labruns)             | Run a registered, inspectable fixture experiment                    |
| [`/api/agent-lab/benchmark`](#get-apiagent-labbenchmark)    | Read the versioned Agent Lab benchmark configuration                |
| [`/api/data-mode`](#get-apidata-mode)                       | Default data mode and whether live provider keys are configured     |
| [`/api/places/search`](#post-apiplacessearch)               | Google Places text search                                           |
| [`/api/places/details`](#post-apiplacesdetails)             | Google place details for a place ID                                 |
| [`/api/places/photo`](#get-apiplacesphoto)                  | Redirect to one Google place photo                                  |
| [`/api/routes/from-location`](#post-apiroutesfrom-location) | Route from a user-approved location to a place                      |
| [`/api/trip/preview-edit`](#post-apitrippreview-edit)       | Preview an itinerary edit with route and budget checks              |
| [`/api/account/settings`](#get-and-put-apiaccountsettings)  | Read or save the signed-in traveller's settings                     |
| [`/api/account/sync`](#get-and-post-apiaccountsync)         | Pull or push the signed-in traveller's trips and chats              |
| [`/api/account/export`](#get-apiaccountexport)              | Download everything the account holds as JSON                       |
| [`/api/account/memory`](#get-and-delete-apiaccountmemory)   | List or delete the signed-in account's long-term memories           |
| [`/api/account/memory/undo`](#post-apiaccountmemoryundo)    | Undo the latest memory change for the signed-in account             |
| [`/api/account`](#delete-apiaccount)                        | Delete the account and its data                                     |

The browser sends the current plan or brief with each request and keeps its workspace in local
storage. Account long-term preferences are stored separately in Postgres and are always scoped by
the Clerk identity resolved on the server; the client-supplied `brief.userId` is ignored. Signed-out
planning remains available without account memory.

<a id="failure-bodies"></a>

Failure bodies of the app's own routes (`/api/chat`, the places routes, `/api/routes/from-location`,
`/api/trip/preview-edit` and the account routes) are `{ error, notice }`. `error` is the English
sentence for logs and older clients; `notice` is the same failure as a `Notice` that the interface
shows in the chosen language: `{ key, params }` for the app's own wording, or `{ raw }` for text
passed on exactly as raised (`apps/web/lib/i18n/notice.ts`). Agent Lab keeps its own error shape.

## `POST /api/chat`

Contract: `ChatRequest`, `ChatResponse` and `AgentProgressEvent` in `packages/shared/src/chat.ts`.

```json
{
  "tripId": "trip-123",
  "message": "Make the budget 2500",
  "brief": {
    "tripId": "trip-123",
    "userId": "demo-user",
    "destination": "Tokyo",
    "dates": ["2026-10-01", "2026-10-04"],
    "groupSize": 2,
    "budgetTotal": 3000
  }
}
```

`brief.destination` holds the cities to visit, in visit order, joined with `&`
("Sydney & Wollongong"); `cities` in `@trip/agents` and the Where editor both read that form. The
model extraction supplies that form directly. Offline extraction normalises explicit `&` and `、`
separators. A name containing "and", such as "Trinidad and Tobago", asks the traveller to keep the
full name or confirm separate stops before planning. Confirmation retains the collected trip fields;
an existing plan stays unchanged until the answer arrives. Structured model results are not split
again by a conjunction heuristic.

`brief.preferences` and `known.preferences` are optional: the traveller's own trip preferences
("Vegetarian food", "No early starts"), at most `MAX_TRIP_PREFERENCES` (12) entries of 1 to
`MAX_TRIP_PREFERENCE_LENGTH` (200) characters after trimming, both in
`packages/shared/src/contracts.ts`. They come only from the trip preferences editor; the coordinator
never writes them, and every specialist and the supervisor receive them with the brief. `nationality`
and `accommodation` are still accepted and passed through, but no current screen sets them.

Four more optional fields on `brief` and `known` come from the conversation:

- `learnedPreferences` has the same limits as `preferences` and holds the wishes the coordinator
  heard in chat. Specialists receive it appended to `preferences`.
- `excludeFlights: true` means the traveller arranges flights. Flown hops are then unpriced
  "arranged by you" items, with no fares and no `flights` selection.
- `bookedStay: { name, note? }` is a stay the traveller has booked. The accommodation section is that
  one unpriced item, with no `stays` candidates.
- `noAccommodation: true` means the traveller does not need a stay. The accommodation specialist is
  skipped and no stay allocation is made. It is independent of `bookedStay`; absent or `false` keeps
  the existing accommodation-planning behavior. A same-day trip (`dates[0] === dates[1]`) requires it
  and a single destination.

Removing a saved optional value from Trip preferences omits it from the request. `noAccommodation`
is a separate explicit choice: turning it off sends `false`, so it can override a previously saved
`true` value.

`brief.displayCurrency` and `known.displayCurrency` are optional too: one of `AUD`, `CNY`, `USD` or `JPY`
(`Currency` in `packages/shared/src/money.ts`), the last currency the traveller named for the trip, with
a budget or on its own. The coordinator's `update_trip_brief` tool takes it as `displayCurrency` without
an amount; with no key, the offline extractor sets it from any currency it detects in the message, with
or without a budget. A later naming replaces it, naming AUD sets AUD, and a message that names none
leaves it as it was. It is display only: planning stays in AUD and `budgetSource` is not rewritten.
Absent until a currency is named, and in briefs saved before the field existed; the client then reads
`effectiveCurrency(brief, settings.displayCurrency)`, which falls back to `budgetSource.currency` and
then to the Settings currency. A trip never writes Settings.

Optional `displayCurrency` on the request itself: one of `AUD`, `CNY`, `USD` or `JPY`, the Settings display
currency. The web app sends it with every chat request, like `interfaceLanguage`. The server uses it only as
the last step of the same `effectiveCurrency` rule (after `brief.displayCurrency` and
`brief.budgetSource.currency`) to spell amounts in text it writes: specialist summaries, conflict reasons
and constraints, progress lines, budget allocation bases and replies. Without the field the fallback is AUD,
so an older client gets the text it always got; an unsupported code is rejected with 400. The server never
writes Settings. Planning amounts, guardrails, conflict detection and the plan score stay AUD, and provider
fares stay in the provider's currency.

`brief.party` and `known.party` are optional too: `{ adults, children, infants, seniors, pets }`,
whole numbers from 0 to 99 (`TravellerParty` in `packages/shared/src/contracts.ts`), set by the Who
editor's steppers and by the coordinator when the traveller says who is travelling rather than only a
total ("1 adult and 1 child", "两位大人和一个小孩"). A later message that gives a new total drops the
breakdown, because it no longer describes the party. They break `groupSize` down and add pets, who are not counted in it; `groupSize`
stays authoritative for every cost, and specialists are told to ignore a party whose people do not
add up to it.

The mock browser check `party-breakdown-browser` submits the stated breakdown through chat and
checks all five Who counters at desktop and phone widths, including reopening the saved trip.

Optional `assistant`: `{ style, memory, names }` from Settings → Personalization (`AssistantSettings` in
`packages/shared/src/chat.ts`).

- `names` is an optional map from assistant id to a custom display name of at most 24 characters. It only changes what the interface shows and which `@name` resolves to a specialist; mentions are always sent as ids.
- `style` is one of `neutral`, `friendly`, `concise` or `detailed` and sets the coordinator's tone.
- With `memory: false`, the server drops `learnedPreferences` from `brief` and `known`, the account
  memory adapter skips reads and writes, and the coordinator records none. The Settings switch is
  available to signed-in accounts; signed-out users see a sign-in hint and cannot change it.

Without the field, the style is `neutral`. Account memory is enabled only when both the saved account setting and the request permit it; an explicit request opt-in cannot override a saved opt-out. If the account setting cannot be read, account memory stays disabled.

Optional `mentions`: up to five distinct specialist ids (`itinerary`, `transport`, `accommodation`,
`destination-guide`, `dining`) the traveller addressed. Without it the turn goes to the Coordinator as
before. With a `plan`, only these specialists run and revise their own sections, then the conflict
check and targeted revision run, and the response's `assistant` is the first mentioned id. Without a
`plan`, the mentioned specialist answers, nothing is created, and a `needs_info` frame (with the same
optional `assistant`) asks for the brief.

Optional `interfaceLanguage`: `en` or `zh` (`InterfaceLanguage` in `packages/shared/src/chat.ts`),
the language the traveller's interface is showing. The web app sends its current locale with every
chat request. The coordinator always replies in the language of the traveller's latest message; this
field only chooses the language when that message does not show one, such as a message that is only
a place name, dates or numbers. It never changes the interface language. Without the field the
coordinator has no fallback language and follows the latest message as before. Specialists do not
receive it.

Optional `attachments`: up to 4 files the traveller attached to this message.

```json
{
  "attachments": [
    { "name": "hotel.png", "mediaType": "image/png", "kind": "image", "data": "iVBORw0KGgo=" },
    {
      "name": "booking.txt",
      "mediaType": "text/plain",
      "kind": "text",
      "data": "Confirmation 12345"
    }
  ]
}
```

`data` is base64 of the file's bytes for `kind: "image"` (no `data:` prefix) and the decoded UTF-8
text itself for `kind: "text"`. Limits, as the named constants in `packages/shared/src/chat.ts`:

| Constant                      | Limit                                                         |
| ----------------------------- | ------------------------------------------------------------- |
| `MAX_ATTACHMENTS_PER_MESSAGE` | 4 attachments per message                                     |
| `MAX_IMAGE_BASE64_LENGTH`     | 1,500,000 base64 characters per image (~1.1 MB of file)       |
| `MAX_TEXT_ATTACHMENT_BYTES`   | 32,768 UTF-8 bytes per text file                              |
| `IMAGE_MEDIA_TYPES`           | `image/png`, `image/jpeg`, `image/webp`, `image/gif`          |
| `TEXT_MEDIA_TYPES`            | `text/plain`, `text/markdown`, `text/csv`, `application/json` |

A media type outside its kind's allow-list, an oversized file or an image that is not bare base64 is
rejected before any provider is called, as HTTP 400 with
`{ "error": "Attachment rejected: …", "notice": { "key": "Attachment rejected: {reason}", … } }`.
The whole request body is still bound by the platform: a Vercel serverless function rejects a body
over 4.5 MB with its own 413 before the handler runs, so three maximum-size images in one message is
the practical ceiling regardless of the per-file limits above.

Only the coordinator sees attachments: images travel to it as OpenAI-style `image_url` content
blocks, text files are inlined into its message under a delimiter naming the file, and the
specialists' inputs are unchanged. Without a provider key, images are ignored and the inlined text is
still read.

New planning requests whose start or end date precedes the current calendar date at the destination receive an explicit clarification instead of a plan. The web client includes coordinates from a selected destination suggestion; the server uses an offline coordinate-to-time-zone lookup. If no coordinates are available, the check falls back to UTC. The traveller can provide corrected dates or explicitly confirm the historical dates in response to the matching clarification. The confirmation is accepted on its own line in a multi-question card reply (for example, `Dates: Confirm historical trip`); a confirmation without the matching clarification is not accepted. Supplying an existing plan preserves historical editing. When an edit leaves the material itinerary, stays, transport and costs unchanged, the reply states that the plan was unchanged rather than claiming the requested edit completed.

Every reply that comes with a new plan ends with a cost sentence written by code from the plan, not by the model: the estimated total, the categories that carry an amount, what is not included (transport without a price, stops without a published price) and the exact headroom or overrun against the budget, with the minimum budget when the plan is infeasible. It uses the same figures as the Trip budget card and the reply language. The model receives the replanned facts without amounts and is told not to state totals, budget comparisons or what is included.

Optional `mode` values:

- `"chat"` (default): extract explicit updates from `message` and apply them to `brief`. Without a
  brief, the orchestrator's legacy `DEMO_BRIEF` is the baseline; the web workspace always sends a
  brief or uses `"start"`.
- `"plan"`: `brief` is required and is planned as submitted, without extraction.
- `"start"`: a blank conversation. `brief` is omitted and the destination, dates, traveller count and
  total budget must all be stated in `message`. Missing fields are reported in an `error` frame
  (for example “To start planning, include the start and end dates …”) and are never borrowed from a
  demo or a previous trip.

The response is `application/x-ndjson`, one JSON object per line:

- progress events with `type` `coordinator`, `agent_started`, `agent_completed`, `agent_failed` or `decision`. A `decision` event is `{ "type": "decision", "round": 2, "decision": { "type": "conflicts_detected" | "revision_started" | "revision_scored" | "loop_stopped" | "agent_output_rejected" | "mention_handoff" | "delegation_fallback", … } }`: the planning loop's own decisions, such as the specialist asked to save money, the revision score and why the loop stopped;
- a final `{ "type": "complete", "response": { "reply": "…", "plan": { … }, "assistant": "…" } }`.
  `assistant` is optional and names who answered (`coordinator` or a specialist id); a missing value
  means the Coordinator. `agent_completed` events carry an optional `source` (`live`, `estimated`,
  `mock`, `fallback` or `unavailable`) and `agent_reasoning` events an optional `assistant`;
- or `{ "type": "error", "error": "…", "notice": { … } }`, the failure in the
  [`{ error, notice }`](#failure-bodies) form.

An invalid request body, or `mode: "plan"` without a brief, returns HTTP 400 before streaming starts
with `{ "error": "The request was invalid. Please retry.", "notice": { … } }`.

An optional `x-trip-data-mode` header of `mock` or `live` chooses fixtures or live providers for this
request only; any other value, or no header, uses the deployment default. The header is a request,
not a decision: `requestDataMode` in `apps/web/lib/auth/live-data.ts` downgrades `live` to `mock`
for a caller who may not spend the allowance, so a signed-out visitor still gets a working plan from
fixtures.

## `GET /api/agent-lab/benchmark`

Returns the versioned Agent Lab benchmark registry: benchmark and artifact schema versions, fixture
scenarios and their expectations/checks, registered strategies and fault profiles, and the capped live
scenario/strategy/repeat subset. The response is read-only and uses `Cache-Control: no-store`.

## `POST /api/agent-lab/runs`

Contract: `AgentLabRunRequest`, `AgentLabRunEvent`, `AgentLabStreamFrame` and
`AgentLabRunArtifact` in `packages/shared/src/agent-lab.ts`.

```json
{
  "scenarioId": "tokyo-couple",
  "strategyId": "single-agent-baseline",
  "dataMode": "fixture"
}
```

`scenarioId` is `tokyo-couple`, `tokyo-couple-tight-budget` (the same trip and evidence with a
A$2,300 budget, so the first plan overruns), `paris-family-infeasible` (four travellers, A$3,000, against a
supported minimum of A$3,880, so no plan can fit) or `tokyo-kyoto-multi-city` (seven nights in two cities). `strategyId` is `single-agent-baseline`,
`multi-agent-no-revision` or `multi-agent-targeted-revision`. The second runs the five registered
specialists through the LangGraph workflow for one round, so its plan has `round: 1` and any conflicts
stay unresolved. The third runs the established loop with at most three rounds: it routes each conflict
to the specialist it names, keeps the best known proposals when a revision does not improve the plan, and
stops early when the budget is infeasible. `multi-agent-with-revision` is not registered and is rejected.

An optional `faultProfileId` asks for one registered fault: `provider-timeout`, `provider-empty-result`,
`invalid-agent-output`, `supervisor-failure` or `stalled-revision`. Each is bound to the one scenario and
strategy it was built for (see [architecture](architecture.md#agent-lab)); a request for any other
combination gets the same 400 as an unknown id, an object that defines a fault or an extra property. A
visitor chooses a profile and never defines a fault. The artifact records it in `faultProfileId` (`null`
for an ordinary run, and for any artifact recorded before faults existed), and the trace opens with
`lab_fault_injected`. A fault can add `lab_agent_output_rejected`, which lists only the rejected field
paths, and `lab_supervisor_fallback`.

The request is strict: an unknown value or extra property returns HTTP 400 with
`{ "error": "Invalid Agent Lab request" }`. A valid request streams NDJSON frames. Event frames have
`{ "type": "event", "event": { ... } }`; the last frame has
`{ "type": "complete", "artifact": { ... } }`. The artifact contains the validated plan, ordered
events, deterministic metrics and explicit fixture/evaluator versions. `metrics.checks` lists each
named check (`id`, `label`, `passed`) measured against the scenario's rules; `budgetHeadroom` is
negative when the plan is over budget. A scenario whose evidence shows no plan can fit replaces `budget` and
`no-conflicts` with `evidence-floor` (the estimate is not below the cheapest supported options) and
`infeasibility-reported` (the plan names the supported minimum); a multi-city scenario adds `hop-date`,
`itinerary-by-city`, `stay-transition`, `stay-nights`, `trip-dates` and `total-consistent`.
`trip-dates` requires the brief and first and last stay dates to match the trip dates.
`stay-date-range` remains for standalone accommodation date-boundary scenarios.
`versions.evaluator` is `scenario-rules-v8` and `versions.fixture` names the scenario's fixture. Competing meal preferences require separate meal records as evidence. Scenario-specific checks may also include
`meal-preference-tradeoff`, `actionable-brief`, `trip-days` and `stay-date-range`. The comparison figures `rounds`, `toolCalls`, `fallbacks`,
`failedAgents` and `unresolvedConflicts` are counted from the trace and the plan; `latencyMs` is the
run's wall time without display pacing (`durationMs` includes it) and, in fixture mode, measures
orchestration overhead only. The artifact also records `groundedSections`, `duplicateStops`,
`genericStops`, `multiCityConsistent` (`null` for a single-city trip), `stopReason` (`null` for a
strategy with no loop) and `usage`. Because fixture runs make no model calls, `usage` is `{ "status": "unavailable" }`:
missing usage is never reported as zero. Every metric except `durationMs` and `latencyMs`
is recomputed from the final plan and the trace alone, with no model judging it. Revision runs add trace
events `lab_conflict_detected`, `lab_revision_started`, `lab_revision_scored` and `lab_loop_stopped`. Cancelling the client request
aborts the run without emitting a completion frame. A run that fails, including one a fault stops, emits an `error` frame
with a non-sensitive message and a structured `failed` artifact containing the events recorded before
the failure. `failure.code` is `agent_failed`, with `failure.agent` naming the specialist, when a specialist
reported that it could not finish, and `run_failed` otherwise; neither message carries a stack, a validator
message or a provider payload.

`dataMode` is `fixture` (the default) or `live`. A fixture run executes with mock tools and no model for
that request, so it makes no external call and spends no quota whatever keys or data-mode default the
deployment holds. It needs no credential, and neither it nor a live run persists chats, trips or lab results.

A live run uses the deployment's own models and providers, and exists only where the deployment sets
`AGENT_LAB_LIVE_ENABLED=true` (see [development](development.md)). Only the two specialist strategies have a live
implementation; the single-agent baseline replays a recording, so asking for it live is refused. A request that
cannot start is answered with one typed `rejected` frame and no run, never an artifact: 503 `live_disabled`, 400
`live_unsupported`, or 429 `concurrency_limit` or `rate_limit` with a `Retry-After` header and
`retryAfterSeconds`. These are not failures of the experiment, and the messages name no setting or limit. A live
artifact's `dataMode`, and every event's, say `live`. Its `metrics.usage` is `{ "status": "measured", ... }` with
the input, output and total tokens only when the provider returned usage for every model call, and
`{ "status": "unavailable", "reason": ... }` otherwise, never a zero or a partial total. Model cost is never
reported, and the trace never carries a model's own reasoning.

## `GET /api/data-mode`

```json
{
  "configured": "mock",
  "liveAvailable": false,
  "providers": { "hotelsAndFlights": false, "maps": true }
}
```

`configured` is the deployment default (`live` only when `USE_MOCK_TOOLS=false`). `liveAvailable` is
whether this caller may spend the provider allowance: true for a signed-in traveller, and off a
deployment when Clerk is not configured. When it is false the workspace's data-mode chip stays on mock data with `aria-disabled="true"`, remains keyboard-focusable, and its hidden text says to sign in for live hotel and flight prices.
`providers` reports whether `SERPAPI_KEY` and `MAPS_API_KEY` are set, never their values. The
response is not cached.

## `POST /api/places/search`

Implementation: `MapProvider.searchPlaces` in `apps/web/lib/map-provider/` (Google first, free fallback by default).

```json
{ "text": "To-ji Temple", "destination": "Kyoto" }
```

`destination` is optional; omit it to look up a city itself. The response is
`{ "places": GooglePlace[], "source": "google" | "osm" }`. The workspace only sends saved place names, explicit activity locations
or titles that are themselves place names (`apps/web/lib/map/place-query.ts`), never descriptive activity
text. Errors: 400 invalid input, 429 Google rate limit, 502 other upstream failures, 503 when the selected provider is unavailable or Google-only mode has no key, each with a
[`{ error, notice }`](#failure-bodies) body. Error messages do not include the query or provider
details.

## `POST /api/places/details`

```json
{ "placeId": "ChIJ…", "language": "zh" }
```

Returns `{ "place": GooglePlace, "source": "google" | "osm" }`. Errors: 400 invalid input, 404 the place ID is no longer
available, 429 rate limit, 502 other upstream failures, 503 the selected provider is unavailable or Google-only mode has no key, each with a
[`{ error, notice }`](#failure-bodies) body.

`GooglePlace.photos` from either route carries Google's photo names and author attributions. They
stay in browser memory and are never written into a plan, because Google forbids caching them.

## `GET /api/places/photo`

Implementation: `placePhotoUri` in `apps/web/lib/integrations/google.ts`.

```text
/api/places/photo?name=places/ChIJ…/photos/Aa…&width=400
```

A Google `name` must be a `places/{id}/photos/{id}` name from a fresh lookup, and `width` is 160, 400 or 800.
The route asks Google for the image URL and answers `302` to a `googleusercontent.com` URL with
`Cache-Control: no-store`, so an `<img>` can point at it without the server key reaching the
browser. Each Google photo call is billed. OSM photos use `osm:commons/{encoded filename}` and redirect
to validated Wikimedia hosts; mock fixture names (`osm:fixture/Toji`) return a local SVG.
Commons photos require author and license attribution and are never billed to Google. Errors: 400 invalid input, 404 an expired or
unknown photo, 429 rate limit, 502 other upstream failures, 503 the selected provider is unavailable or Google-only mode has no key, each with
a [`{ error, notice }`](#failure-bodies) body.

## `POST /api/routes/from-location`

```json
{ "latitude": -33.86, "longitude": 151.21, "placeId": "ChIJ…", "mode": "WALK" }
```

Returns a `RouteResult` (`status` `ok` with `durationMin` and `distanceMeters`, or `unavailable` with
`error`). The coordinate is sent only after the user asks for their location; it is not stored or
written into the plan. Invalid input or a failed lookup returns 400 with
[`{ error, notice }`](#failure-bodies): invalid input reads "Route lookup failed.", and the app's
own refusals keep their key while any other error is passed on as `{ raw }`.

## `POST /api/trip/preview-edit`

Contract: `EditRequest` and `EditPreview` in `apps/web/lib/trip/trip-edit.ts`.

```json
{
  "plan": { "…": "current TripPlan" },
  "baseVersion": 3,
  "mode": "WALK",
  "operation": { "kind": "time", "id": "activity-id", "startTime": "10:00", "endTime": "12:00" }
}
```

`operation.kind` is `verify` (a day's routes), `move` (a drag: `day` and `index`), `time`, `place`, `leg`, `choose`,
`undo`, or one of the four item actions the timeline's menu sends: `remove` (`id`), `idea` (`id`, takes the stop off its
day), `schedule` (`id`, `day`: the end of that day) and `swap` (`id`, `direction` -1 or 1: an arrow move). The item
actions are applied by the same transform the browser's item actions use, then their days are routed. A `move` is
refused by any blocker it raises, and a `schedule` by any blocker but an unconfirmed place. A `swap` keeps the start
times it traded, is refused only for a stop running past midnight, and a leg that does not fit those times is a notice on
its stop.
Only activities with a day are routed and re-timed; ideas (activities without a day) pass through unchanged. The response is
`{ plan, baseVersion, routes, differences, blockers, blockerNotices }`. Each difference is a value
object `{ stop, days?: { from, to }, before, after, placeChanged }` that the interface words in the
chosen language. `blockerNotices` lists what stops the edit as Notices (`{ key, params }` for the
app's own wording, `{ raw }` for a route provider's text), which the interface shows in the chosen
language; `blockers` repeats them as English sentences for older clients. It is a preview only: the
client applies an accepted edit immediately, offers Undo and rejects stale results. `baseVersion`
checks the submitted plan, not an authoritative server revision. Same-browser tabs share a Web Lock
and a persisted plan fingerprint; stale tabs cannot edit or autosave over the newer plan. This does
not provide cross-device concurrency control. An
invalid edit returns 400 with `{ error, notice }`: `error` is the English sentence older clients
read and `notice` the same refusal as a Notice; an error that is not one of the app's own refusals,
such as a malformed body, comes back as `{ raw }`.

`choose` takes `{ section: "accommodation" | "transport", selectionId, candidateId }` and swaps a
stay or fare for another candidate the specialist already found. The item is found by its
`selectionId`, re-priced and re-described in the same words the specialist uses, and the costs,
conflicts and version are recomputed as for any other edit. The interface applies a `choose`
preview straight away rather than asking first, because only the price the traveller just read
changes. A plan saved before items carried `selectionId` is refused rather than guessed at.

The request may carry `displayCurrency` (`AUD`, `CNY`, `USD` or `JPY`), the Settings display currency; the
browser sends it with every edit. It is the last step of `effectiveCurrency`, after the brief's own
`displayCurrency` and `budgetSource` currency, and absent means AUD. It only chooses how the sentences an edit
rewrites spell amounts (a swapped stay's description, the recomputed conflicts, the before and after in
`differences`); the plan stays in AUD.

## Account routes

With Clerk configured, middleware returns uncached 401 JSON for anonymous protected API requests;
protected browser pages redirect to `/sign-in`.

Every account route needs a Clerk session and answers 401 without one, and 503 when Clerk or
`DATABASE_URL` is not configured. Except for the settings conflict described below, every failure body, including the 400s and the 502 below, is
[`{ error, notice }`](#failure-bodies). Queries use the session's user id, never an id from the body.
Contracts: `UserSettings` in `apps/web/lib/account/settings.ts`, `SyncedRecord` and `SyncPush` in
`apps/web/lib/account/sync.ts`.

### `GET` and `PUT /api/account/settings`

`GET` returns `{ settings, revision }`, with `settings: null` and revision `0` before the first save.
`PUT` takes `{ settings: UserSettings, revision }`. Revision `0` creates a row; subsequent writes must
match its current server revision. Accepted writes return `{ settings, revision }` with the revision
incremented by one. A stale write returns 409 `{ conflict: true }`; an invalid or legacy body returns 400.
`updatedAt` is display metadata and never decides which edit wins.
When a browser has no local checkpoint and no other account checkpoint, its existing settings migrate
to the first signed-in account with revision `0`. On an account switch, unsynced settings are kept under
the previous identity and restored if it returns. The new identity adopts its own saved settings or
defaults, and does not receive settings owned by the previous identity.

### `GET` and `POST /api/account/sync`

`GET` returns `{ trips, conversations }`: records as `{ id, updatedAt, revision, record }`, or
`{ id, updatedAt, revision, deleted: true }` for a tombstone. `POST` takes the same shape (at most
500 of each, each record at most 2,000,000 characters of JSON). A new record uses revision `0`;
an edit or deletion must carry the server revision on which it was based. Each accepted write
increments that revision. The response is `{ accepted: { trips, conversations }, conflicts: { trips,
conversations } }`, including partial success. Only `accepted` records acknowledge local changes.
Conflicts repeat the rejected submissions; their local contents stay pending through reload and retry.
Client timestamps do not authorize writes. The client validates pulled records with the catalog parsers
and preserves any local change that has not been acknowledged. Pushes from one client are serialized.

Apply the generated `0001` migration before deploying revision-aware routes. Existing SQL rows receive
revision `1`; old browser timestamp checkpoints are discarded, while their catalog is retained.
An identical local/server record can adopt the server revision. Differing records without a revision
baseline remain pending instead of silently selecting a winner. Legacy clients without revisions receive
400; reload the updated client. Conflicts require keeping/exporting the pending local data and explicitly
reconciling it with the server copy; automatic whole-record or field-level conflict resolution is absent.
The [revision decision](../.agents/notes/implemented/bug-fix/2026-10-14-revision-based-account-sync.md)
records the migration and recovery boundaries.

### `GET /api/account/export`

A JSON attachment with the signed-in account's settings, trips, conversations and long-term memory
entries. Memory entries are selected by the authenticated account id, just like the other exported
rows.

### `GET` and `DELETE /api/account/memory`

The chat route recognizes only explicit phrases for dietary needs, pace, interests, accessibility,
accommodation preferences and usual departure city. It does not infer or store trip-only facts such
as budget or area. Trip/profile preferences take precedence over matching account memories.
A recognized preference is saved only after planning succeeds, with its notice and undo token in the
completed response; incomplete, failed and cancelled turns do not save it.

`GET` returns `{ memories: [{ key, value, source }] }` for the signed-in account. `DELETE` takes
`{ key }` and removes only that category for the signed-in account, returning `{ deleted }`. The
server derives the account from Clerk for both requests; the client cannot choose an account.
Unknown categories return `{ deleted: false }`, and requests without a session receive 401.
The accommodation category stores a JSON string with optional `stayType`, `minRating` and
`freeCancellation` fields. Updating one field preserves the others; undo restores the prior whole value.

### `POST /api/account/memory/undo`

Takes `{ token }` from a `ChatResponse.memoryChange`. The server resolves the account from Clerk and
only applies the token to that account's current category row. A first write is deleted; a replacement
restores the previous value. Stale tokens return `{ undone: false }`. Successful responses are
`{ undone: true }`. Signed-out requests receive 401.

### `DELETE /api/account`

Deletes the account's trips, conversations, settings and long-term memory rows before deleting the
Clerk user. If Clerk fails after the rows are gone it answers 502 and says so.

## Related contracts

- Chat request/response and progress events: `packages/shared/src/chat.ts`
- Trip brief, proposals and ports: `packages/shared/src/contracts.ts`, `packages/shared/src/ports.ts`
- Trip plan and its unresolved conflicts: `packages/shared/src/plan.ts`
- Specialist contract: `packages/shared/src/agent.ts`

Place search accepts `autocomplete: true` for typing suggestions. The free provider uses Photon only; unsupported languages or a Photon failure return an empty list, never Nominatim. Explicit searches omit the flag.

Place search and details accept optional `language: "en" | "zh"`; OSM details default to English and cache separately by language. Leg edits accept `mode: "cycle"`, saved as `arriveBy.mode: "cycle"`, with route mode `BICYCLE`. OSM cards have no rating; optional
`source`, `osmUri`, `websiteUri`, `phone`, `openingHours` and photo license fields are web-only details.
Only `savedPlace` name/address/coordinates are persisted with an activity. OSM routes name OSRM or
Transitous in `source`; `no_route` and `unavailable` never supply an invented transit duration.
`providers.maps` in `/api/data-mode` includes the free fallback; `webMapsProvider` and
`mockGoogleUnavailable` let the browser follow the deployment selection without exposing keys.

`/api/routes/from-location` accepts optional `toLocation: { latitude, longitude }` for a saved destination. These coordinates let OSM route to a Google-saved stop without looking up its ID.
