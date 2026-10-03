# Agent Note: Persisted English and Simplified Chinese interface language

Status: implemented
Owner: E (@WhW0591)

## Problem

The language setting is read-only and the interface stays in English. The team asks to extract
localisation from the closed combined PR #144 as a standalone additive web feature.

## Decision

UserSettings adds a defaulted language field. LocaleProvider supplies interface translation and
localized date/AUD formatting. The top-bar language button beside data mode and the Settings
language control update the same setting. Existing settings without the field load as English.
Traveller text and agent-generated replies stay unchanged. English is the fallback for strings
without a Chinese translation. No planning, shared contract, currency conversion, address format
or traveller-limit behavior changes. The sidebar/main gutter fix accompanies this UI feature.

This supplements [the settings layout](2026-09-27-mindtrip-settings.md); its other sections remain.

## Alternatives considered

- Keep language combined with currency, address and party changes: rejected by team review of #144.
- Translate generated replies or user text: not part of the requested interface-language feature.

## Consequences

Language persists locally and through the existing settings sync. Old settings retain defaults;
stored trips and demo intake remain compatible. Unmapped labels stay English rather than being
invented. Display currency, address UI and reverse lookup will be separate subsequent PRs.

## Sources

- [Team split request](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/144#issuecomment-5971820142)
