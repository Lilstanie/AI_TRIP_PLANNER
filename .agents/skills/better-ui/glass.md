# Liquid Glass surfaces

A translucent, blurred, lightly saturated material with a bright specular rim, like Liquid Glass in
iOS 26. The [design contract](../../../docs/design/ui-guidelines.md) says where it goes, and the
[Liquid Glass Agent Note](../../notes/implemented/feature/2026-09-25-liquid-glass-workspace.md)
records why. This file is the implementation recipe; `apps/web/app/styles/glass.css` applies it.

## Where it goes

| Glass (regular fill)                                                              | Glass (strong fill, dense text)                                | Not glass                                                         |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| Sidebar, Chats panel, top-bar capsules, segmented tracks in the top bar, composer | Drawers, trip fact sheets, native dialogs, the map place popup | Menus, tooltips and suggestion lists (they sit inside glass)      |
| Empty-state cards, notices, map controls and status, trip-card captions, calendar | The question card                                              | Segmented tracks inside drawers (fills), chat messages, form rows |

To add a surface, put its selector in the right list in `glass.css` and in both fallback blocks.
Never nest one glass layer inside another.

## Tokens

All values live in `apps/web/app/styles/tokens.css` with light and dark values; never inline them.

| Token                              | Role                                                        |
| ---------------------------------- | ----------------------------------------------------------- |
| `--glass-bg` / `--glass-bg-strong` | Fill; the strong one for layers that carry dense text       |
| `--glass-border`                   | 1 px bright rim                                             |
| `--glass-edge`                     | 0.5 px dark outline so the rim reads on white               |
| `--glass-highlight`                | Inset specular highlights (top and bottom edge, inner glow) |
| `--glass-shadow`                   | Soft wide drop shadow                                       |
| `--glass-blur`, `--glass-saturate` | Backdrop blur radius and saturation                         |
| `--ambient`                        | The coloured wash under the glass; never carries content    |

## Recipe

```css
.surface {
  --glass-fill: var(--glass-bg); /* or var(--glass-bg-strong) */
  border: 1px solid var(--glass-border);
  background: var(--glass-fill);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  box-shadow:
    var(--glass-highlight),
    0 0 0 0.5px var(--glass-edge),
    var(--glass-shadow);
}
/* Optional sheen for large panels: a ::before with z-index: -1 and a diagonal white gradient.
   The backdrop-filter makes the surface a stacking context, so the sheen sits above the fill
   and below the content. */
```

Fallbacks, all already in `glass.css`: without `backdrop-filter` the fill becomes `--surface`;
under `prefers-reduced-transparency: reduce` or `prefers-contrast: more` the blur, the sheen and
the ambient wash go and the border becomes `--border`; in forced-colors mode the surface is `Canvas`
with a `CanvasText` border.

- **Contrast.** Check text and icons against the busiest backdrop they can sit on: dense map
  labels and dark-theme tiles. When text fails WCAG AA, make the fill more opaque or move the layer
  to `--glass-bg-strong`. Never fix it with a text shadow.
- **Performance.** `backdrop-filter` repaints whenever the content behind it moves, which on the map
  is every pan. Never animate the blur radius; fade glass with `opacity`. Check that panning the map
  stays smooth at phone width after adding a layer.
- **Still banned.** Neon, noise, texture images, SVG refraction or distortion effects, decorative
  photography, illustrations, and glass on glass.
