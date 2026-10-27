# Agent Note: Empty phone screens say one sentence and offer one action

Status: implemented
Owner: spec #730, ticket #738

## Problem

After the [empty map note](2026-10-27-phone-map-empty-hint.md) fixed Map, the other empty phone screens
still broke its rule. Mine with no trips said "No trips yet. Start one with New trip, or describe where
you want to go in a chat." directly under a New trip button, above a Trips and Calendar switch, a search
field and a Chats section whose only row was a blank "New chat" beside a New chat button. An empty day on
the Trip tab gave two instructions that repeated the Ask AI about this day and Add place buttons beside it.
The empty Trajectory sheet used two sentences and said Chat above a Plan in Chat button. Empty Chat put an
estimates footer under the composer prompt before any estimate existed.

## Decision

- The rule for every empty phone screen is one sentence, one primary action, and no message said twice on
  the screen. The day's own controls (Ask AI about this day, Add place) are not empty-state actions.
- Empty Chat keeps the composer prompt and the two example chips. The estimates footer waits until the
  chat has a message; the footer is unchanged everywhere else.
- Mine with no trips and no saved chat shows the Trips heading, its New trip button and "No trips yet.".
  The search field, the Trips and Calendar switch and the Chats section appear once there is a trip, a
  saved chat or a search to act on. "Saved chat" means a chat other than the untitled blank one.
- An empty day says "Nothing planned for this day yet." on the Trip tab and the Map sheet alike, one
  string with one Chinese pair.
- The empty Trajectory says "Each step the assistant takes will be listed here after you send a message."
  with Plan in Chat. A phone Trip drawer without a plan offers Plan in Chat only.
- The desktop Trips page keeps its Trips and Calendar switch with no trips, because the sidebar's
  Calendar entry opens it there.

## Alternatives considered

- Keep the long sentences and shorten only the visuals: the sentences were the repeated message.
- Hide the estimates footer for good on the phone: it is a standing notice once a plan exists.
- Remove Ask AI about this day or Add place from an empty day: they are the day's controls in every state.

## Consequences

The old Chinese and English strings for the two long empty lines are removed. `phone-empty-chat-hint`
covers Chat, Mine, the empty day and the Trajectory at 390x844 and 360x800 in both languages and saves
screenshots and `result.json`; `trajectory-empty`, `progressive-empty-workspace` and
`short-phone-empty-chat` follow the new copy and sizes.

## Sources

- Spec #730, ticket #738 (TP-112); the [empty map note](2026-10-27-phone-map-empty-hint.md).
