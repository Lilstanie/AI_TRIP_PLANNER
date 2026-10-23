# Assistants demo walkthrough failure inventory

The walkthrough is the Stage 2 demo record. A run must fail on any of these:

- Step 1: while the plan streams, the Specialist team button shows no working specialist or no animated avatar; the opened panel does not list the Coordinator and the five specialists with their icons; the panel opens by itself.
- Step 2: the @ menu does not offer Stay, picking it does not send its id, a chip row renders, mentioning Stay changes a section other than accommodation, or the reply is not under the accommodation icon.
- Step 3: a budget overrun after a mention shows no conflict, score or stop line in the panel, or styles one as an assistant, or the panel lists no revision assignment for the specialist the conflict sent back.
- Step 4: the first Backspace after a mention deletes text or selects less than the whole `@name`, or the second leaves part of it.
- Step 5: two mentions in one message send fewer or more than the two ids, or run another specialist.
- Step 6: a restaurant request mentioned to Stay shows no decline, no Coordinator dispatch, or no Food & dining answer.
- Step 7: an earlier reply has no summary, its summary opens the latest run's panel instead of its own, pressing Stay in it expands no Stay row of that reply, or the row stays out of view.
- Step 8: a renamed assistant is not shown under its new name in the @ menu, the panel and replies, or the new name does not send the same id.
- Step 9: a mention before any plan creates a plan or a section, or the Coordinator stops asking for the brief.
- Any step: a missing or unnumbered screenshot, a page error, or horizontal overflow at 390 px.
- The walkthrough passes in only one language or only one width.

The E2E runs in mock data mode with no keys.
