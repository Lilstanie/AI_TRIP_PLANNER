# ELEC5620 Stage 2 submission (Mon 10-12 Group 14)

Source code due **Sunday 1 November 2026, 23:59**. At the Week 13 demonstration the group downloads
this copy from Canvas and deploys it on site. The task sheet and the contribution statement form are
in [prototype-brief.md](../../docs/design/stage2/prototype-brief.md); the rubric is in
[demo-marking-criteria.md](../../docs/design/stage2/demo-marking-criteria.md).

## Run it from the Canvas copy

Node.js 22 or later and pnpm 9.15.0 (`corepack enable` selects it).

```bash
corepack enable
pnpm install
cp .env.example .env.local   # optional keys; mock data and fallbacks work without them
pnpm dev                     # http://localhost:3000
```

`pnpm build` then `pnpm --filter @trip/web start -p 3000` runs a production server. Without Clerk keys
that server uses mock data and makes no model calls, so use `pnpm dev`, or add the Clerk keys and sign
in, to show DeepSeek and live data. Keys, fallbacks and what to do when the network fails are in the
[demo runbook](../../docs/demo-runbook.md).

## Where each criterion is shown

| Criterion                                       | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Stage 1 requirements and design (7)          | The Stage 1 models are in [docs/design/stage1/](../../docs/design/stage1/README.md); the class diagrams in [class-diagram.md](../../docs/design/class-diagram.md) name the classes in `packages/` that implement them. Each package carries its own tests under `tests/`; browser journeys are under `apps/web/tests/e2e/` and run in CI.                                                                                                                                                                                       |
| 2. Agent perception, decisions, interaction (4) | Perception: chat brief extraction and map, weather, hotel and flight tools (`packages/tools`). Decisions: a LangGraph workflow with a LangChain supervisor that picks specialists, checks budget and timing conflicts and sends specialists back for revision rounds (`packages/orchestrator`). Interaction: five specialist agents (`packages/agents`), `@`-mentions and hand-offs, the Agent Team panel and the Trajectory record in the workspace. Agent Lab (`/agent-lab`) compares planning strategies on fixed scenarios. |
| 3. Agile development (4)                        | Jira project TP (stories, epics and sprint), GitHub pull requests that carry the TP key in their title, Agent Notes for decisions in [`.agents/notes/`](../../.agents/notes/README.md) and dated session logs in [`.agents/session-logs/`](../../.agents/session-logs/README.md).                                                                                                                                                                                                                                               |
| 4. Advanced technologies (5)                    | See the table below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

## Advanced technologies

| Technology                                                  | Where                                                  | Why it was chosen                                                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| LangGraph and LangChain multi-agent workflow                | `packages/orchestrator`, `packages/agents`             | The graph owns control flow, conflict checks and revision rounds; the supervisor only chooses specialists.                           |
| DeepSeek model with deterministic fallback                  | `packages/agents/src/models.ts`                        | MiniMax was measured at 15-25 s per structured call (37-81 s per page) against about 20 s per page on DeepSeek (`.env.example`).     |
| Next.js 15 and React 19                                     | `apps/web`                                             | Server API routes and the streaming workspace in one application.                                                                    |
| Installable app with a phone layout                         | `apps/web/components/pwa`                              | The same workspace installs on a phone and adapts at narrow widths.                                                                  |
| Cloud services: Vercel, Clerk, Neon Postgres, Upstash Redis | `apps/web/lib/{auth,db,account}`, `packages/services`  | Sign-in, cross-device sync and a durable store without running servers.                                                              |
| Maps with fallback: Google Maps, OpenStreetMap, MapLibre    | `packages/tools`, `apps/web/lib/map-provider`          | Google first; free OpenStreetMap services when Google refuses, is over quota or times out.                                           |
| CI/CD with GitHub Actions, Turborepo and Docker             | `.github/workflows/ci.yml`, `turbo.json`, `Dockerfile` | Typecheck, lint, tests, build and browser acceptance run on every pull request; Docker gives a reproducible development environment. |
