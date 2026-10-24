# Agent Note: The shared stay detail counts rooms and nights in words

Status: implemented

## Problem

`describeStayChoice` in `packages/shared/src/describe.ts` wrote every stay price detail as
"1 room(s) × 3 night(s) × AUD 230.00 per room/night". #626 removed every other "(s)" placeholder
from the English specialist copy, so this sentence was the last one left in the plan stream. It is
built by the accommodation agent and again by `applyTripEdit` when a traveller picks another stay.

## Decision

`describeStayChoice` writes "1 room" or "2 rooms" and "1 night" or "3 nights". The rest of the
sentence keeps its wording and order. The Agent Lab fixture stays in `paris-family.ts` and
`tokyo-kyoto.ts` use the same wording. `@trip/shared` cannot import the agents' `plural()` helper,
so the function counts with a local one-line helper.

## Alternatives considered

- Leave the sentence as it was, because the file is a protected shared contract. Joey approved the
  change on 2026-10-24.

## Consequences

- Anything that reads the night count from this text must accept "night" and "nights". The Agent Lab
  evaluator and its E2E already match `\b(\d+) nights?\b`.
- Stored plans keep whatever detail they were saved with. Only new plans and stay changes use the
  new wording.
