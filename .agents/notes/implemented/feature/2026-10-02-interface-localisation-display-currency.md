# Agent Note: Localise the workspace and convert display currency at the UI boundary

Status: implemented

## Problem

The workspace UI was fixed to English and exposed AUD as a read-only region setting. Travellers who
read Chinese or think in another currency could chat in their language, but the surrounding controls
and budget editor did not follow them. Changing the planning currency would also weaken the existing
single-currency budget checks.

## Decision

- `UserSettings` stores an English or Simplified Chinese interface language and an AUD, USD, CNY or
  destination-local display-currency preference. Both fields are defaulted, so version 1 settings
  saved before this feature still parse and sync.
- `LocaleProvider` applies the document language and supplies translated workspace copy, accessible
  names, destination-aware currency resolution and formatting to visible components.
- The top bar exposes the persisted language as a one-press English/Chinese switch beside the data
  mode control; Settings remains the detailed language and region surface.
- Every plan, draft and agent continues to store, compare and send money in AUD. The budget editor
  converts a displayed amount back to AUD before writing `Draft.budgetTotal`; visible plan totals
  convert from AUD at render time.
- Destination-local mode uses a conservative destination-name table. An unknown or blank
  destination falls back to AUD. Rates are dated, rounded planning estimates in
  `apps/web/lib/i18n/locale.ts`, not live quotes, and Settings says so.

## Alternatives considered

- **Change the shared planning currency.** Rejected because every specialist, persisted plan and
  budget guardrail relies on the AUD base-currency contract.
- **Keep display currency local to one filter panel.** Rejected because totals would disagree across
  the fact chip, budget editor and trip details, and account sync would lose the preference.
- **Fetch live exchange rates.** Deferred because it adds a provider, cache, failure mode and
  freshness contract for a presentation feature; approximate planning rates match the existing
  budget-conversion boundary.

## Consequences

- Language and display currency survive reloads and signed-in settings sync without a schema-version
  migration.
- Destination inference is deliberately incomplete and must fall back safely; new destinations or
  stale rates require an explicit table update.
- Converted figures are suitable for trip sizing, not payment, booking or financial decisions.

## Sources

- [AUD base-currency note](../architecture/2026-09-20-aud-base-currency.md)
- [Mindtrip settings note](2026-09-27-mindtrip-settings.md)
- [Workspace UI](../../../../docs/workspace-ui.md)
