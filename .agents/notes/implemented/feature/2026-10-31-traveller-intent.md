# Agent Note: the brief model records the traveller's intent, and the planners follow it

Status: implemented
Owner: TP-202

## Problem

On a real six-day Tokyo trip the traveller asked for packed days ("特种兵") and got 14 stops. The
brief model understood the request but could keep it only as free text in `learnedPreferences`.
The code after it then applied its own rules: the itinerary prompt asked for 1-3 activities a day,
the fallback had two slots, dining and the intake matched dietary keywords, stays read hard
requirements only from the account memory, the account memory matched English sentences, and a
regex count of people and days replaced the model's. Wording outside those lists was lost.

## Decision

- `TripBrief.intent` (`TripIntent` in `packages/shared/src/contracts.ts`, also on
  `PartialTripBrief`) holds `pace` (relaxed, balanced, packed), `dietary`, `interests` (a fixed list
  of names) and `stay` (`minRating`, `freeCancellation`, `stayType`). The coordinator fills it from
  the traveller's words in any language and from `preferences`; invalid values are dropped, and
  `mergeBriefPatch` merges it field by field.
- The itinerary reads pace from the intent, then the remembered pace, else balanced: the prompt
  asks for 1-2, 2-3 or 4-6 sights a day, and a packed fallback day has four sights and lunch and
  dinner with 45 minutes between stops. Dining searches for `intent.dietary` before any keyword
  match, stays apply `intent.stay` over saved preferences, and interests rank places.
- With a model, group size, party and dates come only from the model, and the end date is counted
  from its `tripDays`. The regexes run only when no model produced the update.
- `ChatResponse.lastingPreferences` (`LastingPreference`) carries what the traveller says holds for
  every trip; the chat route saves it to the account memory and falls back to
  `recognize-memory.mjs` when the model returned none.

## Alternatives considered

**Add "特种兵" and similar words to a keyword list.** Rejected: every language and wording needs its
own entry, and the model already understands them.

**Keep pace in free text and only raise the prompt's activity count.** Rejected: the fallback,
dining and stays could not read it, and nothing could be checked.

## Consequences

- A model that misses a pace leaves the trip balanced, as before.
- The flight-query intercept, the revision-intent regex and the chat-grounding regexes still read
  English words; they are left for a later change.
- The offline path behaves as before.

## Sources

[2026-10-31 traveller intent log](../../../session-logs/2026-10-31-traveller-intent.md)
