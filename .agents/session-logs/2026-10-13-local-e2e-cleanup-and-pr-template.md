---
date: 2026-10-13
author: Codex
branch: main
pr: none
area: apps/web, .github, agent skills
contract-impact: none
---

# Audit local E2E residue and remove the obsolete PR template

## What changed

- Removed `.github/pull_request_template.md` after confirming the `/pr` skill is the active PR body format.
- Updated `.agents/skills/skill-maintenance/scripts/is-due.mjs` to track the `/pr` skill instead of the deleted template.
- Retained generated E2E reports and build directories because the current cleanup command rejected their recorded filesystem identities.

## Why

- The local E2E CLI intentionally retains reports and evidence; temporary build directories require explicit cleanup.
- The 40 remaining `.next-e2e-local-*` directories could not be safely removed: cleanup reported `summary is malformed`, and filesystem device IDs no longer matched the ownership records.
- `output/` contains about 3 GB, mostly retained Playwright/iOS run evidence; no broad output deletion was performed.

## Validation

- `git grep -n -i -E 'pull_request_template|pull request template|prtemplate'`: only the maintenance watch-list and historical session log referenced the template before editing.
- `node apps/web/tests/e2e/run.mjs cleanup <invocation-id> --json` using the bundled Node runtime for each of 40 build directories: all returned `blocked`; no resources were removed, evidence was retained.
- Compared the saved ownership record with filesystem metadata for a representative run: device ID differed (`16777232` recorded, `16777231` current), so cleanup correctly failed closed.
- No E2E or other test suite was run.

## Notes for the next person

- If old E2E build directories need removal, repair or explicitly migrate their ownership records through a reviewed cleanup path; do not bypass the current identity check or delete them manually.
- Existing dirty and untracked user files were preserved.
