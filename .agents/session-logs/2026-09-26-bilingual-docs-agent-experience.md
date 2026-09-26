---
date: 2026-09-26
author: Codex
branch: docs/simplification-prose-skills
pr: none
area: docs and agent skills
contract-impact: none
---

# Add Chinese documentation and two agent workflows

## What changed

- Adapted DSH `agent-experience` and `translate-docs` to project-local skills.
- Added full Chinese counterparts for nine existing documentation pages, plus bilingual indexes
  and a translation-maintenance guide. Instruction files and package READMEs remain outside pairing.
- Added a standalone pair checker and explicit review hashes; docs and pre-push instructions require
  same-task counterpart updates. Root verification scripts and CI remain unchanged.
- Preserved source attribution and added the implemented bilingual workflow note.

## Why

The owner requests Chinese documentation that follows English updates. The skill guides a running
agent; a file save does not launch a background translator. Pair freshness is checked locally.

## Validation

- Pairing CLI E2E: 27/27 cases passed after a written failure inventory.
- Repeatable driver and command evidence: `output/e2e/doc-pairing/run-checker-e2e.py` and `summary.json`.
- Both new skills passed the skill creator's `quick_validate.py`.
- Independent skill forward test passed: English-only changes fail freshness, a minimally synchronized
  Chinese counterpart still needs review, and scoped recording makes the final check pass.
- Forward-test evidence: `output/e2e/doc-pairing/forward-workspace-command-results.json`.
- Independent translation review caught and corrected extraction-over-known precedence and unified
  the trip brief terminology; code blocks, IDs and technical conditions remain intact.
- Design review corrected the round-heading threshold to round > 1. All 11 reviewed pairs passed
  the pairing checker and their hashes were explicitly recorded.
- `pnpm verify:docs`, `pnpm verify:protected` and `git diff --check` passed.
- Scoped Prettier passed. A broader scan reported seven unchanged third-party Libraries.dev
  references from parallel work; those files and its better-ui/note/log edits were preserved.

## Notes for the next person

Hash/structure checks do not prove semantic equivalence. Record only pairs whose meaning was reviewed.
Known source inconsistencies remain source issues, including start-mode response wording and the DSH
thinking UI reference's clock-delay table. Translations preserve rather than silently correct them.
No live model/provider calls or app behavior changes occurred. Earlier work and frozen logs remain.
