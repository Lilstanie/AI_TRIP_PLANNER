# Agent Note: the Trajectory view uses glass on its floating surfaces only

Status: implemented
Owner: spec #755, ticket #763

## Problem

The Trajectory view was flat: a bordered white box with a full-width toolbar, a view switch that sat on a
hairline and an inspector docked with a border. Joey asked for it to look calmer and more finished. The
[2026-10-27 trip redesign](2026-10-26-trip-redesign.md) keeps the glass system as the house style, so the
restyle had to reuse it rather than add colours.

## Decision

- **Glass only where something floats.** The Simple and Full view switch, the full view toolbar (an inset
  rounded strip) and the record inspector (an inset card, a full-bleed sheet at phone width) carry the
  existing `glass-float` and `glass-float--raised` classes from `glass.css`. Simple rows, ledger rows, the
  timeline and the ledger header stay on the solid surface, so text sits on a flat fill.
- **Reduced transparency for free.** Those classes already fall back to `var(--surface)` with no blur under
  `prefers-reduced-transparency`, `prefers-contrast: more` and forced colours; no rule was added.
- **Quiet text colour.** The view's secondary, tertiary and caption label tokens are the text colour mixed
  74% into the surface. The global `--text-dim` is 4.49:1 on glass over the page tint, just under AA; this
  keeps the global tokens untouched and gives 6.2:1 or more.
- **Calmer rows.** The simple list has padding, rounded rows, 500 weight summaries and no row separators.
  Heights of ledger rows are unchanged because virtual scrolling measures them.
- **No copy or data change.** The E2E compares the view's text before and after.

## Alternatives considered

- **Glass on every row.** Blur on a long list costs paint time and puts text on a moving backdrop; rejected.
- **Darken `--text-dim` globally.** Touches every screen in a restyle of one view; rejected.
- **A new glass mixin in each CSS module.** Duplicates the reduced-transparency and forced-colour fallbacks
  that `glass.css` already owns; rejected.

## Consequences

- A new floating Trajectory surface adds one class from `glass.css`, not its own blur rule.
- The `trajectory-restyle` E2E fails if a row gains blur, a glass surface loses it, text drops below 4.5:1
  in light or dark, or reduced transparency leaves a translucent fill.
