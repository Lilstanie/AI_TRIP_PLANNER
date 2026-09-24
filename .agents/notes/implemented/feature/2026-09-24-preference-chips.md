# Agent Note: Trip preferences edited from top-bar fact chips

Status: implemented
Owner: repository owner (@HeadmasterEggy)

## Problem

The repository owner asked for the Preferences interaction to work like Mindtrip's. Before this
change the top bar showed the planned trip's facts as one line of text ("4 days · 2 travellers ·
AUD 2,000.00 budget") and a Preferences button that opened a left drawer holding the whole brief
form: destination, origin, dates, travellers, budget, nationality and accommodation, with one
Update trip button. To change one fact the traveller opened a drawer over the chat, found the field
among nine others and resubmitted everything. A blank trip showed "Not planned yet" instead of what
was still missing.

Mindtrip's trip bar (observed on 2026-09-24) shows each fact as its own chip: place, "3 days",
"2 travelers", "$$" and Preferences. Each chip opens a small dialog for that fact alone (Where,
When, Who, Budget, Trip preferences) with a close button and one primary action; Escape discards
the edit and returns focus to the chip. The same chips repeat in the trip panel's header.

## Decision

The top bar holds a chip per fact: destination, dates, travellers, budget and Preferences
(`components/preferences/TripFactChips.tsx`). Each opens its own editor, `FactPopover`: When, Who
and Budget anchored under the chip on wider screens, Where and Trip preferences centred over a scrim
since they hold lists, and every editor a bottom sheet at ≤520 px. Preferences holds the traveller's
own preference list; the [trip preference list Agent Note](2026-09-24-trip-preference-list.md)
records why it replaced nationality and accommodation, and why those two editors open centred. Every
draft field belongs to exactly one fact or is listed as retired (`FACT_FIELDS` and `RETIRED_FIELDS`
in `lib/workspace/trip-facts.ts`, checked by a unit test), and the Preferences drawer and
`FiltersPanel` are removed.

- The chips read the preferences draft, not only the plan, so what the traveller stated in a blank
  chat, or what the assistant understood from it, is visible. Missing facts read "Add dates" and so
  on; nothing is inferred.
- An editor keeps its edit locally until the traveller keeps it, so Escape and a press outside
  discard it, as on Mindtrip. Each editor validates its own fields with the `TripBrief` schema,
  through `parseDraft`, before keeping anything.
- Before a plan exists, Save keeps the edit in the draft and sends nothing. The facts travel with
  the next chat message as `known`, exactly as the drawer's fields did. Trip preferences also offers
  Plan trip, the drawer's structured submission (`mode: "plan"`).
- Once a plan exists, the primary action is Update trip, which keeps the edit and replans with the
  whole brief. A chat message carries `plan.brief`, not the draft, so an edit that was only kept
  would never reach the planner.
- A rejected brief opens the editor of the first fact at fault, with a message that says how to fix
  it, replacing the drawer's generic highlight.

No contract in `packages/shared` changed with the chips themselves; the preference list later added
the optional `TripBrief.preferences`.

## Alternatives considered

- **Keep the drawer and restyle its trigger as chips.** Rejected: every chip would open the same
  ten-field form, which is the problem the owner wants gone.
- **Centred modal dialogs, as Mindtrip uses.** Rejected for wider screens: a centred modal covers
  the chat and map that the traveller is editing the trip against, and an editor anchored to its
  chip keeps the edit next to what it changes. Phones get a bottom sheet, which is the closest
  equivalent there. The owner later asked for Where and Trip preferences to match Mindtrip's
  dialogs, and those two now open centred; see the trip preference list note.
- **Apply each edit immediately, without a Save or Update trip button.** Rejected: once a plan
  exists every applied edit is a paid planning request, so replanning has to be an explicit choice,
  and a half-typed value would otherwise reach the draft.
- **Save without replanning when a plan exists.** Rejected: the chips would then show values the
  plan was not built from, and the next chat message would still send the old brief.
- **Build the editor on `Dialog` or `Drawer`.** `Dialog` is a centred native modal and `Drawer` a
  full-height side panel; neither anchors to a control. `FactPopover` follows `Drawer`'s Tab loop
  and focus return and yields Escape to an open native dialog (the calendar).

## Consequences

- The design contract's rule that drawer behaviour does not change for visual work still stands;
  this was an interaction change the owner asked for, and
  [workspace-ui.md](../../../../docs/workspace-ui.md) now describes the chips instead of the
  Preferences drawer.
- Once a plan exists, editing any fact costs a planning request, as submitting the drawer did.
- Below 1250 px the trip title is visually hidden, because the destination chip already names the
  trip. On narrow screens the chips scroll sideways inside their row, with a faded edge as the cue.
- Unlike Mindtrip, the Trip drawer's header does not repeat the chips; they stay visible above it.
- The class diagrams and the combined architecture map name `TripFactChips` in both the Markdown
  source and the rendered SVGs under `docs/design/diagrams/`.

## Sources

Mindtrip's chat trip bar, observed read-only in the owner's browser on 2026-09-24; no Mindtrip copy,
assets or styling were reused.
