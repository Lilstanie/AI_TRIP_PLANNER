# Agent Note: One shared disclosure motion in the trip panel

Status: implemented
Owner: spec #730, ticket #733

## Problem

The budget breakdown and Travel tips are native `details` elements. A closed `details` hides its
content at once, so both opened and closed in a single frame and pushed the day plan down abruptly.

## Decision

- The `disclosure` class in `apps/web/app/styles/motion.css` is the one expand/collapse primitive. It
  animates the `::details-content` box (`block-size` 0 to `auto` through `interpolate-size`, plus
  opacity and `content-visibility`) with `--disclosure-duration` (the `--duration` token) and
  `--disclosure-ease` (the `--ease-out` token). Under `prefers-reduced-motion: reduce` the transition
  is removed.
- The budget summary and Travel tips carry the class; they stay `details`/`summary`, so keyboard,
  accessible names and the existing `open` state keep working. Any later disclosure in the panel adds
  the class instead of its own motion.
- The panel order is unchanged: trip facts line, one-line budget summary, tips, day plan.

## Alternatives considered

- A button-and-region component with JS height measurement: more code and it would change the
  `details` contract that other E2E scripts read.
- Animating the `details` element itself: it cannot animate closing, because the content is hidden
  as soon as `open` is removed.

## Consequences

- Browsers without `::details-content` support (older Safari and Firefox) open and close instantly.
- Verified by `trip-panel-motion.e2e.mjs`, which samples frames while opening and closing at 1440 and
  390x844 and under reduced motion.
