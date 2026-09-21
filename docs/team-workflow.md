# Team and Git workflow

This is a single deployable, so ownership is by module rather than by frontend/backend layers.

| Area                         | Owner | GitHub            | Ownership                                                        |
| ---------------------------- | ----- | ----------------- | ---------------------------------------------------------------- |
| Orchestrator and integration | A     | `@Lilstanie`      | Graph state, supervisor, contracts, conflict policy, HITL and CI |
| Itinerary and transport      | B     | `@fonever2`       | Schedule, route feasibility and maps adapter                     |
| Accommodation and budget     | C     | `@HeadmasterEggy` | Lodging adapter, cost aggregation and budget policy              |
| Destination and dining       | D     | `@jbia0391`       | Grounded guide, customs, dining and dietary constraints          |
| Web and memory               | E     | `@WhW0591`        | Chat, filters, plan UI, preference memory and persistence        |

[`.github/CODEOWNERS`](../.github/CODEOWNERS) mirrors this table and requests the owner's review
automatically.

## Who owns which paths

| Path                                                                                   | Owner | Fill in                                                                                                                                  |
| -------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/**`                                                               | A     | contracts — freeze early, announce changes                                                                                               |
| `packages/orchestrator/src/workflow.ts`                                                | A     | LangGraph workflow; add richer conflict policies, status promotion and HITL                                                              |
| `apps/web/app/api/chat/route.ts`, `packages/orchestrator/src/chat.ts`                  | A     | enrich chat clarification/extraction and move from process-local to durable memory (structured extraction + fallback + loop wiring done) |
| `packages/tools/src/gateway.ts` + `mock-server.mjs`                                    | A     | real-vs-mock routing                                                                                                                     |
| `packages/agents/src/itinerary/**`                                                     | B     | enrich the implemented model/fallback daily plan with live opening-hour data                                                             |
| `packages/agents/src/transport/**`                                                     | B     | replace injected mock fares/routes with live adapter data                                                                                |
| `packages/tools/src/maps.ts`                                                           | B     | real Maps / Places adapter                                                                                                               |
| `packages/agents/src/accommodation/**`                                                 | C     | lodging search + room allocation                                                                                                         |
| `packages/tools/src/booking.ts`                                                        | C     | real Booking / Price adapter (mock only for payment)                                                                                     |
| cost roll-up and conflict threshold in `orchestrator` `rollUpCost` / `detectConflicts` | C     | budget overrun % + escalation cutoff                                                                                                     |
| `packages/agents/src/destination-guide/**`                                             | D     | maintain grounded attractions, customs/safety and verification-first entry/weather guidance                                              |
| `packages/agents/src/dining/**`                                                        | D     | maintain grounded venue picks, dietary preferences and meal budgeting                                                                    |
| `apps/web/components/**`, `apps/web/app/globals.css`                                   | E     | UI: chat, filters, "Your trip" panel                                                                                                     |
| `packages/services/src/memory/**`                                                      | E     | real short/long-term memory store                                                                                                        |
| `packages/services/src/{notification,auth}/**`                                         | E     | real notifications + auth                                                                                                                |

Search the codebase for `TODO(` to see open slots. Historical module handoff notes are preserved in
[`.agents/archive/`](../.agents/archive/): [itinerary and transport reliability](../.agents/archive/module-b-reliability-2026-09.md)
(B) and [accommodation and budget](../.agents/archive/module-accommodation-2026-09.md) (C). Current provider,
weather and UI work is tracked in [the product closure TODO](todo-product-closure.md). How the pieces
fit together is described in [architecture](architecture.md).

## Branches and commits

Use a standard branch type prefix such as `feature/<module>-<short-desc>`, `fix/<short-desc>`,
`refactor/<short-desc>`, or `docs/<short-desc>`. Branch names are independent of the tool or
assistant that created them. Use conventional commit prefixes: `feat:`, `fix:`, `docs:`,
`refactor:`, `test:` and `chore:`.

Open a pull request for `main` and merge it yourself once CI passes. Reviews are requested
automatically from the module owner but are not required; ask for one when a change crosses
modules. Do not force-push or delete `main`.

Don't edit `packages/shared` without telling the team; every package depends on it.

## Protected files and decisions

The [Protected files](../AGENTS.md#protected-files) section of `AGENTS.md` lists what nobody, human or
AI, may change casually. The `protected-files` CI job fails a pull request that modifies, renames or
deletes frozen history (`.agents/archive/`, dated session logs, rejected and archived Agent Notes), or that changes
`packages/shared/src` without adding or updating an [Agent Note](../.agents/notes/README.md) in the
same pull request. Session logs describe one session; they do not decide anything.

## Session logs

Every AI-assisted coding session adds a concise note in `.agents/session-logs/`, named
`YYYY-MM-DD-<topic>.md` and based on [`TEMPLATE.md`](../.agents/session-logs/TEMPLATE.md). One session is one
new file, so two people writing at once never conflict. The
[session-log README](../.agents/session-logs/README.md) has the writing rules.
