# @trip/agents

The five specialist agents and the model routing they share. Each agent turns a `TripBrief` into an
`AgentProposal` through the `Specialist` contract. Owners: B (itinerary, transport), C
(accommodation), D (destination guide, dining).

## Exports

- `allSpecialists`: the registry the orchestrator dispatches to, in a stable order.
- Each agent and its factory: `itineraryAgent` / `createItineraryAgent`, and likewise for
  transport, accommodation, destination guide and dining, with their option and draft types.
- `models.ts`: `MODEL_ROUTING`, `createRoutedChatModel()`, plus the request-scoped
  `runWithModelsDisabled()` (no model is built inside it) and `createUsageCollector()` / `runWithUsageCollector()` (the
  token usage the provider returned for each call).

| Agent             | Folder               | Approach                                                    |
| ----------------- | -------------------- | ----------------------------------------------------------- |
| Itinerary         | `itinerary/`         | Model agent with evidence tools and route checks            |
| Destination guide | `destination-guide/` | Model agent with place and weather evidence                 |
| Dining            | `dining/`            | Model agent with grounded venue candidates                  |
| Transport         | `transport/`         | Deterministic calculators over journey legs; model narrates |
| Accommodation     | `accommodation/`     | Deterministic planning and costing; model narrates          |

## Configuration

`DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` and `DEEPSEEK_BASE_URL` configure every model call. MiniMax
(`MINIMAX_*`) is wired but not routed; see the [model routing note](../../.agents/notes/implemented/architecture/2026-10-10-active-specialist-model-path.md).

## Contracts

- `invoke({ brief, context, revision? })` is the only entry point, for first plans and revisions.
- Agents use `ctx.tools` and `ctx.mem` from `AgentContext`, never imported singletons.
  The orchestrator supplies memory; agents have no direct services dependency.
- Without a key, or when a model call fails or returns off-schema output, an agent falls back to
  validated deterministic output and sets `source.kind` to `fallback` in that branch.
- Dining and destination guide share internal name matching and first-entry deduplication;
  each keeps its own schema and rejects names outside provider candidates.
- Models never supply prices, routes or properties: transport and accommodation compute them.
- Every structured response is validated against its Zod schema, and prompts restate hard limits
  because providers treat schema limits as advisory.
- Adding or removing an agent changes `AGENT_NAMES` in `@trip/shared` and `allSpecialists` together.

## Tests

`pnpm --filter @trip/agents test`; tests live in `tests/<agent>/` and inject fake models and tools.
