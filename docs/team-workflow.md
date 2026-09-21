# Team and Git workflow

This is a single deployable, so ownership is by module rather than by frontend/backend layers.

| Area                         | Owner | GitHub            | Ownership                                                  |
| ---------------------------- | ----- | ----------------- | ---------------------------------------------------------- |
| Orchestrator and integration | A     | `@Lilstanie`      | Graph state, supervisor, contracts, conflict policy and CI |
| Itinerary and transport      | B     | `@fonever2`       | Schedule, route feasibility and maps adapter               |
| Accommodation and budget     | C     | `@HeadmasterEggy` | Lodging adapter, cost aggregation and budget policy        |
| Destination and dining       | D     | `@jbia0391`       | Grounded guide, customs, dining and dietary constraints    |
| Web and memory               | E     | `@WhW0591`        | Chat, filters, plan UI, preference memory and persistence  |

[`.github/CODEOWNERS`](../.github/CODEOWNERS) mirrors this table and requests the owner's review
automatically.

## Who owns which paths

| Path                                                                                     | Owner | Responsibility                                               |
| ---------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------ |
| `packages/shared/src/**`                                                                 | A     | Shared contracts; changes need an Agent Note and team notice |
| `packages/orchestrator/**`                                                               | A     | LangGraph workflow, supervisor, chat intake, conflict policy |
| `apps/web/app/api/**`                                                                    | A     | Route handlers                                               |
| `packages/tools/src/gateway.ts`, `data-mode.ts`, `mock-server.mjs`                       | A     | Mock versus live routing                                     |
| `packages/agents/src/itinerary/**`, `packages/agents/src/transport/**`                   | B     | Daily plan, journey legs, routes and fares                   |
| `packages/tools/src/maps.ts`, `route-options.ts`, `airports.ts`                          | B     | Maps, Places and routing adapters                            |
| `packages/agents/src/accommodation/**`                                                   | C     | Lodging search and room allocation                           |
| `packages/tools/src/booking.ts`, `serpapi.ts`, `google-places.ts`                        | C     | Hotel and flight price adapters                              |
| `rollUpCost` and `detectConflicts` in `packages/orchestrator`                            | C     | Budget roll-up and overrun thresholds                        |
| `packages/agents/src/destination-guide/**`, `packages/agents/src/dining/**`              | D     | Grounded attractions, customs, weather guidance, dining      |
| `packages/tools/src/weather.ts`                                                          | D     | Weather forecast and climate adapter                         |
| `apps/web/components/**`, `apps/web/lib/**`, `apps/web/app/styles/**`, `app/globals.css` | E     | Workspace UI                                                 |
| `packages/services/**`                                                                   | E     | Memory, trip storage, notification and auth                  |

Open work is on the [roadmap](roadmap.md) and in `TODO(<owner>)` comments in the code. How the pieces
fit together is described in [architecture](architecture.md); retired module handoffs are in
[`.agents/archive/`](../.agents/archive/).

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
