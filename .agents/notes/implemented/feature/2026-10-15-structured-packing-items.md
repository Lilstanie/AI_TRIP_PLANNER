# Agent Note: Structured packing list on proposal items

Status: implemented
Owner: Claude Haiku 5.5 (/implement, approved by the user for #352)

## Problem

The destination guide joined its packing list into one `detail` string ("... Pack: a, b, c."). The travel tips panel shows that string as one paragraph, so the items run together. Issue #352 asks for a readable list, which needs the items as data rather than prose.

## Decision

`ProposalItem` in `packages/shared/src/contracts.ts` gains an optional `packing: string[]`. The destination-guide agent sets it on its `weather-packing` item and keeps `detail` to the weather summary. Other items are unchanged. `TripTips` renders `packing` as a list under the weather text.

The field is optional, so stored plans written before this change still parse. `detail` no longer carries the packing list, so any consumer that read "Pack:" from `detail` must read `packing` instead.

## Alternatives considered

- Keep the joined string and split it in the UI: rejected. Splitting prose on commas and periods is fragile, and it repeats the bug #351 fixed.
- Add a new item kind for packing: rejected. It would break the existing `weather-packing` kind that the tips panel and tests already key on.

## Consequences

- `packages/shared` changed, so this note and `contract-impact: packages/shared` in the session log are required.
- The weather-provider E2E expectation now checks `detail` for the weather text alone and `packing` for the four items.
