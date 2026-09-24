# API entry points

The Next.js route handlers live under `apps/web/app/api/`. `/api/data-mode` and `/api/places/photo` are
`GET` handlers; the other five are `POST` handlers. Request bodies are validated with Zod, and planning outputs are
validated against the shared contracts in `packages/shared/src/`.

| Path                                                        | Purpose                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------- |
| [`/api/chat`](#post-apichat)                                | Extract brief updates or plan a submitted brief, streaming progress |
| [`/api/data-mode`](#get-apidata-mode)                       | Default data mode and whether live provider keys are configured     |
| [`/api/places/search`](#post-apiplacessearch)               | Google Places text search                                           |
| [`/api/places/details`](#post-apiplacesdetails)             | Google place details for a place ID                                 |
| [`/api/places/photo`](#get-apiplacesphoto)                  | Redirect to one Google place photo                                  |
| [`/api/routes/from-location`](#post-apiroutesfrom-location) | Route from a user-approved location to a place                      |
| [`/api/trip/preview-edit`](#post-apitrippreview-edit)       | Preview an itinerary edit with route and budget checks              |

The browser sends the current plan or brief with each request and keeps its workspace in local
storage. On the server, `packages/services` records chat turns, preferences and generated plans in
the Redis REST store when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set, and in process memory
otherwise.

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

`brief.preferences` and `known.preferences` are optional: the traveller's own trip preferences
("Vegetarian food", "No early starts"), at most `MAX_TRIP_PREFERENCES` (12) entries of 1 to
`MAX_TRIP_PREFERENCE_LENGTH` (200) characters after trimming, both in
`packages/shared/src/contracts.ts`. They come only from the trip preferences editor; the coordinator
never writes them, and every specialist and the supervisor receive them with the brief. `nationality`
and `accommodation` are still accepted and passed through, but no current screen sets them.

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
rejected before any provider is called, as HTTP 400 with `{ "error": "Attachment rejected: …" }`.
The whole request body is still bound by the platform: a Vercel serverless function rejects a body
over 4.5 MB with its own 413 before the handler runs, so three maximum-size images in one message is
the practical ceiling regardless of the per-file limits above.

Only the coordinator sees attachments: images travel to it as OpenAI-style `image_url` content
blocks, text files are inlined into its message under a delimiter naming the file, and the
specialists' inputs are unchanged. Without a provider key, images are ignored and the inlined text is
still read.

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

- progress events with `type` `coordinator`, `agent_started`, `agent_completed` or `agent_failed`;
- a final `{ "type": "complete", "response": { "reply": "…", "plan": { … } } }`;
- or `{ "type": "error", "error": "…" }` with a user-facing message.

An invalid request body returns HTTP 400 JSON before streaming starts.

An optional `x-trip-data-mode` header of `mock` or `live` chooses fixtures or live providers for this
request only; any other value, or no header, uses the deployment default.

## `GET /api/data-mode`

```json
{ "configured": "mock", "providers": { "hotelsAndFlights": false, "maps": true } }
```

`configured` is the deployment default (`live` only when `USE_MOCK_TOOLS=false`). `providers` reports
whether `SERPAPI_KEY` and `MAPS_API_KEY` are set, never their values. The response is not cached.

## `POST /api/places/search`

Implementation: `searchPlaces` in `apps/web/lib/integrations/google.ts` (requires the server `MAPS_API_KEY`).

```json
{ "text": "To-ji Temple", "destination": "Kyoto" }
```

`destination` is optional; omit it to look up a city itself. The response is
`{ "places": GooglePlace[] }`. The workspace only sends saved place names, explicit activity locations
or titles that are themselves place names (`apps/web/lib/map/place-query.ts`), never descriptive activity
text. Errors: 400 invalid input, 429 Google rate limit, 502 other upstream failures. Error messages do
not include the query or provider details.

## `POST /api/places/details`

```json
{ "placeId": "ChIJ…" }
```

Returns `{ "place": GooglePlace }`. Errors: 400 invalid input, 404 the place ID is no longer
available, 429 rate limit, 502 other upstream failures.

`GooglePlace.photos` from either route carries Google's photo names and author attributions. They
stay in browser memory and are never written into a plan, because Google forbids caching them.

## `GET /api/places/photo`

Implementation: `placePhotoUri` in `apps/web/lib/integrations/google.ts`.

```text
/api/places/photo?name=places/ChIJ…/photos/Aa…&width=400
```

`name` must be a `places/{id}/photos/{id}` name from a fresh lookup, and `width` is 160, 400 or 800.
The route asks Google for the image URL and answers `302` to a `googleusercontent.com` URL with
`Cache-Control: no-store`, so an `<img>` can point at it without the server key reaching the
browser. Each call is a billed Google photo request. Errors: 400 invalid input, 404 an expired or
unknown photo, 429 rate limit, 502 other upstream failures or a missing key.

## `POST /api/routes/from-location`

```json
{ "latitude": -33.86, "longitude": 151.21, "placeId": "ChIJ…", "mode": "WALK" }
```

Returns a `RouteResult` (`status` `ok` with `durationMin` and `distanceMeters`, or `unavailable` with
`error`). The coordinate is sent only after the user asks for their location; it is not stored or
written into the plan. Invalid input returns 400.

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

`operation.kind` is `verify` (a day's routes), `move`, `time`, `place` or `undo`. The response is
`{ plan, baseVersion, routes, differences, blockers }`. It is a preview only: the client applies it
when the user confirms and rejects it if `baseVersion` no longer matches. Invalid edits return 400.

## Related contracts

- Chat request/response and progress events: `packages/shared/src/chat.ts`
- Trip brief, proposals and ports: `packages/shared/src/contracts.ts`, `packages/shared/src/ports.ts`
- Trip plan and its unresolved conflicts: `packages/shared/src/plan.ts`
- Specialist contract: `packages/shared/src/agent.ts`
