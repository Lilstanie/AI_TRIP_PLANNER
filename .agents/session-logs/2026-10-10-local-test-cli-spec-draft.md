---
date: 2026-10-10
author: Codex
branch: main
pr: none
area: .agents/notes, .scratch
contract-impact: none
---

# Draft the local test CLI specification and six vertical tickets

## What changed

- Synthesized the [existing proposal](../notes/proposed/testing/2026-10-10-local-test-cli.md)
  into `.scratch/local-test-cli/spec.md`, using the invoked to-spec template.
- Drafted six separate tickets under `.scratch/local-test-cli/issues/`, each with observable
  acceptance criteria, failure-first E2E requirements, blocking edges and the no-comments constraint.

## Why

The user requested to-spec followed by to-tickets. Their skills require confirmation of the test seam
and ticket breakdown before publication. The proposed seam is the public CLI, retaining existing
browser/API assertions. One complete isolated invocation gates the five additional user behaviors.

## Validation

- Read tracker conventions and live GitHub issues/labels; no matching CLI issue was found.
- Scoped `pnpm exec prettier --check`: passed for all seven draft files.
- `pnpm verify:docs`: passed.
- `pnpm verify:protected`: passed.
- `git diff --check`: passed.

## Notes for the next person

Drafts await user confirmation; no GitHub issue was created or modified. Once approved, publish the
spec and six children with ready-for-agent labels and native blocking links. Implementation remains
paused; no runtime/E2E check, commit or push occurred. No shipped docs or implemented note needs an
update. Existing dated logs and unrelated UI/Android changes were preserved.
