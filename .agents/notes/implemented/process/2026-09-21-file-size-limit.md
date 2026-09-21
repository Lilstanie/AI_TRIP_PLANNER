# Agent Note: Source and test files stay at or below 1000 lines

Status: implemented
Owner: repository owner (@HeadmasterEggy)

## Problem

Large files mix responsibilities and are hard for people and AI tools to read and review in one
pass. The limit was introduced at 500 lines when the workspace styles were split (PR #39), but seven
files already exceed it, including a 913-line test file, a 796-line stylesheet and a 614-line
component, and splitting them would be churn without a behaviour change.

## Decision

Production source files and test files stay at or below 1000 lines of code, as stated in
[development.md](../../../../docs/development.md). A file over the limit is split by responsibility
the next time its domain changes; a new or substantially modified file does not grow past the limit
without a documented exception. The [code-review skill](../../../skills/code-review/SKILL.md) checks
it. No file in the repository exceeds 1000 lines.

## Alternatives considered

**Keep 500 lines.** Rejected by the repository owner as too strict: it flags cohesive files such as
long component tests and domain stylesheets that read fine as one unit.

**No limit.** Rejected: without a threshold, files grow until splitting them becomes a large
refactor on its own.

## Consequences

- Files between 500 and 1000 lines no longer need splitting, so fewer refactors ride along with
  feature changes.
- Files can grow twice as large before review flags them.

## Sources

PR #39 (`refactor: adopt shadcn foundation and split workspace styles`), which introduced the rule.
