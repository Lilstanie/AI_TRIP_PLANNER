# Agent Note: Agent Lab live gate and fixture isolation

Status: implemented
Owner: A (@Lilstanie)

## Problem

Agent Lab is public and needs no sign-in. Two things made that unsafe once live data was in view. A fixture run
only avoided the network by happening to run in an environment with no keys: with live data as the default or a
model key set, a visitor could spend the deployment's quota without live ever being enabled. And nothing stood
between a public request and the deployment's models and providers if live were offered. The page also could not
say whether a result was fixture or live, or report real usage honestly.

## Decision

Fixture is isolated by construction. A fixture run executes under `runWithDataMode("mock")` and
`runWithModelsDisabled` (`packages/agents/src/models.ts`), both held in AsyncLocalStorage for that request and never
written to `process.env`, so no key and no data-mode default can reach a provider or a model, and one visitor's mode
cannot leak to another's run in flight.

Live exists only where the deployment sets `AGENT_LAB_LIVE_ENABLED=true`, read per request on the server. The route
refuses, with one typed `rejected` frame before any run starts, a live request when it is not enabled (503
`live_disabled`), for a strategy with no live implementation (400 `live_unsupported`) and past the limits (429
`concurrency_limit` or `rate_limit`, with `Retry-After`). `apps/web/lib/agent-lab/live-gate.ts` keeps the concurrency
and rolling-hour counts in memory; a rejected attempt costs nothing, and a slot is freed exactly once however a run
ends, including by cancellation. Limits are whole numbers, zero allows nothing, an unusable value falls back to a
default and never to no limit, and values are capped. The request schema stays strict, so a prompt, brief, tool,
provider setting, credential, model or fault definition is a 400 whatever the mode.

Only the two specialist strategies have a live implementation. The scripted baseline replays a recording, so a live
request for it is refused instead of labelling a recording as live. A live run uses the real adapters and models, and
the multi-agent trace never publishes a model's `agent_reasoning`.

Usage is reported only when measured. A collector is captured when each routed model is built, inside the run, and
records every finished or failed call. The artifact's `metrics.usage` is `measured` (calls and input, output and total
tokens) only when the provider returned usage for every call, and `unavailable` with a reason otherwise: no call,
or some call reported nothing. Cost is never computed. The page labels every trace, metrics panel, comparison and
artifact Fixture data or Live data, and shows a rejection as a notice, never as a failed run.

The shared contract changes by additive values: `AgentLabDataMode` gains `live`, `metrics.usage` gains a `measured`
variant and the stream gains a `rejected` frame. Earlier artifacts still parse and `schemaVersion` stays 1.

## Alternatives considered

- **Look up the usage collector when a callback fires.** Rejected: LangChain can run callbacks in the background,
  outside the run's async context, and a lookup there would lose the usage and report a run that called a model as
  one that did not.
- **Build a live single-agent baseline.** Not built: it would be a new model-driven planner whose quality, not the
  gate, would then be under test. Refusing it states the truth about what exists today.
- **Rate-limit with an HTTP 429 and a JSON error only.** Rejected: the page needs a typed reason to say which limit
  was hit and that nothing ran; the frame carries it and the 429 and `Retry-After` stay for other clients.
- **Share the counts through the Redis store.** Not built: the deployment guidance says the counts are per process,
  which is enough for a small public demo and avoids a new dependency on this path.
- **Disable the model when the data mode is mock.** Rejected: the product's own chat uses mock data with a real
  model, so the switch is a separate request-scoped flag that only the lab sets.

## Consequences

A public Agent Lab cannot spend the deployment's quota unless an operator turns live on, and then only within the
limits they set. The limits apply per server process, so a multi-instance deployment should size them for that. The
live path is verified without credentials by refusal and limit behaviour and by fixture isolation under a hostile
environment; a real live run with usage needs keys and was not exercised here.

## Sources

- [Agent Lab strategy and run artifacts](2026-10-01-agent-lab-run-artifacts.md)
- [Gate and isolation tests](../../../../apps/web/tests/lib/agent-lab/live-gate.test.ts)
- [Live gate E2E](../../../../apps/web/tests/e2e/agent-lab-live-gate.e2e.mjs)
