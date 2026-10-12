---
date: 2026-10-11
author: Codex
branch: docs/review-skill-names
pr: none
area: .agents/skills, apps/web/tests/cli-e2e, docs
contract-impact: none
---

# Fix the two Spec review findings through the public CLI

## What changed

- Exclude parsed JSX text spans from comment candidates while retaining expression comments.
- Treat paths absent from the current index as entirely new, even when the base contains the file.
- Add one public CLI regression per finding; update the existing decision, skill reference and paired docs.

## Validation

- JSX regression failed first: output/e2e/review-comment-policy/2026-10-11T07-09-01.841Z/summary.json.
- After the JSX fix, 22 CLI cases passed: 2026-10-11T07-09-19.914Z.
- Recreated-file regression then failed: 2026-10-11T07-09-36.688Z; the checker incorrectly exited 0.
- After the second fix, 23 CLI cases passed: 2026-10-11T07-10-02.208Z.
- Final formatted CLI journey passed 23 cases: 2026-10-11T07-10-33.817Z.
- pnpm verify:docs, git diff --check and protected-file checks passed.
- Scoped added-comment CLI passed against 653f5b2 with no violations or exceptions.
- Typecheck, lint and the full workspace suite were not rerun for this narrow CLI fix.

## Notes for the next person

- Evidence folders above are under output/e2e/review-comment-policy/ and retain fixtures and reports.
- Independent follow-up review is requested from the same Standards and Spec reviewers.
- Existing unrelated Android, UI-guidelines and untracked history/scratch files are preserved.
- No protected root configuration, application runtime, global skills or frozen history changed.
