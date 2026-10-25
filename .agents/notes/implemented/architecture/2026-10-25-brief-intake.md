# Agent Note: One brief intake gate owns planning readiness

Status: implemented
Owner: C — HeadmasterEggy

## Problem

Plan submissions, model tools and offline extraction repeated brief merging and readiness checks.
The model could finish recording a complete brief without planning, while historical confirmation
was inferred from exact assistant prose. Rewording a question changed authorization behavior.

## Decision

`BriefIntake` owns patch normalization and the ready, incomplete, ambiguous-destination and
historical-date outcomes. Entry adapters supply patches; every planning attempt uses the same gate.
Explicit dates and traveller counts override extracted values, inclusive duration is applied once,
and memory-off excludes learned preferences.

`ChatTurn` adds optional `pendingBriefConfirmation` with kind `historical_dates` and a real date pair.
A separate optional `confirmedBriefDestination` preserves an accepted full place name across later
answers, including missing-field questions. English and Chinese UI answer headers are accepted.
Changing the destination clears that acceptance; an existing plan preserves its accepted name.
Only the latest assistant turn can authorize an explicit historical confirmation for those dates.
The server writes this metadata when asking; clients and models cannot submit it as request state.
Old turns remain readable. Text-only historical questions ask again instead of guessing from prose.

The [destination location decision](2026-10-17-destination-location-context.md) remains in force:
matching selected-place coordinates determine the local calendar; UTC is the fallback, and existing
historical plans remain editable. This note adds intake ownership and confirmation state without
superseding that decision. Other historical-date note matches concern weather or review processes.

## Alternatives considered

- Keep checks at each call site: rejected because the same readiness rule repeatedly drifted.
- Match question text or accept an unprompted confirmation: rejected because copy changes and stale
  dates could silently alter permission to plan.
- Add client-owned confirmation flags: rejected because the server already owns conversation memory
  and can bind a confirmation to the exact dates it asked about.

## Consequences

The additive shared field requires no memory migration or HTTP response change. Legacy questions
need one fresh prompt. Restarting a server without persisted conversation memory also asks again.
Public-entry scenarios cover the gate through each adapter; the HTTP journey covers streamed
clarification and a plan-to-chat confirmation using persisted server memory.
