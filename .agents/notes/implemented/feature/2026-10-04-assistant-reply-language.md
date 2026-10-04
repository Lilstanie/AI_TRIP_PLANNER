# Agent Note: Assistant replies in the traveller's language, with the interface language as fallback

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

The coordinator prompt already tells the model to reply in the language of the traveller's latest
message. A message that shows no language, such as "Tokyo", "3" or "2026-12-20", leaves the model to
guess, and it usually guesses English even when the traveller is using the Chinese interface.

## Decision

`ChatRequest` gains an optional `interfaceLanguage` (`en` | `zh`, `InterfaceLanguage` in
`packages/shared/src/chat.ts`). The web app sends its current interface locale with every chat request
(`useWorkspaceTransport`, from `useInterfaceLocale` in the workspace controller). When the field is
present, `runTripChat` appends one `Reply language:` rule after the communication-style text in the
coordinator's system prompt: the latest message's language, else the interface language. Without the
field the prompt is byte-for-byte what it was, so older clients behave as before. The interface
language never changes because of what the traveller writes, and specialists receive nothing new.

This builds on [the interface language note](2026-10-04-interface-language-only.md), which keeps
generated replies untranslated; that still holds, since replies are written in the right language
rather than translated afterwards.

## Alternatives considered

- Reply in the interface language always: rejected by spec #145, because a traveller who types
  English in the Chinese interface expects an English answer.
- Put the language inside `assistant` (`AssistantSettings`): it is not a Personalization setting and
  would make `assistant` always sent, changing requests that today omit it.
- Detect the message language on the server: needs a detector library or heuristics, and the model
  already detects language well when the message has words in it.

## Consequences

The fallback only matters for messages without words; ordinary messages still follow their own
language. Adding a third interface language means adding it to `INTERFACE_LANGUAGES` and to the
language names in `packages/orchestrator/src/chat.ts`. Without a provider key the turn runs
`runOffline`, which does not use the coordinator prompt, so it ignores the field.

## Sources

- [Spec #145](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/145) and
  [ticket #149](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/149).
