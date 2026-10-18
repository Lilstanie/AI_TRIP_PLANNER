# Agent Note: Settings follows Mindtrip's settings page, with style and memory for the assistant

Status: implemented
Owner: repository owner (@HeadmasterEggy)

## Problem

The owner asked for Settings to look like Mindtrip's and to include what Mindtrip has: features the
planner lacks but can support should be added, and ones it cannot support left out. The four-tab
dialog (Travel profile, Memberships, General, Account) matched neither Mindtrip's layout nor its
sections.

## Decision

- **Layout.** `SettingsDialog` keeps the glass dialog. Inside it are a vertical section list and a
  panel of labelled rows with Change actions. Type and controls follow measurements of Mindtrip's
  page: 18/600 title, 16/600 groups, 14 px text with 50% ink descriptions, and a 56 × 32 ink switch.
  The sections are:
  - **Edit profile:** name through Clerk's `user.update`, and location.
  - **Your account:** email, theme, export, sign out and delete.
  - **Personalization:** communication style, long-term memory and the traveller facts. The facts
    are shown as Mindtrip's memory rows, with Answer on an empty fact.
  - **Language & region:** language, region, currency, units and trip data.
  - **Connected accounts:** the traveller's Clerk external accounts.
- **Assistant settings.** `AssistantSettings { style, memory }` is added to
  `packages/shared/src/chat.ts` as `ChatRequest.assistant`. The change is additive, and a request
  without the field behaves as before.
  - `style` appends one tone rule to the coordinator prompt.
  - With `memory: false`, `runTripChat` drops `learnedPreferences` from the incoming brief and
    `known`, and `update_trip_brief` records none.
  - The client sends `settings.assistant` with every chat request.
- **Stored settings.** `UserSettings.assistant` is defaulted in the zod schema, so settings stored
  before it existed still parse. Version 1 is unchanged.
- **Left out.** Voice, price alerts, notifications and cookie preferences have no counterpart. Profile
  fields with no use here (website, bio, social links, phone, birthday, address) are omitted.

## Alternatives considered

The [interface language note](2026-10-04-interface-language-only.md) adds editable English/Chinese
language controls and persistence; the settings layout and other sections remain unchanged.

- **A full settings page instead of the dialog.** Rejected: the workspace is one screen, and every
  other editor is a dialog.
- **Memory off disables the travel profile too.** Rejected: the profile is entered explicitly by the
  traveller. Mindtrip's switch covers what the assistant learns, and here that is
  `learnedPreferences`.
- **Changing units or currency.** Not added: every total is AUD by
  [the base-currency note](../architecture/2026-09-20-aud-base-currency.md), so the rows are shown
  read-only.

## Consequences

- Section ids changed to `profile`, `account`, `personalization`, `region` and `connected`.
  `openSettings()` defaults to `personalization`.
- The style rule is advisory, because the model decides the tone.
- Related: the [conversation scope note](2026-09-27-conversation-scope.md) and the
  [accounts note](../architecture/2026-09-27-accounts-settings-sync.md).

## Sources

The owner's feedback in `docs/problem.md` (local). Mindtrip's settings page was viewed read-only in
the owner's own signed-in browser, and no Mindtrip copy or assets were reused. See the
[session log](../../../session-logs/2026-09-27-mindtrip-settings.md).
