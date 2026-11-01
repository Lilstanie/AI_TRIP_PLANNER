# ELEC5620 Stage 2 demonstration evidence

English | [中文](demo-evidence.zh.md)

The unit does not ask for a written Stage 2 report: it asks for the source code, the group
contribution statement and a live demonstration
([prototype brief](prototype-brief.md)). This page is the presenters' evidence sheet. It maps each
[demonstration criterion](demo-marking-criteria.md) to what to show live and to numbers anyone can
check. Figures were taken from `main` at `9149d87` and from Jira project TP on 1 November 2026.

## 1. Comprehensiveness of functions and features (7)

| Evidence                 | Figure                                                                                                                                                                       | Where                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Stage 1 design traced    | Every Stage 1 use case and class model has a page that names the code that implements it                                                                                     | [Stage 1 design model](../stage1/README.md), [class diagrams](../class-diagram.md)           |
| Unit and component tests | 137 test files, 1,504 tests in six packages (`pnpm test`, 1 November 2026)                                                                                                   | `packages/*/tests`, `apps/web/tests`                                                         |
| Browser journeys         | 97 end-to-end scripts; CI picks the ones a change touches and runs the full set on every push to `main`                                                                      | `apps/web/tests/e2e`, `apps/web/tests/cli-e2e`                                               |
| Edge cases               | Infeasible budget, stalled revision and round-limit stops; Google key rejected; live data unavailable; refresh during a reply; signed-out access (24/24 real-session checks) | [agent-lab-exit-paths.md](../../../submission/stage2/agent-lab-exit-paths.md), TP-62, TP-238 |
| Clean install            | A fresh `git archive` of `main` installs and builds in about 1 min 36 s                                                                                                      | [submission README](../../../submission/stage2/README.md)                                    |

Show live: one trip planned end to end in chat, then the itinerary, map, budget and an edit on the
Trip page, on desktop and on a phone-width window.

## 2. AI agent: perception, decision-making and interaction (4)

| Capability      | What the agents do                                                                                                                                                                                                                                        | Where                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Perception      | The brief model turns free text into destinations, dates, party, budget and intent (pace, diet, interests); tools read live flights, stays, places, routes and weather                                                                                    | `packages/agents`, `packages/tools`, PR #850 (TP-202) |
| Decision-making | A LangGraph workflow: a supervisor chooses specialists, the graph checks budget and timing conflicts, sends only the agents involved back for revision, and stops with a named reason (`converged`, `infeasible_budget`, `no_improvement`, `round_limit`) | `packages/orchestrator`                               |
| Interaction     | Five specialist assistants, `@`-mentions and hand-offs, the Agent Team panel and the Trajectory record of each run; a reply survives a page refresh                                                                                                       | `apps/web`, PR #888 (TP-238)                          |

Data behind the design, from repeatable Agent Lab runs on the same A$2,300 trip
([agent-lab-exit-paths.md](../../../submission/stage2/agent-lab-exit-paths.md)):

| Strategy                            | Estimate | Over budget             |
| ----------------------------------- | -------- | ----------------------- |
| One agent planning alone            | A$3,960  | +A$1,660                |
| Five specialists, no revision       | A$2,560  | +A$260                  |
| Five specialists, targeted revision | A$2,120  | within, one extra round |

Improvement from feedback: a full live trip test on 30 October found 22 problems (flight pricing,
the day plan starting before the flight landed, maps after Google refused the key, and others). Each
became a Jira story and was fixed in TP-194 to TP-223 (PRs #837 to #870) within two days.

## 3. Agile development experience (4)

| Practice           | Evidence                                                                                                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User stories       | Jira project TP: 238 issues, 230 done. Stories are written as "As a traveller, I …" with acceptance criteria                                                                                                |
| Iterations         | TP Sprint 1 (21 to 31 October, 19 issues, closed 1 November). Before Jira, weekly iterations are visible in Git: 795 commits on `main` from 24 August, with weekly peaks of 133 (week 41) and 243 (week 43) |
| Traceability       | Every pull request title carries its TP key, so Jira links story, branch, commits and PR; 403 pull requests merged                                                                                          |
| Feedback loops     | Code review and CI on every pull request; five recorded retrospectives (two on 8 October, then 24, 28 and 30 October) whose actions changed the team rules; the live trip test above                        |
| Decisions recorded | Agent Notes under [`.agents/notes/`](../../../.agents/notes/README.md) and 700+ dated session logs                                                                                                          |
| Collaboration      | Five members, each owning two core features and one optional feature; the order of the live demo follows that split                                                                                         |

Gap to fix before the demo: Jira holds one sprint only, so its burn-down chart covers 21 to 31
October. Show the Jira sprint report for that sprint, and the weekly commit counts above for the
earlier weeks.

## 4. Incorporation of advanced technologies (5)

| Technology                                                  | What it improves                                 | Measured                                                                                                                                          |
| ----------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| LangGraph and LangChain multi-agent workflow                | Plan quality under a budget                      | Targeted revision A$2,120 against A$3,960 for a single agent on an A$2,300 budget (table above)                                                   |
| DeepSeek model routing with a deterministic fallback        | Response time                                    | MiniMax took 15 to 25 s per structured call (37 to 81 s per page); DeepSeek about 20 s per page (`.env.example`, `packages/agents/src/models.ts`) |
| Next.js 15 and React 19 streaming with durable turns        | Interaction and reliability                      | A reply in progress survives a page refresh and is replayed by run id (PR #888)                                                                   |
| Installable app with a phone layout                         | Reach on mobile devices                          | 23/23 installability checks passed (manifest, icons, offline page)                                                                                |
| Cloud services: Vercel, Clerk, Neon Postgres, Upstash Redis | Scalability and security without running servers | 24/24 real-session checks: sign-in, token expiry, cross-account isolation, sign-out (TP-62)                                                       |
| Maps with fallback: Google Maps, OpenStreetMap, MapLibre    | Availability                                     | Maps, routes and places keep working with Google's key rejected (PR #840, TP-198)                                                                 |
| CI/CD: GitHub Actions, Turborepo, Docker                    | Maintainability and delivery speed               | Median PR CI time fell from 7.3 min (29 runs) to 5.3 min (29 runs) after PR #880 chose browser tests by change; 403 PRs merged through it         |

Show live: the Trajectory of one run, Agent Lab comparing strategies, the phone layout, and a green
CI run on a merged pull request.
