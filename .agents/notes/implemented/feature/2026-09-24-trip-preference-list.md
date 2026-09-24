# Agent Note: Trip preferences are the traveller's own list, carried on the brief

Status: implemented
Owner: repository owner (@HeadmasterEggy)

## Problem

The owner asked for the top bar's Where and Trip preferences editors to look and behave like
Mindtrip's, and for the Preferences editor's passport and accommodation fields to go: the traveller
should add their own preferences instead. Trip preferences held four fixed fields (nationality, room
allocation, minimum guest rating, free cancellation) that covered one narrow slice of what a
traveller cares about, and anything else ("vegetarian food", "no early starts") could only be typed
into the chat, where it was forgotten by the next turn. `TripBrief` had nowhere to keep it, so no
specialist ever saw it.

## Decision

- `TripBrief.preferences` and `PartialTripBrief.preferences` are an optional `TripPreferences` list
  in `packages/shared/src/contracts.ts`: at most `MAX_TRIP_PREFERENCES` (12) entries of 1 to
  `MAX_TRIP_PREFERENCE_LENGTH` (200) characters after trimming. The change is additive; every stored
  brief and plan still parses.
- The web draft keeps the list in `Draft.preferences` (optional, so drafts stored before it load).
  `parseDraft` sends it on the brief and clears the brief's list when it is emptied; `knownFromDraft`
  sends it as `known` before a plan exists. The catalog version is unchanged.
- `BriefPatchSchema` in `packages/orchestrator/src/brief.ts` carries the list from `known` into the
  planned brief. The coordinator's `update_trip_brief` tool has no field for it, so a model cannot
  rewrite what the traveller wrote.
- The supervisor sees the whole brief and is told to carry each preference into the objectives it
  bears on. Itinerary, dining and destination guide already read the whole brief from their evidence
  tools; transport and accommodation now include `preferences` in their payload. All five system
  prompts end with `TRAVELLER_PREFERENCES_RULE` (`packages/agents/src/prompts/traveller-preferences.ts`):
  honour a preference where the evidence allows, say when one could not be met, never treat one as a
  verified fact.
- Nationality, room allocation, minimum guest rating and free cancellation stay in the schema and
  the draft (`RETIRED_FIELDS`) and pass through unchanged, so replanning an older trip keeps them. A
  stored rating the schema would reject now falls back to 0 ("no minimum"), because the traveller can
  no longer see or fix it.
- Where and Trip preferences open as centred modal dialogs built to Mindtrip's measured frame
  (512 px, no panel padding, leading close, centred title, one ink pill action), because they hold
  lists that grow; the single-value editors stay anchored under their chip. Where lists destinations
  as cards with an icon where Mindtrip shows a photo (still stored as one " & "-joined string) and,
  in live data mode with Maps configured only, suggests places from `/api/places/search` after 3
  characters and a 350 ms pause. Departing from, which Mindtrip's dialog lacks, stays as a quieter
  section below. [workspace-ui.md](../../../../docs/workspace-ui.md) describes both editors.

## Alternatives considered

- **Keep nationality and accommodation next to the list.** Rejected: the owner asked for them to be
  removable and replaced by the traveller's own entries.
- **Drop the retired fields from the schema.** Rejected: stored briefs and plans carry them, and the
  accommodation agent still filters on them; removing them would break old trips for no gain.
- **Keep preferences only in the web draft and prepend them to the chat message.** Rejected: a
  message is extraction input for the coordinator, not something the specialists see, and the plan's
  brief would not record what the trip was planned against.
- **Let the coordinator record preferences it hears in chat.** Not done: the list is the traveller's
  own words, and a model paraphrasing it into the brief could not be told apart from what they wrote.
- **Suggest places in mock mode too.** Rejected: every lookup is a billed Places request.

## Consequences

- Preferences are free text weighed by models, not enforced filters; a deterministic fallback plan
  ignores them. The list is bounded so it stays small in every specialist prompt.
- Nationality can no longer be set in an editor, only stated in the chat, so the destination
  guide's entry advice stays generic unless the traveller says it or an older brief carries one.
- Where and Trip preferences now cover the chat while open, which the anchored editors avoided.
- Sizes follow measurements of Mindtrip's two dialogs taken read-only by the parent session (this
  agent's own attempt hit a Cloudflare human check, which an agent may not complete). Radii stay on
  `--radius-lg` and `--radius` (14 and 10 px against Mindtrip's 16 and 12), no place photos are
  fetched, and Mindtrip's road-trip switch has no equivalent because the planner has no road-trip
  mode. See also the [preference chips Agent Note](2026-09-24-preference-chips.md).

## Sources

The [session log](../../../session-logs/2026-09-24-mindtrip-trip-editors.md); no Mindtrip copy,
assets or styling were reused.
