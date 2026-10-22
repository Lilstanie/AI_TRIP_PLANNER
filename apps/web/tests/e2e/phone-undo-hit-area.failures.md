# Phone Undo hit-area failure inventory

Written before changing the E2E check or implementation.

| Failure mode                                                       | Evidence the E2E must capture                                                                                         |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Marking a stop visited does not show an Undo action                | Fail when the Undo button is absent after the action.                                                                 |
| The phone rule is overridden by the shared button minimum          | Measure the rendered Undo button and require both width and height to be at least 44 CSS pixels.                      |
| The measured button is outside the visible phone viewport          | Scroll the target into view, record its viewport bounds, and require the full target to be visible in the screenshot. |
| The action works but introduces horizontal page overflow           | Require the document width to remain within the 375-pixel phone viewport.                                             |
| The browser reports a runtime error during the journey             | Collect page errors and fail with the observed messages.                                                              |
| The screenshot is missing or the measured result is not repeatable | Save a screenshot and machine-readable measurements in the E2E output directory.                                      |

The browser run verifies a 375 × 812 CSS-pixel viewport. It does not establish physical-device behavior, operating-system scaling, or touch accuracy on hardware.
