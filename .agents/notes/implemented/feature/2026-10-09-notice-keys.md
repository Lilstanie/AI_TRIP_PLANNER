# Agent Note: notices are keys on the plan, and the drawer localises them

Status: implemented
Owner: spec #259, ticket #261

## Problem

A notice the planner gives about a plan (a travel-buffer warning, an unroutable leg, a price check, a budget
sentence) reaches the screen three ways, and the drawer can show the wrong one:

- As an English sentence in `proposal.conflictsWith`, which `settlePlan` copies into `plan.conflicts`. The chat
  reads this copy (`planDigest` in `packages/orchestrator/src/chat.ts`), so it has to stay English.
- As a keyed notice in `editIssues[].message` (`storeNotice`, see the
  [edit preview notices](../../implemented/architecture/2026-10-06-edit-preview-notices.md) and
  [keyed notices](../../implemented/architecture/2026-10-06-keyed-notices-everywhere.md) notes). The stop it is about is
  stored in `activityIds`.
- As text the display shows raw. `placeConflicts()` (`apps/web/lib/trip/conflicts.ts`) puts every `conflictsWith`
  sentence that has no matching stored issue under the day title or the budget bar as `{ raw }`.

The third path is the one the Chinese drawer shows in English. A plan saved before its notices were keyed has the
English sentence in `conflictsWith` and no `editIssues` entry for it. Its travel-buffer sentence, "Day 1: Royal Botanic
Garden Sydney needs at least 22 minutes after the previous activity.", then appears under the day title in the Chinese
interface. The drawer walkthrough carries this as a known exception (`KNOWN_EXCEPTIONS.zh` in
`drawer-walkthrough.e2e.mjs`). The spec describes a travel-buffer notice attached to every stop of a day; on this branch
a keyed travel-buffer notice is attached to its destination stop only (`blockedStop` in `trip-edit.ts`). The legacy path
is the one that still reaches the day title, so this note fixes that path and keeps the stop rule under test.

## Decision

**Storage stays as it is, and is named as the rule.** Each notice the planner authors is stored once as a key with its
parameters, in `editIssues[].message` (`notice:` + encoded JSON). `conflictsWith` keeps the English sentence of the same
notice because the chat reads it; the drawer does not read that copy for a keyed notice. No `packages/shared/src` change:
`conflictsWith` and `editIssues` keep their shapes.

**The display reads a sentence it did not key as its key when the app wrote it.** A `conflictsWith` sentence with no
matching stored issue is matched against the dictionary's English keys (`AUTHORED_KEYS` in `apps/web/lib/i18n/locale.ts`;
`keyOfAuthoredSentence` in `apps/web/lib/i18n/notice.ts` reads each `{name}` back from the sentence). A match is a notice the app authored before keys existed, and is placed as that
key with its parameters, so it is localised. Placement:

- a notice with a `day` and a `stop` parameter goes under the stop of that name on that day (the destination stop of its
  leg, as a keyed notice is placed);
- a notice with a `day` and no stop goes under that day's title;
- a notice with neither goes under the budget bar.

A sentence that matches no key stays `{ raw }`: model, agent and provider text is shown as received, as today.

**No new keys.** Every sentence this change localises already has a Chinese entry, so the new keys requirement is met
by reuse. A key added later needs its Chinese string in the same change. `placeConflicts()` in
`apps/web/lib/trip/conflicts.ts` is where the placement is made; `trip-edit.ts` and the stored shapes are unchanged.

**The stop rule.** A keyed travel-buffer notice stays on its destination stop (`blockedStop`). The E2E scenario checks that
a notice about one leg appears under its destination stop only, in both languages.

## Failure modes

Each row is checked by `notice-keys.e2e.mjs` (the keyed and legacy phases at both widths, in both languages) unless a later column says otherwise.

| #   | Situation                                                                                                  | Behaviour                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A time edit makes a leg's travel buffer unmet, the plan stores the keyed notice (Chinese interface)        | The sentence is in Chinese on the destination stop only. No English, and nothing under the day title. (Control, green before and after.)                                                                    |
| 2   | The same edit in English                                                                                   | The English sentence, unchanged, on the destination stop only. (Control.)                                                                                                                                   |
| 3   | A plan saved before notices were keyed: English travel-buffer sentence in `conflictsWith`, no stored issue | Red before this change (English under the day title in Chinese). After it, the sentence is localised and placed on the stop named in it (`notice-keys.e2e.mjs`, legacy phase, Chinese).                     |
| 4   | Same as 3 in English                                                                                       | Same sentence, same wording, on the named stop, not under the day title (`notice-keys.e2e.mjs`, legacy phase, English).                                                                                     |
| 5   | A legacy travel-buffer sentence whose stop name matches no stop on that day (stop renamed or moved)        | Under the day title, localised. It is never shown in English in the Chinese interface.                                                                                                                      |
| 6   | A legacy "Day N: confirm the place for every stop first..." sentence (no stop named)                       | Under the day title, localised.                                                                                                                                                                             |
| 7   | A legacy "Route unavailable" sentence (no stop, no day)                                                    | Under the budget bar, localised. Stop-level route notices are keyed and carry their stop, so this case is legacy only.                                                                                      |
| 8   | Two stops on one day have the same name                                                                    | The notice goes on the first such stop in plan order. (A keyed notice never has this ambiguity: it stores the stop id.)                                                                                     |
| 9   | An agent's or model's sentence that is not an app key (for example "Day 2 route unavailable")              | Shown as received under the day title, as today. Not localised; not an app notice.                                                                                                                          |
| 10  | A provider's route text (`{ raw }`)                                                                        | Shown as received, in both languages, as today.                                                                                                                                                             |
| 11  | A stored notice's key is no longer in the dictionary (a future rename)                                     | Shown in English (the key itself), as `translate` already does. No key is renamed or removed by this change.                                                                                                |
| 12  | The chat reads the plan after an edit                                                                      | `plan.conflicts` and `conflictsWith` keep their English sentences, so the chat's answer wording is unchanged. The E2E reads the English copy from the preview response.                                     |
| 13  | A stop with a stored notice is removed or moved to Ideas on the client (`item-actions.ts`)                 | The stored issue still names the removed stop, so it is not shown. Its English copy stays in `conflictsWith` (as today), so no raw English appears. Not changed by this note; listed as a known limitation. |
| 14  | Phone width (390 by 844) for each case above                                                               | The same placement, the same text. Every check runs at both widths.                                                                                                                                         |

## Alternatives considered

- **Drop the English sentence from `conflictsWith` and derive the chat copy from keys in `settlePlan`.** Cleaner
  storage, but `conflictsWith` is a field of the shared contract (`packages/shared/src/contracts.ts`) and the chat
  reads `plan.conflicts`. Changing either needs a shared-contract note and changes what the chat is given. Rejected for
  this ticket; the chat copy stays as the spec allows.
- **Store the Chinese text as well as the key.** Rejected: three copies of one notice, and the Chinese text would not
  follow the traveller's language if the locale changed. The key is stored once and localised when shown.
- **Hide legacy English sentences that have no stored issue.** Rejected: a legacy travel-buffer warning would vanish
  without a message, which is the silent loss the spec is written to remove.
- **Recheck saved plans on load to rebuild their issues.** Rejected: it needs a route provider call per saved plan on
  every page load, and mock and live plans would disagree.
- **Match only the travel-buffer and confirm templates.** Rejected in favour of matching every dictionary key: the same
  reverse lookup then covers the budget and route sentences that a legacy plan can hold, with one rule to state.

## Consequences

- In the Chinese interface, no English notice text appears in the trip drawer, including the travel-buffer sentence under
  a day title. The walkthrough's `KNOWN_EXCEPTIONS.zh` entry for it is removed.
- The chat's English copy (`conflictsWith`, `plan.conflicts`) is unchanged.
- A notice about one leg appears under its destination stop only.
- Every key the change uses has a Chinese string; no new key without one.
- The wording of notices that already work is unchanged, apart from localisation.
- No unit tests are added and nothing in `packages/shared/src` changes.
- `DATA_MODE=mock pnpm --filter @trip/web e2e timeline workspace-chinese drawer-walkthrough plan-revision` exits 0,
  with `notice-keys` added.
- A legacy sentence's order within a stop follows the plan's conflict order, so it can list after the overlap marker
  that a keyed notice lists before it. Only legacy plans are affected; the wording is unchanged.
- The E2E is `apps/web/tests/e2e/notice-keys.e2e.mjs`. Its summary is `output/playwright/notice-keys/<time>/summary.json`,
  and the runner writes `output/e2e/runner/<time>.json` beside the other scripts.
- A dictionary sentence written by an agent that happens to equal an app key is localised. The text is identical, so the
  risk is the reader seeing Chinese for an agent's identical wording. Accepted.
- Matching every dictionary key costs one regular expression per key per conflict sentence. Patterns are built once
  per page load, and placement is memoised per plan.
- A legacy sentence whose stop name changed after the plan was saved falls to the day title (row 5). Accepted: the
  sentence is no longer about a stop the plan has.
- Known limitation, not changed here (row 13): a keyed notice whose stop is removed or moved to Ideas on the client
  stays stored and is not shown.
