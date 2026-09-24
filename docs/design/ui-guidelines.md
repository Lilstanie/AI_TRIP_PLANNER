# Cartographer Workspace Design Contract

## Overview

The workspace is a cartographer's field desk: the map is the working ground, panels are layered paper, and tools remain close without competing with the plan. This is achieved with surfaces, hairlines, restrained shadows, and whitespace—not textures, filters, or decorative assets. Photos of the places themselves are content, not decoration.

## UI Reference Resources

The following sites are reference sources for interaction patterns, motion, components, and visual
direction. They inform implementation choices but do not replace the project's own accessibility,
semantic-token, or workspace-layout contracts.

- [Beautiful UI](https://beautifului.dev)
- [BeUI](https://beui.dev)
- [Rare UI](https://rareui.com)
- [Transitions](https://transitions.dev)
- [shadcn/ui](https://ui.shadcn.com)
- [Aceternity UI](https://ui.aceternity.com): a landing-page effects library. Use it for restrained
  micro-interactions such as tooltips and text reveals. Do not take its beams, aurora and gradient
  backgrounds, glows, 3D cards or parallax: they break the Don'ts below and the reduced-motion
  contract. Its components depend on Framer Motion, which this project does not use; port the effect
  to CSS rather than adding the dependency.
- [Mindtrip](https://mindtrip.ai): an AI travel planner, and the closest product to this one. Its
  interaction design is the primary reference for:
  - **Places inline in answers.** A place mention carries a category icon and the place name.
    Hovering it opens a preview with photos, address and a one-line description; clicking it opens
    the full place detail.
  - **Save from where it appears.** An answer ends with photo cards of the places it mentioned, and
    each card has save and add-to-trip toggles.
  - **The map mirrors the conversation.** Every mentioned place is a marker, and nearby markers
    cluster with a count.
  - **Place detail.** The detail view has sections (overview, stays, food, things to do, reviews),
    local weather, and a "you might want to ask" list of follow-up questions that start a chat turn.
  - **The trip plan.** It keeps an Ideas bucket apart from the day-by-day itinerary. Each stop shows a
    time range and a thumbnail, with the distance between stops and a booking link where one exists.
  - **Follow-up suggestion chips** appear above the composer.
  - **Trip facts in the top bar.** Destination, dates, travellers and budget are chips, each
    opening an editor for that fact alone, and a Preferences chip holds the traveller's own
    preference list. Where and Trip preferences open centred over a scrim, as Mindtrip's do; the
    single-value editors anchor under their chip; all of them are bottom sheets on phones. See the
    [preference chips Agent Note](../../.agents/notes/implemented/feature/2026-09-24-preference-chips.md)
    and the [trip preference list Agent Note](../../.agents/notes/implemented/feature/2026-09-24-trip-preference-list.md).

  Fit these into this workspace's fixed regions. For example, place detail opens in a drawer or map
  overlay instead of replacing the map column. Borrow the interactions, not the brand: Mindtrip's
  assets, copy and brand styling may not be reused.

External source code may only be copied under the source's current license. Use public/free BeUI
and Aceternity UI components unless a matching Pro license is available; preserve required MIT
notices, and do not redistribute an external library as a competing component kit.

## Colors

Use the semantic tokens in `apps/web/app/globals.css` as the only color contract:

- `--page`, `--surface`, and `--surface-2` establish the paper hierarchy.
- `--text`, `--text-dim`, and `--text-mut` establish ink hierarchy; body and important supporting text must meet WCAG AA contrast on their surface.
- `--border` is the 1px hairline between regions.
- `--accent` and `--accent-bg` identify the primary action or current state.
- `--ok`/`--ok-bg` and `--warn`/`--warn-bg` communicate status alongside text or a shape; color is never the only status signal.

Both light and dark token values are required. Native controls must follow the active system theme, and focus rings must remain visible.

## Typography

Body copy, controls, navigation, forms, and status labels use the system sans stack. The display font is reserved for destination names, Trip titles, and empty-state primary headings. It always declares serif fallbacks so mixed Chinese and Latin titles remain usable when the display font is unavailable.

## Layout

The existing workspace grid is fixed: sidebar, chat, and map; overlay drawers preserve that working area. Keep its current responsive breakpoints, sidebar resizing, drawer directions, and narrow-screen Chat/Map switch. Trip preferences are edited from the top bar's fact chips rather than a drawer, at the owner's request.

Spacing uses `--space-1` through `--space-5`. Do not introduce parallel spacing values where these tokens fit.

## Elevation & Depth

Normal panels separate with `--surface`, `--surface-2`, and `--border`. Use `--shadow-sm` sparingly for small raised controls; reserve `--shadow-md` for drawers and map overlays. No noise, paper textures, or simulated curled edges.

### Glass

Glass is a translucent, blurred material in the spirit of iOS materials. It belongs to the **control layer only**, meaning chrome that floats over moving or varied content: map overlays, the top bar over scrolling content, popovers, menus, and tooltips. The content layer stays opaque paper: the chat stream, the composer field, drawer bodies, cards, and dialogs with forms. Glass on glass is not allowed.

- Glass values come only from semantic tokens in `tokens.css` (`--glass-bg`, `--glass-border`, `--glass-highlight`, `--glass-blur`), with light and dark values. No surface uses glass yet; the first change that does adds these tokens. Glass keeps a 1px hairline.
- Text and icons on glass meet WCAG AA against the busiest backdrop they can cover. When they fail, raise the fill opacity rather than adding text shadows.
- Glass falls back to `--surface` when `backdrop-filter` is unsupported, under `prefers-reduced-transparency: reduce` or `prefers-contrast: more`, and to system colours in forced-colors mode.

The implementation recipe is the [better-ui glass reference](../../.agents/skills/better-ui/glass.md). The [glass Agent Note](../../.agents/notes/implemented/feature/2026-09-24-glass-control-layer.md) explains why glass is limited to the control layer.

### Place photos

Photos are allowed only as **content about a specific place**, and only when they come from that place's data provider (Google Places). They may appear in place cards, place previews and place detail, as itinerary and place-list thumbnails, and as photo markers on the map. They are never decorative: no hero banners, no page or panel backgrounds, no stock or generated imagery.

- Show the attribution the provider's terms require, such as Google's author attributions for a place photo. Persist only the place ID. Never store photo names or image bytes, because Google forbids caching photo names and they expire; fetch the names fresh from a Places response each time photos are shown.
- Every photo slot has a fixed aspect ratio so nothing shifts while images load. It loads lazily, and without a photo it shows the place's category icon on `--surface-2`.
- Photos use the radius of their container and a 1px inner hairline (`--border`). Text never sits directly on a photo; captions sit below it or on a glass or opaque chip.
- Alt text is the place name, or empty when the name is visible next to the photo.
- Photo requests count against provider quota and follow the provider rules in the [add-provider skill](../../.agents/skills/add-provider/SKILL.md). Mock mode serves the fallback state, never a network photo.

The [place photos Agent Note](../../.agents/notes/implemented/feature/2026-09-24-place-photos.md) explains the scope. The map's place preview is the first surface that shows them.

## Shapes

Panels and drawers use `--radius-lg`; controls use `--radius-sm` or `--radius`; chips use `--radius-pill`. Hairlines remain 1px.

## Components

- **Sidebar and topbar:** compact navigation and tools, with current state expressed by more than color.
- **Chat bubbles and planning progress:** readable annotations with system typography and clear textual status.
- **Decision cards:** preserve existing semantic actions and focus behavior.
- **Map markers and place list:** the map remains the canvas; controls are restrained overlays.
- **Drawers, timeline rows, budget bars, and preference fields:** use surface and hairline grouping before adding elevation.

## Do's and Don'ts

Do use semantic tokens, clear type hierarchy, visible focus, and text or shape in addition to status color.

Do not:

1. Change the three-column workspace, drawer behavior, or responsive model for visual work.
2. Replace the workspace with a full UI-library redesign. Tailwind v4 and source-owned shadcn
   primitives are allowed as implementation tools, but they must use the semantic tokens above and
   must not replace the workspace layout, focus behavior, or accessibility contract.
3. Turn the interface into a full-screen beige or retro skin.
4. Use neon, texture images, noise filters, decorative photography, or illustrations, put glass on the content layer, or show photos other than provider place photos as described above.
5. Stack cards inside cards when surface, spacing, and a hairline communicate the grouping.
