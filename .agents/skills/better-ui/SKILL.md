---
name: better-ui
description: Polish the visual details of apps/web in AI_TRIP_PLANNER so changes follow the Liquid Glass design contract and its tokens instead of ad hoc values. Use when working on radii, surfaces, shadows, glass, place photos, icons, hover and press feedback or transitions.
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
  sheets and map overlays are Liquid Glass on the `--ambient` ground. Follow [glass.md](references/glass.md)
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
  Drawers use `--drawer-duration` (450 ms) and `--drawer-ease`. The project has no motion library,
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
  [performance.md](references/performance.md).
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
- **Google:** when there is no photo or loading fails, retain the category-icon fallback on
  `--surface-2`.
- **OpenStreetMap:** show an optional Commons photo only when its author, license and license link
  are available. Without a licensed image, or after an image load failure, omit the entire photo
  slot; do not reserve an empty box or reuse Google's icon fallback.
- Show Google's required author attribution. For Commons, preserve the author, readable license
  and clickable license link beside the image, including long credits that wrap.
- Never place text directly on the image.

Photos remain transient Web provider data: never persist photo names, image URLs, bytes or the
full provider payload in a saved trip. The existing `savedPlace` snapshot contains only name,
address and coordinates for outage recovery. Google's photo names are fetched fresh from Places.
See the [fallback review decision](../../notes/implemented/architecture/2026-10-10-map-fallback-review-fixes.md)
and `apps/web/components/map/PlacePreview.tsx`; route provider changes through
[add-provider](../add-provider/SKILL.md) and record the provider with browser evidence through
[ui-verification](../ui-verification/SKILL.md).

## Copy and labels

- **Let the layout explain.** Do not add a secondary label, description, slogan or helper line that
  repeats what the layout already shows. Generated screens add these by default; remove them rather
  than styling them.
- **Keep what assistive technology needs.** A form label or control's accessible name stays even when
  it is visually redundant, such as a visible "搜索" button beside a search field. Hide copy from
  the screen only with a method that keeps the accessible name.
- **Check before pushing.** `node .agents/skills/better-ui/scripts/check-ui-copy.mjs` lists helper-copy
  classes (`hint`, `helper`, `description`, `subtitle`, `caption`, `microcopy`, `tagline`, `eyebrow`,
  `lede`) that the branch adds under `apps/web/components` and `apps/web/app` compared with
  `origin/main`. It exits 1 on any hit not in [ui-copy-allowlist.txt](references/ui-copy-allowlist.txt), one
  `<path> <class>` pair per line. It reads only literal `className="..."` strings, so a class built in
  an expression is not seen.

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
