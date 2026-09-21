# @trip/shared

The Zod contracts and TypeScript interfaces every other package depends on. It holds types, schemas
and the money helpers only; no I/O and no provider code. Owner: A (@Lilstanie).

## Contents

| Module         | Exports                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------- |
| `contracts.ts` | `TripBrief`, `AgentProposal` and its `source`, `ProposalItem`, `RevisionRequest`, stay types |
| `plan.ts`      | `TripPlan`, `TripSection`, `SectionStatus`                                                   |
| `chat.ts`      | `ChatRequest`, `ChatResponse`, `AgentProgressEvent` and the other `/api/chat` frames         |
| `agent.ts`     | `Specialist`, `SpecialistRequest`, `AgentContext`                                            |
| `ports.ts`     | `ToolGateway`, `MapsPort`, `BookingPort`, `WeatherPort`, `MemoryStore` and their DTOs        |
| `money.ts`     | `BASE_CURRENCY` (AUD), supported currencies, static conversion rates, formatting             |

## Contracts

- Every package imports these types from `@trip/shared`; nothing redefines them locally.
- A change here is a cross-package contract change. It needs an Agent Note in the same pull request
  (`pnpm verify:protected` enforces this), `contract-impact: packages/shared` in the session log,
  and a typecheck of every dependent package (`pnpm typecheck`).
- Prefer optional, additive fields. Object schemas drop unknown keys, so removing a field keeps older
  stored plans parseable; renaming or retyping a persisted field does not.
- All amounts are AUD with no currency field; see the [AUD note](../../.agents/notes/implemented/architecture/2026-09-20-aud-base-currency.md).
- `AgentProposal.source.kind` states where a proposal's data came from; see the
  [source kind note](../../.agents/notes/implemented/bug-fix/2026-09-21-proposal-source-kind.md).

## Tests

`pnpm --filter @trip/shared test` runs `tests/money.test.ts`. Schema behaviour is exercised by the
consuming packages' tests.
