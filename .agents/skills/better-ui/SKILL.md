---
name: better-ui
description: Use when polishing or reviewing the visual details of apps/web in AI_TRIP_PLANNER — radii, surfaces, shadows, glass, place photos, icons, hover and press feedback, transitions — so the change follows the Cartographer design contract and its tokens instead of ad hoc values.
---

# UI polish

Polish comes from many small details adding up. In this project the values come from the
[design contract](../../../docs/design/ui-guidelines.md) and `apps/web/app/styles/tokens.css`, not
from taste or a copied recipe. If a detail needs a value the tokens do not have, add a semantic token
with light and dark values. Do not write a one-off number.

When reviewing motion, slow it down in the browser's Animations panel. Anything that looks wrong at
10% speed is subtly wrong at full speed.

## Surfaces and depth

- **Paper first.** Separate panels with `--surface`, `--surface-2` and a 1 px `--border` hairline.
  Use `--shadow-sm` only for small raised controls and `--shadow-md` for drawers and map overlays. Do
  not swap structural hairlines for shadows.
- **Glass for the control layer.** Map overlays, popovers and chrome over scrolling content may use
  the iOS-style glass material. Reading and editing surfaces stay opaque. Follow
  [glass.md](glass.md) exactly, including its fallbacks.
- **Concentric radii.** A nested rounded surface uses outer radius = inner radius + padding. Pick the
  pair from `--radius-sm`, `--radius`, `--radius-lg` and `--radius-pill` (panels `lg`, controls
  `sm`/default, chips `pill`). Keep the tokens even when the arithmetic is off by a pixel or two.
- **Optical alignment.** A button with a trailing icon takes about 2 px less padding on the icon
  side. Fix an off-centre glyph in its SVG, not with margins.

## Motion

- **Timing comes from tokens.** State changes use `--transition` (150 ms). Drawers use
  `--drawer-duration` and `--drawer-ease`. The project has no motion library, so do not add one for
  polish.
- **Interruptible by default.** Use CSS transitions for hover, toggle and open/close, because they
  can reverse midway. Keyframes are for one-off sequences such as the reply reveal and the thinking
  shimmer.
- **Name the properties.** Never write `transition: all`. Animate `transform`, `opacity` and
  `filter`, not layout properties. Add `will-change` only when the first frame visibly stutters. See
  [performance.md](performance.md).
- **Restraint.** High-frequency actions get instant feedback or at most 150 ms on colour and
  opacity: typing, row hover, switching chats. Keep expressive motion for rare moments, like a new
  plan arriving. Exits are shorter and quieter than entrances. Use a small `translateY`, never the
  full height.
- **Press feedback is optional.** If a button gets press feedback, use `scale: 0.96` with a
  transition on `scale` only. Leave dense lists and map controls without it.
- **Motion is never the only signal.** Every animated state change also shows colour, an icon or a
  label. A reduced-motion override is required, as described in the
  [accessibility skill](../better-accessibility/SKILL.md).

## Place photos

Provider photos of a specific place are allowed; decorative photography is not. Follow the
contract's "Place photos" rules:

- Give each slot a fixed `aspect-ratio`, `object-fit: cover` and `loading="lazy"`.
- Use the container's radius and a 1 px inner hairline:
  `outline: 1px solid var(--border)` with `outline-offset: -1px`.
- When there is no photo, show the category icon on `--surface-2`.
- Show the provider's attribution.
- Never place text directly on the image.

## Icons

- The workspace icons live in `components/ui/icons.tsx` and `flow-icons.tsx`. Draw new icons in the
  same set, on the same grid and stroke. Do not mix in a second library on one surface.
- Icons use `currentColor` and take hover, selected and disabled states from CSS. An outline icon is
  the default and a filled icon marks the current state, as the sidebar already does.
- Test every icon at the smallest size it renders, usually 16 px.

## Reporting

Order findings by severity, one row per root cause:

| Severity | Location | Before | After | Why |
| -------- | -------- | ------ | ----- | --- |

- `HIGH`: breaks an interaction, or leaves a state visible only while an animation runs.
- `MEDIUM`: a visible inconsistency, including values that bypass the tokens.
- `LOW`: isolated polish.

Check visible changes with the [ui-verification skill](../ui-verification/SKILL.md), in light and
dark themes.
