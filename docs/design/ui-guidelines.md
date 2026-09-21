# Cartographer Workspace Design Contract

## Overview

The workspace is a cartographer's field desk: the map is the working ground, panels are layered paper, and tools remain close without competing with the plan. This is achieved with surfaces, hairlines, restrained shadows, and whitespace—not textures, filters, or decorative assets.

## UI Reference Resources

The following sites are reference sources for interaction patterns, motion, components, and visual
direction. They inform implementation choices but do not replace the project's own accessibility,
semantic-token, or workspace-layout contracts.

- [Beautiful UI](https://beautifului.dev)
- [BeUI](https://beui.dev)
- [Rare UI](https://rareui.com)
- [Transitions](https://transitions.dev)
- [shadcn/ui](https://ui.shadcn.com)

External source code may only be copied under the source's current license. Use public/free BeUI
components unless a matching Pro license is available; preserve required MIT notices, and do not
redistribute an external library as a competing component kit.

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

The existing workspace grid is fixed: sidebar, chat, and map; overlay drawers preserve that working area. Keep its current responsive breakpoints, sidebar resizing, drawer directions, and narrow-screen Chat/Map switch.

Spacing uses `--space-1` through `--space-5`. Do not introduce parallel spacing values where these tokens fit.

## Elevation & Depth

Normal panels separate with `--surface`, `--surface-2`, and `--border`. Use `--shadow-sm` sparingly for small raised controls; reserve `--shadow-md` for drawers and map overlays. No glass effects, noise, paper textures, or simulated curled edges.

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
4. Use glassmorphism, neon, texture images, noise filters, photography, or illustrations.
5. Stack cards inside cards when surface, spacing, and a hairline communicate the grouping.
