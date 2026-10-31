# Copy patterns

Templates for destructive flows and status copy. Plurals, placeholders and money formatting are not
here: they go through `t()` and `useLocale()` as [SKILL.md](../SKILL.md) describes. Quoted strings
marked _existing_ are English values in the `apps/web/lib/i18n/messages/` catalogs; the rest are patterns to adapt.

## Destructive flows

| Situation                   | Copy                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Reversible, frequent action | Act at once and report the result, "{name} moved to Ideas." (_existing_), with a way to undo                |
| Irreversible, one item      | Title names the action and the object, "Delete “{title}”?" (_existing_). The body says what is kept or lost |
| Irreversible, many items    | Title: "Delete {count} chats?" Body: "You can't undo this." Buttons: `Delete {count} chats`, `Cancel`       |
| Affects other people        | The body names who loses what                                                                               |

A notice with an undo action stays until dismissed; see
[better-accessibility](../../better-accessibility/SKILL.md).

## Status copy

| State       | Pattern                                        | Example                                                    |
| ----------- | ---------------------------------------------- | ---------------------------------------------------------- |
| In progress | Verb in `-ing` plus the object                 | "Saving place…", "Checking the change…" (_existing_)       |
| Done        | Object plus past-tense verb, no "successfully" | "{name} moved to Ideas." (_existing_)                      |
| Failed      | What didn't happen, then the next step         | "{object} not saved. Check your connection and try again." |
| Unavailable | Why, and what unlocks it, beside the control   | "Add {missing input} to {action}"                          |
| Partial     | Counts for both outcomes                       | "{done} of {total} {items} {verb}. Retry {failed} {items}" |

Keep the in-progress and done strings parallel, so "Saving place…" resolves to "Place saved".
