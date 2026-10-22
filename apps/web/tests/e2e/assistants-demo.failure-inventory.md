# Assistants demo walkthrough failure inventory

The walkthrough is the Stage 2 demo record. A run must fail on any of these:

- Step 1: the team conversation shows no Coordinator message or fewer than the five specialists with their icons.
- Step 2: mentioning Stay changes a section other than accommodation, or the reply is not under the accommodation icon.
- Step 3: a budget overrun after a mention shows no conflict, score or stop message, or styles them as an assistant.
- Step 4: two mentions in one message send fewer or more than the two ids, or run another specialist.
- Step 5: a restaurant request mentioned to Stay shows no decline, no Coordinator dispatch, or no Food & dining answer.
- Step 6: a renamed assistant is not shown under its new name in the chips and replies, or the new name does not send the same id.
- Step 7: a mention before any plan creates a plan or a section, or the Coordinator stops asking for the brief.
- Any step: a missing screenshot, a page error, or horizontal overflow at 390 px.
- The walkthrough passes in only one language or only one width.

The E2E runs in mock data mode with no keys.
