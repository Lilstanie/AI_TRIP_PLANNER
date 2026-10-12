# Agent Note: Task-scoped review gates and handoff

Status: implemented

## Problem

The CLI task prohibited added code comments, but implementation and initial review missed that
requirement. A repository-risk checklist alone did not carry the originating specification into
review. Subsequent code also needed its own review status after the original reviewer disappeared.

## Decision

[review-trip-planner](../../../skills/review-trip-planner/SKILL.md) requires a handoff with resolved
comparison and HEAD SHAs, tracked/untracked scope, originating requirements, applicable rules and
validation evidence. Standards and Spec remain separate conclusions. The user's reviewer-count and
reuse limits override a global workflow's parallel-agent defaults.

The skill invokes its local `scripts/check-added-comments.mjs` over the diff's added comments,
with an explicit base and literal JS/TS paths. Git identifies added lines against the working tree;
TypeScript parsing identifies comments without mistaking literal text for comments. Selected untracked
files are new in full, including files recreated after removal from the current index. Parsed JSX
text spans exclude visible comment delimiters while expression comments remain checked.
Exact comment text in a selected file may be exempted with a task-approved
reason; there are no implicit licence/directive exemptions.
[No added comments by default](2026-10-12-no-added-comments-default.md) later set the repository-wide
convention; this note's handoff packet and comment gate remain in effect.

The CLI's public acceptance journey is `apps/web/tests/cli-e2e/review-comment-policy.e2e.mjs`.
It preserves temporary Git fixtures, commands and outcomes under `output/e2e/review-comment-policy/`.
The gate is wired into local review/pre-push guidance. Its standalone acceptance is discovered by
CLI acceptance. [Automated enforcement](2026-10-13-comment-policy-ci.md) adds the independent PR/main
job; the local checker and handoff remain in effect.

This supplements [repository workflow skills](2026-09-22-repository-workflow-skills.md) and
[review skill naming](2026-10-11-review-skill-names.md). It reverses neither decision.

## Alternatives considered

- Add a reviewer reminder alone: leaves a mechanical task constraint dependent on attention.
- Ban comments repository-wide: applies one task's constraint to unrelated work.
- Add a CI job now: requires an agreed persistent task scope and explicit authorization for protected
  configuration; the requested local workflow can invoke the deterministic check directly.
- Match comment delimiters with a regular expression: misclassifies strings, regex and JSX/template text.

## Consequences

- Review packets retain the original requirements and make missing review evidence visible.
- The checker requires installed TypeScript and rejects malformed source, unsupported scope and bad
  configuration with exit 2. It reports violations with exit 1 and a clear scope with exit 0.
- Local invocation depends on following the review workflow. The independent comment-policy job
  records mechanical enforcement; it does not establish independent review of the latest diff.
- Root configuration, frozen history and global/plugin skills remain outside this change.
