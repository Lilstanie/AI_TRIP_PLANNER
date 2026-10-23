# Specialist hand-off failure inventory

Before changing production code, the retained browser journey must distinguish these failures:

- A mention that names the wrong specialist ("@Stay recommend a restaurant") gets no decline, or the decline is not under the mentioned specialist's icon.
- The decline does not name the right specialist, or is not localised in English and Chinese.
- No Coordinator dispatch follows the decline, or the receiving specialist runs without one.
- The receiving specialist does not run, or a section other than its own changes, or the mentioned specialist's section changes.
- The order in the team conversation is not decline, Coordinator dispatch, receiving specialist.
- A request that belongs to the mentioned specialist ("@Stay find a cheaper hotel") triggers a hand-off.
- The turn hands off more than once, or the receiving specialist declines again.
- The decline carries no decision marker, or the Coordinator dispatch is marked as an AI decision in fixture mode.
- The page overflows horizontally at phone width, or throws a page error.

The E2E runs in mock data mode with no keys. The live-model judgement is covered by a scripted model in the orchestrator's conversation tests.
