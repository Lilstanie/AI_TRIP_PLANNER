---
date: 2026-09-22
author: Claude Code, with @HeadmasterEggy
branch: docs/refresh-stale-docs
pr: none
area: README, docs, .env.example, Docker, .github/CODEOWNERS, packages/tools
contract-impact: none
---

# Bring README, docs and configuration in line with the current code

## What changed

- README, `development.md`, `architecture.md`, `team-workflow.md`: removed the deleted HITL flow,
  in-process-only storage and completed work presented as open; `architecture.md` loses its history
  section.
- `.env.example` and `development.md` list `KV_REST_API_URL`, `KV_REST_API_TOKEN` and
  `WEATHER_API_KEY`, which the code reads; unused `DATABASE_URL`, `REDIS_URL` and `MOCK_API_URL` go.
- `team-workflow.md` ownership table describes responsibilities instead of scaffold-era TODOs;
  `CODEOWNERS` mirrors it, including `serpapi.ts`, `weather.ts`, `data-mode.ts` and `apps/web/lib`.
- Dockerfile and compose comments describe what they do; the commented `redis` service is replaced
  by a note that the store needs a Redis REST API. `gateway.ts` comment no longer calls itself stale.
- File size limit raised from 500 to 1000 lines, with an Agent Note.

## Why

An audit after #46 found these files contradicting the code. The file-size change is the owner's call.

## Validation

- Environment variables compared by script between `.env.example` and names read in code.
- `node scripts/verify-docs.mjs`, `node scripts/verify-protected-files.mjs origin/main`: pass.
- `pnpm --filter @trip/tools typecheck` after the comment-only change: passes.
- No source file exceeds 1000 lines (`wc -l` over `apps/web` and `packages`).

## Notes for the next person

- Module ownership of the newly listed files (`serpapi.ts` → C, `weather.ts` → D, `route-options.ts`
  and `airports.ts` → B) is inferred; confirm with the team.
- Prettier formatting of `class-diagram.md` and `dsh-thinking-ui.md` was left alone: it would rewrite
  a quoted source excerpt.
