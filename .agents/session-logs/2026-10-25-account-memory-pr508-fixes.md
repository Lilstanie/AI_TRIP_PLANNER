---
date: 2026-10-25
author: Codex
branch: fix/account-memory-pr508-verification
pr: 508
area: packages/agents, apps/web, docs
contract-impact: none
---

# Restore account-memory integration on current main

## What changed

- Merged main `b9f4b42c` into PR head `a7f46882`; resolved accommodation, dining and transport conflicts.
- Preserved remembered stay-type/accessibility constraints and shared typed revision intent; removed the obsolete dining regex.
- Removed a duplicate React hook import produced by MessageItem's automatic merge.
- Extended the failure inventory and English/Chinese development guidance; existing Agent Notes cover the retained contracts.

## Validation

- `pnpm --filter @trip/agents test`: 16 files, 186 tests passed.
- Shared, tools and orchestrator tests: 58, 141 and 407 tests passed respectively.
- `pnpm --filter @trip/web test`: 57 files, 645 tests passed.
- `pnpm build`, `pnpm typecheck`, `pnpm lint`: passed; existing lint warnings retained.
- `pnpm test:scripts`: 70 passed, none skipped.
- Memory E2Es: long-term-memory, accommodation-memory, memory-settings all passed.
- `pnpm --filter @trip/web e2e planning-readiness`: passed.
- Initial build failed on the duplicate useState import; the corrected production build passed.

## Notes for the next person

- PGlite, deterministic models/providers and browser UI fixtures establish local integration only.
- No external database migration, live Clerk/provider acceptance or PR merge was performed.
- Migration 0002 requires separate authorization before external deployment.
- Integration lesson: inspect conflict-free imports and specialist prompts, then rerun both memory and readiness paths.
