---
date: 2026-10-12
author: Codex
branch: docs/review-skill-names
pr: none
area: global skills, docs, .agents
contract-impact: none
---

# Prefix the Standards and Spec review skill with code-review

## What changed

- Rename the global review workflow to code-review-standards-spec and update current global consumers.
- Update development documentation, its Chinese pair, repository review handoff and the naming decision.
- Refresh the external Archify workflow diagram to show inherited review results and automatic PR formatting as a proposal.

## Validation

- Archify workflow validation and delivery passed all 9 showcase checks with zero errors or warnings.
- Automated browser evidence passed four desktop viewports; light laptop and dark large-display screenshots were inspected.
- Recorded the reviewed development documentation pair.
- The whole documentation-pair check remains blocked by the pre-existing docs/design/ui-guidelines.md stale review.
- No application tests were run; this change affects naming, references and an external design artifact.

## Notes for the next person

- Backups of global changes are outside skill discovery under /Users/joey/.codex/skill-backups/.
- Historical session logs and plugin caches are unchanged. Global changes are not distributed by a repository PR.
- The executable workflow, PR body gate and automatic merge are not implemented.
- Existing Android, UI-guidelines and scratch changes are unrelated and preserved.
