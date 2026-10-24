# Agent Note: remove the per-reply team summary

Status: implemented
Owner: spec #629 follow-up, Joey (decision in thread)

## Problem

Each saved reply that a specialist worked on started with a one-line team summary (#633) above its
Think fold. It repeated the top bar team button and the Think fold rows, so the chat looked busy. It
also was the only way to open an earlier turn's team panel, which needed a "Turn N" bar and a Latest
turn button to return to the live run.

## Decision

- The per-reply summary is removed. `TeamSummary`, `teamSummary`, `TeamRunBar` and the chosen-run state
  in `Workspace` are deleted, along with their CSS and translation keys.
- The team panel always shows the latest run: the live stream while one runs, otherwise the newest
  saved reply's activity. It opens from the top bar button on desktop and the avatar button on phone.
- Each reply's Think fold keeps its `Subagent` rows, so an earlier turn's specialist work stays visible
  there.
- `team-run.tsx` is renamed `team-reveal.tsx` and keeps only the press target (`reveal`) that
  `ThinkingProcess` matches.

## Alternatives considered

**Keep the summary and hide it on narrow widths.** Not chosen: the duplication is the same on desktop.

**Keep the summary and add a Turn selector to the panel.** Not chosen: the Think fold already shows each
earlier run's specialist rows, so a selector would bring back the chosen-run state the summary needed.

## Consequences

- An earlier turn no longer has its own team panel. Its assignments, decision markers and hand-offs are
  shown only in its Think fold, not in the team panel's assignment list.
- The team panel and the phone sheet read the same latest-run model, so the "Turn N" label is gone.
- E2E scripts read the panel right after the send that produced the reply they check. The
  `team-summary` scenario and its failure inventory are deleted.
- `docs/workspace-ui.md` and `.zh.md` drop the reply summary bullet and point at `team-reveal.tsx`.
