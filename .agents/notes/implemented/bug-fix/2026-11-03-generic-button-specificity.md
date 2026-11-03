# Agent Note: the generic button rule yields to component rules

Status: implemented
Owner: Joey, thread "Keep finding and fixing UI issues" (TP-318)

## Problem

`apps/web/app/styles/forms.css` gives every button a 36 px minimum height, a pill radius, a grey fill
and `6px 14px` padding. Its selectors were `button:not(.a):not(.b)…` chains. Each `:not()` adds the
specificity of its argument, so the rule weighed about forty classes and beat every single-class
component rule. Any button whose class was not on the list rendered as a grey pill, whatever its own
CSS said. The 2026-11-02 UI loop hit this five times (TP-293, TP-306, TP-307, TP-308, and the Agent Lab
buttons in TP-313). Earlier notes ([chat message actions](../feature/2026-10-25-chat-message-actions.md),
[desktop trajectory layout](../feature/2026-10-24-desktop-trajectory-layout.md)) worked around it the
same way, by listing or overriding classes.

## Decision

- Both generic rules are now `button:where(:not(.a, .b, …))`. `:where()` adds no specificity, so the
  rule weighs the same as `button` (0,0,1). It still comes after `base.css`, so it keeps setting the
  weight that `button { font: inherit }` resets, and any class rule overrides it.
- The exclusion lists stay as they were. Listed buttons keep receiving none of the generic styles,
  because some of them rely on having no background or padding at all.
- New components no longer need to be added to the list. They set what they design, and the generic
  pill fills in only what they leave out.
- `tests/styles/forms-button-specificity.test.ts` fails if a generic `button` rule in `forms.css` puts
  its `:not()` list outside `:where()`.

## Alternatives considered

- **Keep adding classes to the exclusion lists.** That was the practice until TP-313. It only fixes
  the buttons someone has already noticed.
- **Wrap the generic rules in `@layer`.** Everything else in the app is unlayered, so a layered rule
  would also lose to `base.css`'s `button { font: inherit }` and drop the 500 weight. `:where()` gets
  the same effect for component rules inside one selector.
- **Drop the exclusion lists as well.** Listed buttons would start receiving the grey fill and padding
  where their CSS sets neither, so that needs a per-class check and was left out.

## Consequences

A computed-style census of every visible button across 20 desktop and phone states (light, en) before
and after the change showed the following. Buttons that design their own height, weight, padding,
border or fill now show it, among them the Agent Lab view and secondary buttons (outlined surface
pills), the timeline "5 ideas" chip (outlined), "Day map" (8 px padding), the trip panel tabs
(32 px, weight 600) and the trip panel cards (with their border). Sidebar rows are 40 px instead of
38 px. Buttons without their own rules look as before.
