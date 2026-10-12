# Agent Note: Explicit completed skill-review checkpoints

Status: implemented

## Problem

The maintenance reminder used the latest skill-directory commit as its global baseline. Helper
cleanup and partial corrections erased outstanding activity, while bare Issue mentions silently
excluded closures. Issues API responses can omit PR merge state, and malformed or truncated remote
responses could crash or misrepresent the counts.

## Decision

The existing due CLI accepts only a committed full-review record with an explicit reviewed revision,
coverage of every project skill and substantive per-skill summaries. Explicit Issue exclusions also
require rationale and committed evidence paths; commit-message mentions convey no review evidence.
The [skill workflow](../../../skills/skill-maintenance/SKILL.md#4-record-a-completed-full-review)
owns the schema and maintainer procedure. No checkpoint is created by this implementation.

Ordinary edits keep the checkpoint. Counts start after the reviewed revision, including work between
that revision and the record commit. A closure after the record commit is counted again even when
that Issue was previously covered. Missing or invalid records, changed skill inventory, shallow or
unavailable history conservatively require review. Local counts remain available where Git permits;
failed counts are unavailable. This extends the
[repository workflow decision](2026-09-22-repository-workflow-skills.md) without replacing its skill
ownership or changing the advisory per-skill drift baseline.

The existing human and JSON commands, threshold flags and due/not-due exit codes remain. Remote
failures are explicit; missing PR merge state requires a PR lookup. Pagination follows every page
until completion, rejecting repeated entries as incomplete. A failed PR lookup retains measured Issue
counts. Broken references and unavailable drift checks independently require review.

## Alternatives considered

- Continue using the latest skill edit: helper-only and partial updates still hide outstanding work.
- Infer exclusions from commit-message Issue references: a mention gives no substantive coverage.
- Accept fixture success as a full review: public CLI acceptance cannot inspect the meaning of every
  skill against current decisions and code.

## Consequences

Maintainers must commit an honest full-review record and evidence for exclusions. Schema validation
checks reachability, complete inventory and record structure; a human still judges substantive review.
Unavailable remote data cannot establish an exact zero. First-run reminders remain due until a full
review is completed. The isolated subprocess acceptance retains red/green evidence outside tracked
source and cannot certify the working repository's skills. The parent integration owns development
navigation, bilingual instructions and the actual full-review audit.

## Sources

- Specification #305 and parent #300, including the confirmed public subprocess testing seam.
- [CLI acceptance](../../../../apps/web/tests/cli-e2e/skill-maintenance.e2e.mjs).
