# Phone editing failure inventory

The seam is the real workspace UI using fixture planning and place providers. It proves visible
traveller actions, focus and retained fields; it does not prove physical keyboards or live providers.

- A changed Stop detail or note disappears on Escape, Cancel, outside dismissal or phone Back.
- A changed Brief disappears when closed, or changing tabs silently loses its fields.
- An unchanged form unnecessarily asks to discard.
- Continue editing loses the values or focus; Discard accidentally applies them.
- An asynchronous time/place application closes before failure and loses the editable values.
- The existing Plan Brief action hides that it starts replanning.
- Simple editors are trapped inline behind the phone keyboard or tab bar.
- A complex form or breakpoint transition makes the editor or Save unreachable.
- English and Chinese confirmation actions overflow or omit accessible names.

Evidence: `pnpm --filter @trip/web e2e phone-editing`; artifacts under
`output/playwright/phone-editing/<EVIDENCE_LABEL>/`.
