---
date: 2026-09-26
author: Codex
branch: docs/simplification-prose-skills
pr: none
area: docs and project skills
contract-impact: none
---

# Prepare the skills and bilingual documentation pull request

## What changed

- Collected the requested five project skills and their attribution and decision notes.
- Included eleven reviewed English and Chinese documentation pairs, their manifest and CLI checker.
- Prepared the complete documentation change for a pull request targeting main.

## Validation

- `git fetch origin main`: passed; the branch starts at the current main commit.
- `pnpm verify:docs`: passed.
- `pnpm verify:protected`: passed.
- `node .agents/skills/translate-docs/scripts/check-pairs.mjs`: eleven pairs passed.
- Prettier on all outgoing Markdown except preserved upstream Libraries.dev references: passed.
- `git diff --cached --check`: passed.
- The previous implementation session recorded 27/27 CLI E2E cases; its replay artifacts remain
  under ignored `output/e2e/doc-pairing/` and are not part of this commit.

## Notes for the next person

Translation synchronization requires agent work and semantic review. The pairing checker detects
structural and reviewed-hash drift locally; it is not connected to CI and does not prove translation
meaning. The seven Libraries.dev reference snapshots retain their upstream formatting.
