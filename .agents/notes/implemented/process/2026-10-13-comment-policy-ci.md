# Agent Note: Automate the added-comment gate

Status: implemented

## Problem

The repository's default comment policy had a deterministic checker but relied on local reviewer
attention. A passing application CI run did not show whether the checker ran.

## Decision

The independent `.github/workflows/comment-policy.yml` invokes the existing TypeScript-based checker
through a clean-head adapter. PRs compare merge-base to head; main pushes compare before to head,
including every commit in the push. Git selects changed supported paths, including detected renames;
unknown or unavailable history fails instead of assuming an empty scope. No supported paths explicitly
skip. Reports and regression summaries are retained for seven days.

`.agents/skills/review-trip-planner/assets/comment-exceptions.json` is a versioned list of exact file, comment
text and reason. It permits reviewed contracts and tool instructions without blanket syntax-based
exemptions. The checker validates entries but reviewers judge the reasons. CI needs read-only
permissions, installed TypeScript and Git, with no browser or lifecycle-script execution.

This replaces only the local-only enforcement choice in
[the default comment policy](2026-10-12-no-added-comments-default.md) and
[task-scoped review gates](2026-10-11-task-scoped-review-gates.md). Their source policy, local checker
and review handoff remain in effect. Existing required-check settings are unchanged.

## Alternatives considered

- Keep local invocation alone: mechanical omissions still depend on reviewer attention.
- Automatically approve directive/JSDoc shapes: syntax does not establish a necessary contract.
- Move the checker into `.github/`: local review and CI can share its current skill-owned location.

## Consequences

- Every PR and main push exposes the comment-policy result independently of browser acceptance.
- Exceptions require precise maintenance and review; CI cannot establish approval from prose alone.
- Main checks observe a change after it lands; repository required-check settings govern merge blocking.
- Missing/zero/non-ancestor push history fails and needs investigation rather than weakening coverage.

## Sources

- [Checker and CI reference](../../../skills/review-trip-planner/references/comment-policy.md)
