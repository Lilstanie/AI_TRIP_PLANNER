---
name: agent-notes
description: Use when writing, updating, superseding, rejecting or archiving an Agent Note in AI_TRIP_PLANNER, when a change touches packages/shared or makes a decision with lasting rationale, or when turning decisions buried in session logs into notes.
---

# Write and maintain Agent Notes

The [notes README](../../notes/README.md) owns the layout, lifecycle and format; `pnpm verify:docs`
checks them. This skill covers the judgment around them.

## Decide whether a note is needed

Write one for a `packages/shared` or API contract change, a choice between real alternatives, or a
team rule, tool or skill change. Skip local refactors, UI tweaks and obvious bug fixes. If a note
already owns the decision, update it instead of writing another.

## Supersession check — every new note

1. Search existing notes for the same subject: `grep -ril "<keyword>" .agents/notes/implemented .agents/notes/proposed`.
2. Classify each hit:
   - **Fully replaced:** archive the old note in the same PR — move it to `archived/<class>/`, add
     `Archived: YYYY-MM-DD` below its status, and point inbound links at the new note.
   - **Partly replaced:** keep both, cross-link them, and correct facts that changed.
   - **Unrelated:** leave it.
3. A reversed decision never edits the old note into the new one.

## Writing the note

- Choose the class by what the decision is about, not by the commit prefix. `architecture` is
  shipped structure; `process` is tooling and workflow.
- State the problem so it stands without the solution.
- `## Decision` describes the current code in the present tense. Check every path, name, default and
  number against the code, not against a session log; logs go stale.
- `## Alternatives considered` lists only alternatives someone actually weighed, with why each lost.
  If none were recorded, say so rather than inventing one.
- `## Consequences` states both what the decision costs and what it buys.
- Link sources — session logs, commits, PRs — in a `## Sources` section.

## Keeping notes current

When code moves or renames something an implemented note mentions, update the note's facts in the
same PR. Archive a note when it no longer guides future work; never archive a proposed note — reject
it instead. Never edit anything in `rejected/` or `archived/`.
