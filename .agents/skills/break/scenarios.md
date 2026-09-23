# Scenario axes

This is the menu that step 2 of [SKILL.md](SKILL.md) chooses from. Each axis has a cue, meaning the
property of the component that makes the axis worth running. If the cue matches, the axis stays; if
not, drop it and name the drop in the plan. Prefer the worst real values from the mock data in
`packages/tools/src/mock-server.mjs` when they are worse than the examples below.

## Content length

**Cue: the component renders text it does not write itself.** This covers provider data (places,
hotels, airlines, routes), what the traveller typed, and model output.

| Scenario                      | Example                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| Empty string or missing field | A place with no address; a hotel with no name                                       |
| One short word                | "Nara"                                                                              |
| Typical                       | "Fushimi Inari Taisha"                                                              |
| Several sentences             | A long model explanation, or a place description                                    |
| One unbreakable string        | A long booking URL, or "Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch" |

## Content shape

**Cue: the text can come from providers, other languages or the traveller.**

| Scenario                     | What it catches                                                  |
| ---------------------------- | ---------------------------------------------------------------- |
| Chinese, and mixed CJK/Latin | "京都 Kyoto 伏见稻荷大社": fallback fonts, line height, wrapping |
| Emoji                        | Line-height jumps and vertical centring                          |
| Accents and tall scripts     | "Ōsaka", "Zürich", Thai names: clipped ascenders and descenders  |
| Aligned numbers              | Money and times that should line up in columns (`tabular-nums`)  |

## Money and numbers

**Cue: the component shows prices, budgets, durations or counts.**

| Scenario               | Example                                            |
| ---------------------- | -------------------------------------------------- |
| Zero and missing price | `A$0`; "Price not provided"                        |
| Very large             | `A$1,234,567` for a group total                    |
| Original currency      | An amount stated in JPY or USD beside its AUD base |
| Long durations         | A 31-hour connection; a 14-day trip                |

## Photos

**Cue: the component shows a provider place photo.**

| Scenario              | What it catches                                        |
| --------------------- | ------------------------------------------------------ |
| No photo              | The category-icon fallback, not an empty box           |
| Portrait and panorama | Cropping with `object-fit`; a fixed aspect ratio holds |
| Slow or failed load   | Layout shift; broken-image icon                        |
| Long attribution      | The credit wraps without covering the image            |

## Quantity

**Cue: the component repeats over items**, such as stops, days, flights, legs, places or chats.

| Scenario      | What it catches                                   |
| ------------- | ------------------------------------------------- |
| Zero items    | A missing empty state                             |
| One item      | Layouts designed only for plural content          |
| Realistic     | The baseline                                      |
| 10× realistic | Missing scroll or clamping; sticky parts breaking |

## Data provenance and state

**Cue: the component takes a `source`, status or loading/error state as props.**

| Scenario                 | What it catches                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------- |
| Every `SourceBadge` kind | live, estimated, mock, fallback, unavailable and a missing source all read as text |
| Loading                  | Layout shift when the content arrives                                              |
| Error                    | Overflowing messages; colour used as the only signal                               |
| Disabled                 | Contrast collapse; unreachable explanation                                         |

Leave focus and hover for the user to try on the page.

## Container

**Cue: always.** Each width is a fixed container on the page, never a resized viewport.

| Scenario                   | Why                                           |
| -------------------------- | --------------------------------------------- |
| 320 px                     | Reflow floor; the narrowest phone column      |
| 375 px and 390 px          | The phone widths in the ui-verification skill |
| 560 px                     | The Trip drawer's minimum width               |
| Squeezed by a flex sibling | Refusing to shrink; `min-width: auto` blowout |

## Environment

**Cue: the project supports the mode.** The page does not render these. Name them in the report for
the user to toggle: OS dark mode, 200% zoom, reduced motion, and reduced transparency for anything
that uses [glass](../better-ui/glass.md).
