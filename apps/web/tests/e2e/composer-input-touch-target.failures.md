# Composer message field touch-target failure inventory

Written before changing the implementation; the "before" run was recorded against `origin/main` at 03e7a3ca.

| Failure mode                                                            | Evidence the E2E must capture                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| The phone rule does not reach the message field, so it stays 36 px high | Measure `textarea.composer__input` at 390 × 844 and require at least 44 CSS pixels.                                |
| A tap 40 px below the top of the field does not focus it                | Tap 40 px below the field's top edge and require the focused element to be the field.                              |
| The desktop field grows, changing the compact layout                    | Measure the same field at 1440 × 900 and require it to stay below 44 px.                                           |
| The change introduces horizontal page overflow                          | Require the document width to stay within the viewport.                                                            |
| A page error occurs during the journey, or the artifact is missing      | Collect page errors and save a screenshot plus `summary.json` in `output/playwright/composer-input-touch-target/`. |

The run verifies a Chromium emulated viewport. It does not establish physical-device behaviour or hardware touch accuracy.
