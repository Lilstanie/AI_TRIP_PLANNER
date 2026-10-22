# Mention hand-off judgement failure inventory

The browser journey covers the deterministic rule. This inventory covers only the live-model judgement, which the journey cannot reach. Each case must be distinguishable before the code is trusted.

- The model answers `own`, but the turn still hands off.
- The model names another specialist, but no hand-off decision is emitted, or it is marked as a code decision.
- The model names the mentioned specialist itself, and the turn hands off to itself.
- The model answers with text that is not an id, and the turn crashes instead of using the deterministic rule.
- The model call throws, and the turn fails instead of using the deterministic rule.
- A hand-off decision is emitted more than once in a turn.
- The receiving specialist is not the one named by the model.
