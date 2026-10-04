# Agent Note: Persisted English and Simplified Chinese interface language

Status: implemented
Owner: E (@WhW0591)

## Problem

The language setting is read-only and the interface stays in English. The team asks to extract
localisation from the closed combined PR #144 as a standalone additive web feature.

## Decision

UserSettings adds an optional `language` field (`en` | `zh`). Absent means follow the browser:
`zh*` opens in Chinese, anything else in English, read after hydration so the server render stays
English. A saved choice always wins. Existing settings without the field therefore still parse.
LocaleProvider supplies interface translation and localized date/AUD formatting, and sets
`<html lang>` to `zh-CN` or `en-AU`. `t()` accepts only keys of the Chinese dictionary, so a
string passed to it without a Chinese entry fails the typecheck; a `|context` suffix separates
two translations of one English word ("Budget" the fact, "Budget|tier" the cheapest preset).
The top-bar language button beside data mode and the Settings language control update the same
setting.
Traveller text and agent-generated replies stay unchanged. English is the fallback for strings
without a Chinese translation. No planning, shared contract, currency conversion, address format
or traveller-limit behavior changes. The sidebar/main gutter fix accompanies this UI feature.

This supplements [the settings layout](2026-09-27-mindtrip-settings.md); its other sections remain.

## Alternatives considered

- Keep language combined with currency, address and party changes: rejected by team review of #144.
- Translate generated replies or user text: not part of the requested interface-language feature.

## Consequences

Language persists locally and through the existing settings sync. Old settings follow the
browser language until the traveller chooses;
stored trips and demo intake remain compatible. Unmapped labels stay English rather than being
invented. Display currency, address UI and reverse lookup will be separate subsequent PRs.

## Sources

- [Team split request](https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/144#issuecomment-5971820142)
- [Spec #145](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/145) and
  [ticket #146](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/146): browser default and
  `en` | `zh` values.
