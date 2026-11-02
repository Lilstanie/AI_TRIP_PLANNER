# Agent Note: Agent Lab live runs are on by default

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

Agent Lab's live path was opt-in: it existed only where the deployment set `AGENT_LAB_LIVE_ENABLED=true`. The
deployed site never set it, so its Data mode control read "Live data (not enabled)" and a signed-in traveller could
not run a specialist strategy on real providers and models for the week 13 demo. Only the repository owner can change
the deployment's settings. The opt-in was chosen when Agent Lab allowed anonymous live runs; since the
[model access boundary](2026-10-27-model-access-boundary.md), live on a deployment already requires a signed-in caller.

## Decision

Live is on unless the deployment sets `AGENT_LAB_LIVE_ENABLED=false`, which stays as the kill switch. Everything else
in the [live gate](2026-10-02-agent-lab-live-gate.md) holds: sign-in on deployments, live only for the specialist
strategies, the per-process concurrency and hourly limits, fixture isolation and typed `rejected` frames. The page
works out live availability per request from the same check the route uses, so an anonymous visitor sees "(sign in)"
instead of a live option that would be refused. When live is available, the page starts in Live data unless the
traveller's saved Trip data preference is sample data, the same preference the workspace's data-mode button writes.
The run-started event names the data mode it ran with.

## Alternatives considered

- **Ask the repository owner to set `AGENT_LAB_LIVE_ENABLED=true` on the deployment.** Not chosen: no code change, but
  the demo would wait on someone else, and the opt-in no longer guards anonymous use, which sign-in now does.
- **Turn live on but always start in Fixture data.** Not chosen: it ignores the traveller's Trip data preference,
  which already defaults to live everywhere else in the app.

## Consequences

A signed-in traveller can spend the deployment's model and provider quota from Agent Lab, at most six live runs per
hour and one at a time per server process unless the limits are changed. A deployment that wants no live runs must
now set `AGENT_LAB_LIVE_ENABLED=false`; the local test CLI and E2E servers that relied on the old default already set
it explicitly.

## Sources

- [Live gate](../../../../apps/web/lib/agent-lab/live-gate.ts)
- [Agent Lab page](../../../../apps/web/app/agent-lab/page.tsx)
