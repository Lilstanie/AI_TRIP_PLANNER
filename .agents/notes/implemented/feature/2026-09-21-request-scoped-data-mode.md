# Agent Note: Mock data by default, live data chosen per request

Status: implemented
Owner: A (@Lilstanie)

## Problem

Live providers (Google Places, SerpApi) cost money and need keys, while CI, offline work and demos
must run without them. The mode used to be the deploy-time `USE_MOCK_TOOLS` variable, so switching
it meant editing Vercel environment variables and redeploying.

## Decision

`USE_MOCK_TOOLS=true` stays the default in `.env.example`; tests never depend on an external API.
`packages/tools/src/data-mode.ts` holds a request-scoped mode in `AsyncLocalStorage`, defaulting
to the environment value, and every mock check goes through `mockEnabled()` instead of reading
`process.env`. `/api/chat` honours an `x-trip-data-mode` header set by the top-bar
`DataModeToggle`, and `/api/data-mode` reports the default and whether keys exist.

## Alternatives considered

**Keep the mode deploy-time only.** Rejected: comparing mock and live output required a redeploy.

**Write the chosen mode into `process.env` per request.** Rejected: Fluid Compute reuses one
instance for concurrent requests, so one visitor's choice would leak into another's run. A test
covers that interleaving.

**Hide the toggle from visitors.** Rejected by A: the toggle is visible to everyone, names the
active mode, and flags when live mode has no key behind it.

## Consequences

- Any visitor can spend the shared SerpApi allowance by choosing live mode.
- New provider code must call `mockEnabled()`; a direct `process.env.USE_MOCK_TOOLS` read ignores
  the visitor's choice.

## Sources

[2026-09-21 data mode toggle log](../../../session-logs/2026-09-21-claude-data-mode-toggle.md)
