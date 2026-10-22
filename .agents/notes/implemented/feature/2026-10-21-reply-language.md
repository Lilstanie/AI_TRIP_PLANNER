# Agent Note: one reply language per turn

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

A Chinese traveller saw English progress lines and English specialist summaries in the Think
panel, while the model reply guessed its own language from a free-form prompt rule (#492).

## Decision

- Progress lines are [notices](../../../../GLOSSARY.md): the orchestrator writes them in the
  interface language through `packages/orchestrator/src/progress-copy.ts`.
- Each chat turn has one **reply language**, resolved in code by
  `packages/orchestrator/src/reply-language.ts`: Han text is Chinese, Latin text is English, and a
  message with neither (numbers, dates, empty) uses the interface language, then English.
- `AgentContext.replyLanguage` in `packages/shared/src/agent.ts` carries it to the five
  specialists. It is optional; a missing value means English, so the Agent Lab and older callers
  keep their exact English summaries.
- Specialist summary templates live in `packages/agents/src/summary-copy.ts`, with English text
  byte-for-byte as before.

## Alternatives considered

**Let the model translate summaries.** Rejected: fallback summaries are written when no model is
available, and a model call per summary would cost tokens for fixed text.

**Use the interface language for summaries too.** Rejected: summaries sit beside the model reply,
and a traveller who writes English in the Chinese interface should read one language.

## Consequences

- The reply model and specialist prompts still pick their language from the free-form rule; a
  follow-up passes them the resolved reply language (#492).
- Text a model wrote, such as a dining draft summary, is shown as received.

## Sources

[2026-10-21 reply language log](../../../session-logs/2026-10-21-reply-language.md)
