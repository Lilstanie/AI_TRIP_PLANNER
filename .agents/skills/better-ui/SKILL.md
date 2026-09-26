---
name: better-ui
description: Use when polishing or reviewing the visual details of apps/web in AI_TRIP_PLANNER — radii, surfaces, shadows, glass, place photos, icons, hover and press feedback, transitions — so the change follows the Liquid Glass design contract and its tokens instead of ad hoc values.
---

# UI polish

Polish comes from many small details adding up. In this project the values come from the
[design contract](../../../docs/design/ui-guidelines.md) and `apps/web/app/styles/tokens.css`, not
from taste or a copied recipe. If a detail needs a value the tokens do not have, add a semantic token
with light and dark values. Do not write a one-off number.

For a requested Libraries.dev effect, use [libraries-dev](../libraries-dev/SKILL.md) for package
selection and integration under this same design contract. Ordinary polish keeps the existing motion
helpers.

When reviewing motion, slow it down in the browser's Animations panel. Anything that looks wrong at
10% speed is subtly wrong at full speed.

## Surfaces and depth

- **Glass for every floating layer.** The sidebar, top-bar capsules, composer, panels, drawers,
  sheets and map overlays are Liquid Glass on the `--ambient` ground. Follow [glass.md](glass.md)
  exactly, including its fallbacks, and never nest glass in glass.
- **Fills inside.** Inside a glass layer, group with spacing and `--fill-hover` / `--fill-press`
  rows rather than new cards or borders. `--shadow-sm` for small raised controls, `--shadow-md` for
  menus, `--shadow-lg` for sheets and drawers.
- **Concentric radii.** A nested rounded surface uses outer radius = inner radius + padding. Pick the
  pair from `--radius-sm`, `--radius`, `--radius-lg`, `--radius-xl` and `--radius-pill` (floating
  panels `xl`, cards `lg`, rows and fields default, buttons, chips and segmented controls `pill`). Keep the tokens even when the arithmetic is off by a pixel or two.
- **Optical alignment.** A button with a trailing icon takes about 2 px less padding on the icon
  side. Fix an off-centre glyph in its SVG, not with margins.

## Motion

- **Timing comes from tokens.** State changes use `--transition` (160 ms). Arrivals use
  `--ease-spring`, settles `--ease-out`, with `--duration-fast`, `--duration` and `--duration-slow`.
  Drawers use `--drawer-duration` (380 ms) and `--drawer-ease`. The project has no motion library,
  so do not add one for polish.
- **Use the helpers in `components/ui/motion.ts`.** Swapping a whole region goes through
  `viewTransition`; a segmented control gets the `segmented` class and `useSegmentIndicator`; a
  layer that should animate out uses `usePresence` and is inert and `aria-hidden` while leaving. All
  three are no-ops under reduced motion or in jsdom.
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
- **Press feedback.** Buttons give `scale: 0.97` on `:active` (in `forms.css`). Dense lists, fact
  chips and calendar cells opt out there.
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
