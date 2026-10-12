# Agent Note: Maintained source carries no added comments

Status: implemented

## Problem

Changes kept reintroducing explanatory comments into application, test and maintenance-script source.
The earlier pass that removed them
([2026-10-10 code comment cleanup](../../archived/simplification/2026-10-10-code-comment-cleanup.md))
recorded itself as a one-time cleanup, so no later change was bound by it. The added-comment check ran
only when the originating task happened to prohibit comments, and an implementer writing code read no
rule at all.

## Decision

[AGENTS.md](../../../../AGENTS.md) carries the default for maintained source: no explanatory comments.
A comment stays where it carries a contract or a tool instruction — JSDoc for non-obvious returns,
failures, ownership and timing, plus shebangs, compiler and lint directives, SQL delimiters and
third-party licence notices. The `prose-standard` skill owns the detail. `review-trip-planner` runs its
added-comment check over the diff by default instead of waiting for a task to prohibit comments.

## Alternatives considered

**Leave comments to the originating task.** The earlier note chose this. It lost because the
implementer reads no rule while writing code, so the constraint rested on a reviewer noticing a
requirement nobody restated.

**Ban every comment-shaped span.** Rejected for the same reason as before: directives, shebangs, SQL
delimiters and licence notices carry behaviour and attribution, so removing them changes checks or
drops notices.

**Enforce it in CI.** Rejected for now: the check needs an explicit file scope per change, and a CI
job means protected configuration this change does not authorize.

## Consequences

- Rationale lives in `docs/`, Agent Notes and commit messages instead of beside the code.
- A comment inside an added line reads as a violation; an author who wants one states the reason in
  review.
- [Automated enforcement](2026-10-13-comment-policy-ci.md) supersedes the local-only choice above;
  the default policy and local review gate remain in effect.
- The earlier cleanup note is archived alongside this one; its preserved-directive list still governs
  what the default keeps.

## Sources

- [2026-10-10 code comment cleanup, archived](../../archived/simplification/2026-10-10-code-comment-cleanup.md)
