# Agent Note: Glass for the control layer

Status: implemented
Owner: repository owner (@HeadmasterEggy)

## Problem

The [design contract](../../../../docs/design/ui-guidelines.md) banned glass along with neon, noise
and textures. The repository owner wants the floating controls to feel like iOS materials: chrome
over the map and over scrolling content that stays legible without hiding what lies beneath it.
Opaque overlays on the map hide the context the traveller is navigating, while glass applied
everywhere hurts the dense text this workspace depends on.

## Decision

Glass is allowed on the **control layer** only: map overlays, the top bar over scrolling content,
popovers, menus and tooltips. The content layer stays opaque paper: the chat stream, the composer
field, drawer bodies, cards and dialogs with forms. Glass never stacks on glass.

Glass values come only from semantic tokens (`--glass-bg`, `--glass-border`, `--glass-highlight`,
`--glass-blur`) with light and dark values. Glass keeps the 1 px hairline, must meet WCAG AA against
the busiest backdrop, and becomes `--surface` when `backdrop-filter` is unsupported, under
`prefers-reduced-transparency: reduce` or `prefers-contrast: more`, and in forced-colors mode. The
rule lives in the design contract, and the recipe lives in
[the better-ui glass reference](../../../skills/better-ui/glass.md). This note changes the contract
only. No surface uses glass yet.

## Alternatives considered

**Keep the ban.** Rejected by the repository owner. Opaque paper over the map hides the places and
routes the controls refer to.

**Glass on every surface, drawers included.** Rejected. Drawer bodies hold timelines, budgets and
forms that people read and edit for long periods. A blurred, moving backdrop lowers contrast there,
and each extra `backdrop-filter` layer costs repaint time on every map pan.

**Refraction and distortion effects that imitate Liquid Glass with SVG filters.** Rejected. Support
differs across browsers, the effects cost too much over a live map, and blur plus translucency
already delivers the material.

## Consequences

- The first change that ships glass adds the tokens to `apps/web/app/styles/tokens.css`. It must
  check contrast over real map tiles in both themes and confirm that panning stays smooth at phone
  width.
- Reviews treat glass on a content surface, glass on glass, or glass without its fallbacks as a
  contract violation.
- Neon, noise, texture images, decorative photography and illustrations remain banned.
