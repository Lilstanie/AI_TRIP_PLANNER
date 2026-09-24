# Glass surfaces

A translucent, blurred material for the **control layer**: chrome that floats over moving or varied
content, like the materials in iOS. The [design contract](../../../docs/design/ui-guidelines.md)
decides where glass is allowed, and the
[glass Agent Note](../../notes/implemented/feature/2026-09-24-glass-control-layer.md) records why.
This file is the implementation recipe.

## Where it goes

| Glass (control layer)                                                                                  | Opaque paper (content layer)                          |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Map overlays: `.trip-map-controls`, `.trip-map-popup`, `.trip-map-location-status`, `.trip-map-status` | The chat stream, messages and the composer field      |
| The top bar, once content scrolls beneath it                                                           | Drawer bodies: the trip timeline, budget, preferences |
| Popovers, menus and tooltips                                                                           | Cards, decision cards and dialogs with forms          |

The test is what sits behind the surface. Glass is for chrome over content that moves or varies,
such as the map or a scrolling list. Wherever someone reads or edits dense text for long, keep the
surface opaque.

## Tokens

Glass values are semantic tokens in `apps/web/app/styles/tokens.css`, with light and dark values.
They never appear inline in a component. The first change that ships glass adds these starting
values, then adjusts them after checking contrast over the map:

```css
:root {
  --glass-bg: rgb(255 255 255 / 72%);
  --glass-border: rgb(255 255 255 / 55%);
  --glass-highlight: inset 0 1px 0 rgb(255 255 255 / 60%);
  --glass-blur: 16px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --glass-bg: rgb(23 23 27 / 68%);
    --glass-border: rgb(255 255 255 / 10%);
    --glass-highlight: inset 0 1px 0 rgb(255 255 255 / 8%);
  }
}
```

## Recipe

```css
.glass {
  background: var(--glass-bg);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(180%);
  backdrop-filter: blur(var(--glass-blur)) saturate(180%);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-highlight), var(--shadow-sm);
}

/* Browsers without backdrop-filter, and people who asked for less transparency or more
   contrast, get the ordinary paper surface. */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass {
    background: var(--surface);
  }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .glass {
    background: var(--surface);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    border-color: var(--border);
  }
}
@media (forced-colors: active) {
  .glass {
    background: Canvas;
    backdrop-filter: none;
    border-color: CanvasText;
  }
}
```

- **Contrast.** Check text and icons against the busiest backdrop they can sit on: dense map
  labels, satellite-like colour and dark-theme tiles. When text fails WCAG AA, make `--glass-bg`
  more opaque. Never fix it with a text shadow.
- **One layer only.** Never put glass on glass. A blurred surface behind another blurred surface
  looks muddy and doubles the rendering cost.
- **Performance.** `backdrop-filter` repaints whenever the content behind it moves, which on the map
  is every pan. Keep glass surfaces small, never animate the blur radius, and fade glass in and out
  with `opacity`. Check that panning the map stays smooth on a phone-width viewport.
- **Still banned.** Neon, noise, texture images, refraction or distortion effects, decorative photography,
  illustrations, and glass on the content layer.
