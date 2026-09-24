# Agent Note: Liquid Glass workspace and view transitions

Status: implemented
Owner: repository owner (@HeadmasterEggy)

## Problem

The repository owner asked for the whole interface to look and move like Apple's latest iOS design,
naming Liquid Glass (液态玻璃) explicitly, and for switches between parts of the workspace to be
smoother. The [archived control-layer glass note](../../archived/feature/2026-09-24-glass-control-layer.md)
limited glass to map overlays and small chrome and kept every other surface opaque paper. Region
swaps (another chat, the Your trips page, the phone Chat/Map switch) cut instantly, tab lists had a
jumping underline, and dialogs, the drawer backdrop and menus vanished without an exit.

## Decision

**Material.** Every floating layer is Liquid Glass: the sidebar (a floating rounded column), the
Chats panel, the top-bar capsules (fact chips, data mode, Trip, menu), segmented controls, the
composer, empty-state cards, notices, map overlays, drawers, the trip fact sheets, native dialogs,
trip-card captions and the trip calendar. Chat messages, drawer rows and form fields sit on those
layers, not on glass of their own. The page under them is `--ambient`, a soft wash of system colours
that never carries content. Glass values are tokens in `apps/web/app/styles/tokens.css`
(`--glass-bg`, `--glass-bg-strong`, `--glass-border`, `--glass-edge`, `--glass-highlight`,
`--glass-shadow`, `--glass-blur`, `--glass-saturate`); `apps/web/app/styles/glass.css` applies them.
Layers that carry dense text (drawers, fact sheets, dialogs, the place popup, the question card) use
`--glass-bg-strong` so reading never depends on the backdrop. Glass still falls back to `--surface`
without `backdrop-filter`, under `prefers-reduced-transparency: reduce` or `prefers-contrast: more`,
and to system colours in forced-colors mode.

**Look.** System type (SF Pro Text and Display, PingFang for CJK) replaces the Fraunces serif, which
also removes a Google Fonts request. The palette follows iOS: grouped grey page, white surfaces,
Apple blue (`--accent` for text, `--accent-fill` behind white text, which stays AA in dark mode).
Radii grow to 8/12/18 with a 26 px `--radius-xl` for floating panels; buttons are capsules on quiet
`--fill-hover` fills; the traveller's messages are blue bubbles.

**Motion.** `apps/web/components/ui/motion.ts` adds three helpers, with no library: `viewTransition`
wraps region swaps in the View Transitions API (the main column cross-fades and rises; the phone
Chat/Map switch slides), `useSegmentIndicator` drives a sliding thumb for segmented controls (Your
trips tabs, the Trip drawer tabs, Chat/Map), and `usePresence` keeps a closing layer mounted long
enough to play its exit (the fact sheets and the drawer backdrop). All three do nothing under
`prefers-reduced-motion` or where the platform lacks the API, so behaviour and tests are unchanged
there. Timing is tokenised in `motion.css`: `--ease-out`, `--ease-spring` (a `linear()` spring with a
cubic fallback), `--duration-*`, and a 380 ms iOS sheet curve for drawers.

## Alternatives considered

**Keep glass on the control layer only.** Rejected by the repository owner, who asked for Liquid
Glass across the interface.

**A motion library (Framer Motion).** Rejected. CSS transitions, keyframes and the View Transitions
API cover every transition here, stay interruptible, and add no bundle weight.

**SVG refraction filters to imitate Liquid Glass lensing.** Rejected for the same reasons as before:
uneven browser support and repaint cost over a live map. Blur, saturation and a specular rim deliver
the material.

## Consequences

- Glass on glass is still avoided: menus, tooltips and suggestion lists inside a glass layer are
  opaque, and segmented tracks inside drawers are fills, not glass.
- Many `backdrop-filter` layers repaint when the map pans; check panning stays smooth at phone
  width when adding another one.
- `apps/web/tests/e2e/liquid-glass.e2e.mjs` walks every surface in light and dark at desktop and
  phone widths and leaves screenshots and a video under `output/playwright/liquid-glass/`.
- Neon, noise, texture images, decorative photography and illustrations remain banned.
