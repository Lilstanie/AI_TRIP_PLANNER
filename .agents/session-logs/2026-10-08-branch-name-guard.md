---
date: 2026-10-08
author: Claude (Haiku 5.5, Projects thread)
branch: feature/trip-drawer-no-confirmations
pr: none
area: scripts, .github, AGENTS.md, docs
contract-impact: none
---

# Branch-name guard on pull requests (#234)

## What changed

- `scripts/verify-branch-name.mjs`: new check; accepts `feature/`, `fix/`, `refactor/`, `docs/`, `chore/`,
  `test/` prefixes and rejects AI tool names (claude, codex, copilot, cursor, gemini, chatgpt, openai).
  Dependabot branches are exempt.
- `.github/workflows/ci.yml`: a `Branch name` step in the `protected-files` job (pull requests only).
- `AGENTS.md`: the branch rule applies when a harness assigns a branch.
- `docs/development.md` and `docs/development.zh.md`: list the check; pair recorded.

## Why

Owner approved the protected-file changes in the project thread on 2026-10-08. The spec is #233.

## Validation

Run locally: `node scripts/verify-branch-name.mjs <name>` over `claude/project-thread-x` (exit 1),
`feature/deepseek-routing` (0), `docs/x`, `fix/y`, `chore/z`, `test/t`, `refactor/r` (0), `main` (1),
`dependabot/npm_and_yarn/x` (0), `feature/codex-flow` (1), `Feature/Claude-x` (1), `random/name` (1),
`feature/openai-x` (1). Output saved in the implementation scratchpad.
`node scripts/verify-protected-files.mjs origin/main`: passes. `node scripts/verify-docs.mjs`: passes.
`node .agents/skills/translate-docs/scripts/check-pairs.mjs`: 24 pairs checked, pass.
Prettier check on the changed files: applied to the new script.

## Notes for the next person

- The PR itself must pass the new CI step on a `feature/` branch; the check cannot be seen failing on
  a real pull request from here.
