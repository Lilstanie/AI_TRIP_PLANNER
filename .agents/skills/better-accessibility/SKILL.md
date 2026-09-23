---
name: better-accessibility
description: Use when building or reviewing anything interactive in apps/web of AI_TRIP_PLANNER — buttons, drawers, dialogs, menus, forms, live planning status, map controls or motion — to keep keyboard, focus, screen-reader, contrast and reduced-motion behaviour working.
---

# Accessibility

Most accessibility comes free from the platform: native elements bring keyboard support, real labels
announce themselves, and one CSS rule gives a visible focus ring. This workspace already implements a
lot of it, and [workspace-ui.md](../../../docs/workspace-ui.md) records the behaviour as it stands.
Keep that behaviour. The most common regression here is a new control that skips a pattern its
neighbours already follow.

A review makes two passes. First keyboard only: every flow completes without a mouse. Then screen
reader: every control announces a name, a role and its state. When unsure, take the platform default
over a custom rebuild, and remove ARIA rather than add it.

## What already exists — reuse it

- **Drawers and dialogs.** `components/ui/Drawer.tsx` provides `role="dialog"`, `aria-modal`,
  `inert` when closed, a Tab loop, Escape, and focus return to the trigger.
  `components/ui/Dialog.tsx` wraps a native `<dialog>` opened with `showModal()`, so the browser
  supplies the trap and Escape, and the component restores focus on close.
  `components/preferences/FactPopover.tsx` is the anchored editor under a top-bar chip (a bottom
  sheet at ≤520 px): a labelled `role="dialog"` with a Tab loop, Escape that yields to an open
  native dialog, and dismissal on an outside press. Build new overlays on these three rather than
  writing another focus trap.
- **Menus and splitters.** The conversation overflow menu (`role="menu"`, Escape returns focus
  without closing the enclosing drawer) and the sidebar `role="separator"` resizer are the reference
  patterns. Copy their keyboard handling for similar widgets.
- **Focus ring.** `apps/web/app/styles/base.css` gives every interactive element one ring through
  `box-shadow: var(--ring)` with `outline: none`. Use that rule and do not style focus per component.
  Forced-colors mode (Windows High Contrast) drops box shadows. When you change the ring, keep a
  `2px solid transparent` outline beside the shadow so the system colour can still draw it.
- **Reduced motion.** `base.css` has a global `prefers-reduced-motion: reduce` switch, and each
  stylesheet with its own animation adds a `reduce` block. Follow that pattern. Do not convert the
  codebase to opt-in `no-preference` blocks.
- **Contrast and status colour.** The rules live in the
  [design contract](../../../docs/design/ui-guidelines.md). Body text meets WCAG AA on its surface,
  and colour is never the only status signal. Source badges and warnings carry text or a shape.
- **Glass surfaces.** Text on glass must pass AA against the busiest backdrop behind it. Glass must
  turn opaque under `prefers-reduced-transparency` and `prefers-contrast: more`. See the
  [glass recipe](../better-ui/glass.md).

## Rules that keep coming up

- **Native elements first.** Use `<button>` for actions and `<a href>` for navigation, never
  `<div onClick>`. See [semantics-and-aria.md](semantics-and-aria.md).
- **Keyboard path for every pointer action**, including map interactions. A marker or place that
  opens detail on click also needs a focusable equivalent in the place list. Escape closes the
  overlay that opened last. See [focus-and-keyboard.md](focus-and-keyboard.md).
- **Hit areas.** At least 24×24 CSS px (WCAG 2.5.8). Aim for 40px on desktop and 44px on phones where
  the density allows. Collapsed sidebar icons and map controls are the usual offenders. See
  [hit-areas.md](hit-areas.md).
- **Label every control.** A placeholder is never a label. The top-bar fact editors use real labels, and
  new fields do too. See [forms.md](forms.md).
- **Accessible names.** Icon-only buttons need an `aria-label` that contains any visible text.
  Buttons that shrink to icons at ≤520 px keep their names.
- **Announce streaming and planning progress politely.** Use a stable `role="status"` region that
  exists before its text changes. Reserve `role="alert"` for urgent failures that no control owns.
  Never announce every streamed token. See [screen-readers.md](screen-readers.md).
- **Place photos.** Use the place name as alt text, or `alt=""` when the name is visible beside the
  photo. A photo carousel needs labelled previous and next buttons, and its keyboard path must not
  trap Tab.
- **Survive zoom and reflow.** Test at 200% zoom and 320 px width. The map is 2D content and may
  scroll inside its own box. The page must not scroll sideways. See
  [motion-and-zoom.md](motion-and-zoom.md).

The reference files are generic web guidance. Where one of them gives a value or a token name
(`--focus-ring`, opt-in motion) that disagrees with the project facts above, the project wins.

## Verify

Walk the keyboard path in the running app. Read names and roles with the browser's accessibility
tree (`read_page`). Then follow the [ui-verification skill](../ui-verification/SKILL.md) for the
widths and evidence. List every check you could not run as `Not verified`.

## Reporting

Order findings by severity, one row per root cause listing every place it appears:

| Severity | Location | Before | After | Why |
| -------- | -------- | ------ | ----- | --- |

- `HIGH`: blocks a task, hides content from assistive technology, or fails systemically.
- `MEDIUM`: makes an interaction meaningfully harder.
- `LOW`: isolated polish.

In a pull request review, these findings join the [code-review](../code-review/SKILL.md) output
rather than forming a separate verdict.
