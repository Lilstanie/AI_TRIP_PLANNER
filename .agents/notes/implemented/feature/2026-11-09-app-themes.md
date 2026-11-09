# Agent Note: App themes and accent colours

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

On 2026-11-09 the owner asked for more themes. The workspace had one palette with a light and a dark
set, chosen by the System, Light or Dark appearance. Adding a palette meant repeating every dark value
under both `@media (prefers-color-scheme: dark)` and `[data-theme="dark"]`, and the iOS shell
overrides glass tokens with selectors that would beat a plain theme selector.

## Decision

- Settings stores two optional fields, `theme` (`default`, `island`, `sunset`, `forest`,
  `city-night`, `oled`, `contrast`) and `accent` (`theme`, `blue`, `green`, `orange`, `purple`,
  `pink`). Absent fields mean the defaults, so settings saved before this change still validate and do
  not trigger a sync write.
- `lib/account/theme.ts` resolves the scheme and writes `data-scheme` (always), `data-theme` (only when
  forced), `data-palette` and `data-accent` on `<html>`. The inline script in `app/layout.tsx` does the
  same before the first paint; `SettingsProvider` reapplies it in a layout effect, so the map reads the
  new colours in the same commit, and on system scheme changes.
- `app/styles/themes.css` keys every rule on `[data-scheme]`, so each theme writes one light and one
  dark block instead of two dark copies. City night and OLED black are dark-only; the resolver forces
  dark for them and Settings hides the appearance choice.
- Rules use `:root[data-palette][data-scheme]` (and the same for accents, placed later), which beats
  the default dark tokens and the iOS shell's glass values without `!important`.
- High contrast is a theme that sets the glass tokens to the solid surface with no blur, rather than a
  second selector list in `glass.css`.

## Alternatives considered

- `light-dark()` colour values: one declaration per token, but unsupported before Safari 17.5 and the
  iOS app targets iOS 15, where every token would become invalid.
- Always writing the resolved scheme into `data-theme`: changes what `data-theme` means for existing
  CSS and tests (absent means follow the system), so a separate `data-scheme` was added instead.
- High contrast as its own switch: the reduced-transparency fallback already exists as a media query;
  expressing it through tokens keeps one place to change and lets it combine with any accent.

## Consequences

- A new theme is one light and one dark block in `themes.css`, a label in the two message files and a
  swatch in `settings.css`; the `themes` E2E checks WCAG AA for every theme in both schemes.
- The map basemap style is unchanged by themes; only route and marker colours, which read tokens,
  follow them. The native iOS tab bar keeps the system tint.
- See [Themes](../../../../docs/design/ui-guidelines.md#themes) and the
  [Liquid Glass note](2026-09-25-liquid-glass-workspace.md).
